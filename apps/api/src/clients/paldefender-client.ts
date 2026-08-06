import { z } from "zod";

const versionResponseSchema = z.object({
  Version: z.object({
    Version: z.string().trim().min(1),
    VersionLong: z.string().trim().min(1).optional(),
  }),
});

const playerResponseSchema = z.object({
  Players: z.array(
    z.object({
      Name: z.string(),
      PlayerUID: z.string(),
      UserId: z.string().optional().default(""),
      GuildName: z.string().optional().default(""),
      Status: z.string(),
    }),
  ),
});

export interface PalDefenderPlayer {
  name: string;
  playerId: string;
  online: boolean;
  guild: string | null;
  level: number | null;
}

export class PalDefenderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PalDefenderError";
  }
}

export class PalDefenderClient {
  private readonly baseUrl: string;

  constructor(
    baseUrl: string,
    private readonly token: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getVersion(): Promise<string> {
    const response = versionResponseSchema.parse(await this.get("/version"));
    return response.Version.Version;
  }

  async getPlayers(): Promise<PalDefenderPlayer[]> {
    const response = playerResponseSchema.parse(await this.get("/players"));

    return response.Players.map((player) => ({
      name: player.Name,
      playerId: player.PlayerUID || player.UserId,
      online: player.Status.trim().toLowerCase() === "online",
      guild: player.GuildName.trim() || null,
      // PalDefender's player-list DTO does not currently include a level.
      level: null,
    }));
  }

  private async get(path: string): Promise<unknown> {
    let response: Response;

    try {
      response = await this.fetchImplementation(
        `${this.baseUrl}/v1/pdapi${path}`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.token}`,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      throw new PalDefenderError("Unable to reach PalDefender.", undefined, {
        cause: error,
      });
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as {
        Error?: { Message?: string };
      } | null;
      throw new PalDefenderError(
        body?.Error?.Message ??
          `PalDefender returned HTTP ${response.status}.`,
        response.status,
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new PalDefenderError(
        "PalDefender returned an invalid JSON response.",
        response.status,
        { cause: error },
      );
    }
  }
}
