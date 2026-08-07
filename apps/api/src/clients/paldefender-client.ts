import { z } from "zod";

const locationSchema = z
  .object({ x: z.number(), y: z.number(), z: z.number() })
  .partial()
  .optional();
const rawPlayerSchema = z.object({
  Name: z.string().default(""),
  PlayerUID: z.string(),
  UserId: z.string().optional().default(""),
  GuildName: z.string().optional().default(""),
  Status: z.string().optional().default(""),
  WorldLocation: locationSchema,
  MapLocation: locationSchema,
});
const versionResponseSchema = z.object({
  Version: z.object({ Version: z.string().trim().min(1) }),
});
const playerListResponseSchema = z.object({
  Players: z.array(rawPlayerSchema),
});
const playerResponseSchema = z.object({ Player: rawPlayerSchema });
const inventoryContainerSchema = z.object({
  Available: z.boolean().optional().default(false),
  Slots: z
    .record(z.object({ ItemID: z.string(), Count: z.number().int() }))
    .optional()
    .default({}),
});
const inventoryResponseSchema = z.object({
  Inventory: z.record(inventoryContainerSchema),
});
const rawPalSchema = z
  .object({
    PalID: z.string(),
    Nickname: z.string().optional().default(""),
    Gender: z.string().optional(),
    Level: z.number().int().optional(),
    Exp: z.number().int().optional(),
    Shiny: z.boolean().optional(),
    PartnerSkillLevel: z.number().int().optional(),
    CondensedPals: z.number().int().optional(),
    PhysicalHealth: z.string().optional(),
    WorkerSick: z.string().optional(),
    ImportedCharacter: z.boolean().optional(),
    HP: z.number().optional(),
    Hunger: z.number().optional(),
    MaxHunger: z.number().optional(),
    SAN: z.number().optional(),
    Support: z.number().int().optional(),
    CraftSpeed: z.number().int().optional(),
    PalSouls: z.record(z.number()).optional().default({}),
    IVs: z.record(z.number()).optional().default({}),
    ExtraWorkSuitabilities: z.record(z.number()).optional().default({}),
    DisableWorkPreferences: z.array(z.string()).optional().default([]),
    Passives: z.array(z.string()).optional().default([]),
    ActiveSkills: z.array(z.string()).optional().default([]),
    LearntSkills: z.array(z.string()).optional().default([]),
  })
  .passthrough();
const palsResponseSchema = z.object({
  Pals: z.object({
    Team: z.record(rawPalSchema).optional().default({}),
    Palbox: z.record(rawPalSchema).optional().default({}),
    BaseCamps: z
      .array(
        z.object({
          id: z.string(),
          pals: z.record(rawPalSchema).optional().default({}),
        }),
      )
      .optional()
      .default([]),
  }),
});
const technologyResponseSchema = z.object({
  Techs: z.object({ Unlocked: z.array(z.string()).optional().default([]) }),
});
const kickResponseSchema = z.object({
  Success: z.boolean(),
  UserId: z.string(),
});

export interface PalDefenderPlayer {
  name: string;
  playerId: string;
  online: boolean;
  guild: string | null;
  level: number | null;
}
export interface PalDefenderPlayerDetails extends PalDefenderPlayer {
  worldLocation: { x?: number; y?: number; z?: number } | null;
  mapLocation: { x?: number; y?: number; z?: number } | null;
}
export interface PalDefenderInventoryItem {
  container: string;
  slot: number;
  itemId: string;
  quantity: number;
}
export interface PalDefenderPal {
  instanceId: string;
  location: "Team" | "Palbox" | "Base Camp";
  baseCampId: string | null;
  palId: string;
  nickname: string | null;
  gender: string | null;
  level: number | null;
  experience: number | null;
  shiny: boolean | null;
  rank: number | null;
  condensedPals: number | null;
  physicalHealth: string | null;
  workerSick: string | null;
  imported: boolean | null;
  hp: number | null;
  hunger: number | null;
  maxHunger: number | null;
  sanity: number | null;
  support: number | null;
  craftSpeed: number | null;
  palSouls: Record<string, number>;
  ivs: Record<string, number>;
  extraWorkSuitabilities: Record<string, number>;
  disabledWorkPreferences: string[];
  passiveSkills: string[];
  activeSkills: string[];
  learnedSkills: string[];
}
export interface PalDefenderKickResult {
  success: boolean;
  playerId: string;
}

export class PalDefenderError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly code?: string,
    readonly timedOut = false,
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
    return (await this.parse(versionResponseSchema, "/version")).Version
      .Version;
  }

  async getPlayers(): Promise<PalDefenderPlayer[]> {
    const response = await this.parse(playerListResponseSchema, "/players");
    return response.Players.map((player) => normalizePlayer(player));
  }

  async getPlayer(playerId: string): Promise<PalDefenderPlayerDetails> {
    const response = await this.parse(
      playerResponseSchema,
      `/player/${encodePlayerId(playerId)}`,
    );
    return {
      ...normalizePlayer(response.Player),
      worldLocation: response.Player.WorldLocation ?? null,
      mapLocation: response.Player.MapLocation ?? null,
    };
  }

  async getInventory(playerId: string): Promise<PalDefenderInventoryItem[]> {
    const response = await this.parse(
      inventoryResponseSchema,
      `/items/${encodePlayerId(playerId)}`,
    );
    return Object.entries(response.Inventory).flatMap(([container, value]) =>
      value.Available
        ? Object.entries(value.Slots ?? {}).map(([slot, item]) => ({
            container,
            slot: Number(slot),
            itemId: item.ItemID,
            quantity: item.Count,
          }))
        : [],
    );
  }

  async getPals(playerId: string): Promise<PalDefenderPal[]> {
    const response = await this.parse(
      palsResponseSchema,
      `/pals/${encodePlayerId(playerId)}`,
    );
    const normalize = (
      entries: Record<string, z.infer<typeof rawPalSchema>>,
      location: PalDefenderPal["location"],
      baseCampId: string | null = null,
    ) =>
      Object.entries(entries).map(([instanceId, pal]) =>
        normalizePal(instanceId, pal, location, baseCampId),
      );
    return [
      ...normalize(response.Pals.Team ?? {}, "Team"),
      ...normalize(response.Pals.Palbox ?? {}, "Palbox"),
      ...(response.Pals.BaseCamps ?? []).flatMap((camp) =>
        normalize(camp.pals ?? {}, "Base Camp", camp.id),
      ),
    ];
  }

  async getTechnology(playerId: string): Promise<string[]> {
    const response = await this.parse(
      technologyResponseSchema,
      `/techs/${encodePlayerId(playerId)}`,
    );
    return response.Techs.Unlocked ?? [];
  }

  async kickPlayer(
    playerId: string,
    message?: string,
  ): Promise<PalDefenderKickResult> {
    const response = await this.parse(
      kickResponseSchema,
      `/kick/${encodePlayerId(playerId)}`,
      {
        method: "POST",
        body: JSON.stringify(message?.trim() ? { Reason: message.trim() } : {}),
      },
    );
    return { success: response.Success, playerId };
  }

  private async parse<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    path: string,
    init?: RequestInit,
  ): Promise<z.infer<TSchema>> {
    const payload = await this.request(path, init);
    const result = schema.safeParse(payload);
    if (!result.success) {
      throw new PalDefenderError(
        "PalDefender returned a malformed response.",
        502,
        "MALFORMED_RESPONSE",
        false,
        { cause: result.error },
      );
    }
    return result.data;
  }

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImplementation(
        `${this.baseUrl}/v1/pdapi${path}`,
        {
          ...init,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${this.token}`,
            ...(init?.body ? { "Content-Type": "application/json" } : {}),
            ...init?.headers,
          },
          signal: AbortSignal.timeout(10_000),
        },
      );
    } catch (error) {
      const timedOut =
        error instanceof DOMException && error.name === "TimeoutError";
      throw new PalDefenderError(
        timedOut
          ? "PalDefender request timed out."
          : "Unable to reach PalDefender.",
        undefined,
        timedOut ? "TIMEOUT" : "CONNECTION_FAILED",
        timedOut,
        { cause: error },
      );
    }
    const body = (await response.json().catch(() => null)) as {
      Error?: { Code?: string; Message?: string };
    } | null;
    if (!response.ok) {
      throw new PalDefenderError(
        body?.Error?.Message ?? `PalDefender returned HTTP ${response.status}.`,
        response.status,
        body?.Error?.Code,
      );
    }
    if (body === null) {
      throw new PalDefenderError(
        "PalDefender returned invalid JSON.",
        502,
        "MALFORMED_RESPONSE",
      );
    }
    return body;
  }
}

function encodePlayerId(playerId: string): string {
  const value = playerId.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new PalDefenderError(
      "The player identifier is invalid.",
      400,
      "INVALID_PLAYER_ID",
    );
  }
  return encodeURIComponent(value);
}

function normalizePlayer(
  player: z.infer<typeof rawPlayerSchema>,
): PalDefenderPlayer {
  return {
    name: player.Name.trim() || "Unknown player",
    playerId: player.PlayerUID,
    online: player.Status.trim().toLowerCase() === "online",
    guild: player.GuildName.trim() || null,
    level: null,
  };
}

function normalizePal(
  instanceId: string,
  pal: z.infer<typeof rawPalSchema>,
  location: PalDefenderPal["location"],
  baseCampId: string | null,
): PalDefenderPal {
  return {
    instanceId,
    location,
    baseCampId,
    palId: pal.PalID,
    nickname: pal.Nickname.trim() || null,
    gender: pal.Gender ?? null,
    level: pal.Level ?? null,
    experience: pal.Exp ?? null,
    shiny: pal.Shiny ?? null,
    rank: pal.PartnerSkillLevel ?? null,
    condensedPals: pal.CondensedPals ?? null,
    physicalHealth: pal.PhysicalHealth ?? null,
    workerSick: pal.WorkerSick ?? null,
    imported: pal.ImportedCharacter ?? null,
    hp: pal.HP ?? null,
    hunger: pal.Hunger ?? null,
    maxHunger: pal.MaxHunger ?? null,
    sanity: pal.SAN ?? null,
    support: pal.Support ?? null,
    craftSpeed: pal.CraftSpeed ?? null,
    palSouls: pal.PalSouls,
    ivs: pal.IVs,
    extraWorkSuitabilities: pal.ExtraWorkSuitabilities,
    disabledWorkPreferences: pal.DisableWorkPreferences,
    passiveSkills: pal.Passives,
    activeSkills: pal.ActiveSkills,
    learnedSkills: pal.LearntSkills,
  };
}
