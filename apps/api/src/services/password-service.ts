import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const cost = 2 ** 15;
const blockSize = 8;
const parallelization = 3;
const keyLength = 64;
const maxmem = 64 * 1_024 * 1_024;

export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const derived = await this.derive(password, salt, keyLength, {
      N: cost,
      r: blockSize,
      p: parallelization,
      maxmem,
    });
    return [
      "scrypt",
      cost,
      blockSize,
      parallelization,
      salt.toString("base64url"),
      derived.toString("base64url"),
    ].join("$");
  }

  async verify(password: string, encoded: string): Promise<boolean> {
    if (!this.isSupportedHash(encoded)) return false;
    const [algorithm, n, r, p, saltText, hashText, extra] = encoded.split("$");
    if (
      algorithm !== "scrypt" ||
      !n ||
      !r ||
      !p ||
      !saltText ||
      !hashText ||
      extra
    ) {
      return false;
    }
    const expected = Buffer.from(hashText, "base64url");
    if (expected.length !== keyLength) return false;
    try {
      const actual = await this.derive(
        password,
        Buffer.from(saltText, "base64url"),
        expected.length,
        {
          N: Number(n),
          r: Number(r),
          p: Number(p),
          maxmem,
        },
      );
      return timingSafeEqual(actual, expected);
    } catch {
      return false;
    }
  }

  isSupportedHash(encoded: string): boolean {
    const [algorithm, n, r, p, saltText, hashText, extra] = encoded.split("$");
    return (
      algorithm === "scrypt" &&
      Number(n) === cost &&
      Number(r) === blockSize &&
      Number(p) === parallelization &&
      !!saltText &&
      Buffer.from(saltText, "base64url").length === 16 &&
      !!hashText &&
      Buffer.from(hashText, "base64url").length === keyLength &&
      !extra
    );
  }

  private derive(
    password: string,
    salt: Buffer,
    length: number,
    options: { N: number; r: number; p: number; maxmem: number },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      scrypt(password, salt, length, options, (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      });
    });
  }
}
