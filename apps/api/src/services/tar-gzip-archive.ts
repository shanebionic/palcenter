import { gunzipSync, gzipSync } from "node:zlib";

const blockSize = 512;
const maxExtractedBytes = 1_024 * 1_024 * 1_024;

export interface ArchiveEntry {
  name: string;
  contents: Buffer;
}

function octal(value: number, length: number): Buffer {
  const text = value.toString(8).padStart(length - 1, "0");
  return Buffer.from(`${text}\0`, "ascii");
}

export function createTarGzip(entries: ArchiveEntry[]): Buffer {
  const chunks: Buffer[] = [];

  for (const entry of entries) {
    if (!/^[a-zA-Z0-9._-]+$/.test(entry.name) || entry.name.length > 100) {
      throw new Error("Archive entry name is invalid.");
    }

    const header = Buffer.alloc(blockSize);
    header.write(entry.name, 0, 100, "utf8");
    octal(0o600, 8).copy(header, 100);
    octal(0, 8).copy(header, 108);
    octal(0, 8).copy(header, 116);
    octal(entry.contents.length, 12).copy(header, 124);
    octal(Math.floor(Date.now() / 1_000), 12).copy(header, 136);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    octal(
      [...header].reduce((total, byte) => total + byte, 0),
      7,
    ).copy(header, 148);
    header[155] = 0x20;

    chunks.push(header, entry.contents);
    const padding =
      (blockSize - (entry.contents.length % blockSize)) % blockSize;
    if (padding) {
      chunks.push(Buffer.alloc(padding));
    }
  }

  chunks.push(Buffer.alloc(blockSize * 2));
  return gzipSync(Buffer.concat(chunks), { level: 9 });
}

function parseOctal(buffer: Buffer): number {
  const text = buffer.toString("ascii").replace(/\0.*$/, "").trim();
  if (!/^[0-7]+$/.test(text)) {
    throw new Error("Archive contains an invalid numeric field.");
  }
  return Number.parseInt(text, 8);
}

export function extractTarGzip(archive: Buffer): Map<string, Buffer> {
  let tar: Buffer;

  try {
    tar = gunzipSync(archive, { maxOutputLength: maxExtractedBytes });
  } catch {
    throw new Error("The uploaded file is not a valid gzip archive.");
  }

  const entries = new Map<string, Buffer>();
  let offset = 0;

  while (offset + blockSize <= tar.length) {
    const header = tar.subarray(offset, offset + blockSize);
    offset += blockSize;

    if (header.every((byte) => byte === 0)) {
      return entries;
    }

    const storedChecksum = parseOctal(header.subarray(148, 156));
    const checksumHeader = Buffer.from(header);
    checksumHeader.fill(0x20, 148, 156);
    const calculatedChecksum = [...checksumHeader].reduce(
      (total, byte) => total + byte,
      0,
    );
    if (storedChecksum !== calculatedChecksum) {
      throw new Error("Archive checksum validation failed.");
    }

    const name = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    const type = String.fromCharCode(header[156] ?? 0);
    const size = parseOctal(header.subarray(124, 136));

    if (!/^[a-zA-Z0-9._-]+$/.test(name) || (type !== "0" && type !== "\0")) {
      throw new Error("Archive contains an unsafe entry.");
    }
    if (entries.has(name) || offset + size > tar.length) {
      throw new Error("Archive structure is invalid.");
    }

    entries.set(name, Buffer.from(tar.subarray(offset, offset + size)));
    offset += size + ((blockSize - (size % blockSize)) % blockSize);
  }

  throw new Error("Archive is missing its end marker.");
}
