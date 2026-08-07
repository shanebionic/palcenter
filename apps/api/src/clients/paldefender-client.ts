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
const coordinateSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
const rawGuildSchema = z.object({
  name: z.string(),
  Level: z.number().int(),
  admin: z.object({ id: z.string(), name: z.string() }),
  camp_count: z.number().int().nonnegative(),
  camps: z.array(
    z.object({
      id: z.string(),
      world_pos: coordinateSchema,
      map_pos: coordinateSchema,
    }),
  ),
  member_count: z.number().int().nonnegative(),
  members: z.array(z.string()),
});
const guildListResponseSchema = z.object({
  Guilds: z.record(rawGuildSchema),
});
const guildMemberSchema = z.object({
  player_uid: z.string(),
  player_name: z.string(),
  status: z.string(),
});
const guildCampPalSchema = z.object({
  nickname: z.string(),
  pal_id: z.string(),
  npc_id: z.string(),
  skin_id: z.string(),
  gender: z.string(),
  level: z.number().int(),
  shiny: z.boolean(),
  phisical_health: z.string(),
  worker_sick: z.string(),
  san: z.number(),
  imported: z.boolean(),
  friendship: z.number().int(),
  active_skills: z.array(z.string()),
  learnt_skills: z.array(z.string()),
  passives: z.array(z.string()),
});
const guildCampSchema = z.object({
  id: z.string(),
  level: z.number().int(),
  world_pos: coordinateSchema,
  map_pos: coordinateSchema,
  state: z.string(),
  pals: z.record(guildCampPalSchema),
  buildings: z.string(),
});
const guildItemSlotSchema = z.object({
  item_id: z.string(),
  count: z.number().int(),
});
const guildItemsSchema = z
  .object({
    container_id: z.string().optional().default(""),
    current: z.number().int().nonnegative(),
    max: z.number().int().nonnegative(),
  })
  .passthrough();
const guildDetailsResponseSchema = z.object({
  Guild: z.object({
    name: z.string(),
    Level: z.number().int(),
    admin: z.object({ id: z.string(), name: z.string() }),
    member_count: z.number().int().nonnegative(),
    members: z.array(guildMemberSchema),
    camp_count: z.number().int().nonnegative(),
    camps: z.array(guildCampSchema),
    items: guildItemsSchema,
    expeditions: z.object({
      finished: z.number().int().nonnegative(),
      missions: z.record(z.boolean()),
    }),
    laboratory: z.object({
      current_research: z.string(),
      researches: z.record(
        z.object({
          work_amount: z.number(),
          required_work_amount: z.number(),
          percentage: z.number(),
        }),
      ),
    }),
  }),
});
const kickResponseSchema = z.object({
  Success: z.boolean(),
  UserId: z.string(),
});
const banResponseSchema = z.object({
  Success: z.boolean(),
  UserId: z.string(),
  IP: z.boolean(),
  BannedIP: z.string(),
  Kicked: z.number().int().nonnegative(),
});
const broadcastResponseSchema = z.object({ Success: z.boolean() });

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
export interface PalDefenderBanOptions {
  reason?: string;
  ipBan?: boolean;
}
export interface PalDefenderBanResult {
  success: boolean;
  playerId: string;
  ipBanned: boolean;
  bannedIp: string | null;
  kickedPlayers: number;
}
export interface PalDefenderBroadcastResult {
  success: boolean;
}
export interface PalDefenderGuildCamp {
  id: string;
  worldPosition: { x: number; y: number; z: number };
  mapPosition: { x: number; y: number; z: number };
}
export interface PalDefenderGuild {
  guildId: string;
  name: string | null;
  level: number;
  administrator: { playerId: string; name: string | null };
  baseCount: number;
  camps: PalDefenderGuildCamp[];
  memberCount: number;
  memberIds: string[];
}
export interface PalDefenderBase {
  baseId: string;
  guildId: string;
  guildName: string | null;
  guildAdministrator: { playerId: string; name: string | null };
  worldPosition: { x: number; y: number; z: number };
  mapPosition: { x: number; y: number; z: number };
}
export interface PalDefenderBaseDetails extends PalDefenderBase {
  level: number;
  state: string | null;
  buildings: string | null;
  pals: PalDefenderGuildDetails["camps"][number]["pals"];
}
export interface PalDefenderGuildDetails {
  guildId: string;
  name: string | null;
  level: number;
  administrator: { playerId: string; name: string | null };
  memberCount: number;
  members: Array<{
    playerId: string;
    name: string | null;
    status: string | null;
  }>;
  baseCount: number;
  camps: Array<{
    id: string;
    level: number;
    state: string | null;
    worldPosition: { x: number; y: number; z: number };
    mapPosition: { x: number; y: number; z: number };
    buildings: string | null;
    pals: Array<{
      instanceId: string;
      palId: string;
      nickname: string | null;
      npcId: string | null;
      skinId: string | null;
      gender: string | null;
      level: number;
      shiny: boolean;
      physicalHealth: string | null;
      workerSick: string | null;
      sanity: number;
      imported: boolean;
      friendship: number;
      activeSkills: string[];
      learnedSkills: string[];
      passiveSkills: string[];
    }>;
  }>;
  storage: {
    containerId: string | null;
    occupiedSlots: number;
    maximumSlots: number;
    items: Array<{ slot: number; itemId: string; quantity: number }>;
  };
  expeditions: { finishedCount: number; missions: Record<string, boolean> };
  laboratory: {
    currentResearch: string | null;
    researches: Array<{
      researchId: string;
      workAmount: number;
      requiredWorkAmount: number;
      percentage: number;
    }>;
  };
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

  async getGuilds(): Promise<PalDefenderGuild[]> {
    const response = await this.parse(guildListResponseSchema, "/guilds");
    return Object.entries(response.Guilds).map(([guildId, guild]) => ({
      guildId,
      name: guild.name.trim() || null,
      level: guild.Level,
      administrator: {
        playerId: guild.admin.id,
        name: guild.admin.name.trim() || null,
      },
      baseCount: guild.camp_count,
      camps: guild.camps.map((camp) => ({
        id: camp.id,
        worldPosition: camp.world_pos,
        mapPosition: camp.map_pos,
      })),
      memberCount: guild.member_count,
      memberIds: guild.members,
    }));
  }

  async getBases(): Promise<PalDefenderBase[]> {
    const guilds = await this.getGuilds();
    return guilds.flatMap((guild) =>
      guild.camps.map((camp) => ({
        baseId: camp.id,
        guildId: guild.guildId,
        guildName: guild.name,
        guildAdministrator: guild.administrator,
        worldPosition: camp.worldPosition,
        mapPosition: camp.mapPosition,
      })),
    );
  }

  async getBase(baseId: string): Promise<PalDefenderBaseDetails> {
    const guild = (await this.getGuilds()).find((candidate) =>
      candidate.camps.some((camp) => camp.id === baseId),
    );
    if (!guild) {
      throw new PalDefenderError("Base not found", 404, "BASE_NOT_FOUND");
    }

    const details = await this.getGuild(guild.guildId);
    const camp = details.camps.find((candidate) => candidate.id === baseId);
    if (!camp) {
      throw new PalDefenderError("Base not found", 404, "BASE_NOT_FOUND");
    }

    return {
      baseId: camp.id,
      guildId: details.guildId,
      guildName: details.name,
      guildAdministrator: details.administrator,
      worldPosition: camp.worldPosition,
      mapPosition: camp.mapPosition,
      level: camp.level,
      state: camp.state,
      buildings: camp.buildings === "WIP" ? null : camp.buildings,
      pals: camp.pals,
    };
  }

  async getGuild(guildId: string): Promise<PalDefenderGuildDetails> {
    const response = await this.parse(
      guildDetailsResponseSchema,
      `/guild/${encodeGuildId(guildId)}`,
    );
    const guild = response.Guild;
    const items = Object.entries(guild.items).flatMap(([slot, value]) => {
      if (!/^\d+$/.test(slot)) return [];
      const parsed = guildItemSlotSchema.safeParse(value);
      return parsed.success
        ? [
            {
              slot: Number(slot),
              itemId: parsed.data.item_id,
              quantity: parsed.data.count,
            },
          ]
        : [];
    });
    return {
      guildId,
      name: guild.name.trim() || null,
      level: guild.Level,
      administrator: {
        playerId: guild.admin.id,
        name: guild.admin.name.trim() || null,
      },
      memberCount: guild.member_count,
      members: guild.members.map((member) => ({
        playerId: member.player_uid,
        name: member.player_name.trim() || null,
        status: member.status.trim() || null,
      })),
      baseCount: guild.camp_count,
      camps: guild.camps.map((camp) => ({
        id: camp.id,
        level: camp.level,
        state: camp.state.trim() || null,
        worldPosition: camp.world_pos,
        mapPosition: camp.map_pos,
        buildings: camp.buildings.trim() || null,
        pals: Object.entries(camp.pals).map(([instanceId, pal]) => ({
          instanceId,
          palId: pal.pal_id,
          nickname: pal.nickname.trim() || null,
          npcId: pal.npc_id.trim() || null,
          skinId: pal.skin_id.trim() || null,
          gender: pal.gender.trim() || null,
          level: pal.level,
          shiny: pal.shiny,
          physicalHealth: pal.phisical_health.trim() || null,
          workerSick: pal.worker_sick.trim() || null,
          sanity: pal.san,
          imported: pal.imported,
          friendship: pal.friendship,
          activeSkills: pal.active_skills,
          learnedSkills: pal.learnt_skills,
          passiveSkills: pal.passives,
        })),
      })),
      storage: {
        containerId: guild.items.container_id.trim() || null,
        occupiedSlots: guild.items.current,
        maximumSlots: guild.items.max,
        items,
      },
      expeditions: {
        finishedCount: guild.expeditions.finished,
        missions: guild.expeditions.missions,
      },
      laboratory: {
        currentResearch:
          guild.laboratory.current_research.trim() === "None"
            ? null
            : guild.laboratory.current_research.trim() || null,
        researches: Object.entries(guild.laboratory.researches).map(
          ([researchId, research]) => ({
            researchId,
            workAmount: research.work_amount,
            requiredWorkAmount: research.required_work_amount,
            percentage: research.percentage,
          }),
        ),
      },
    };
  }

  async kickPlayer(
    playerId: string,
    message?: string,
  ): Promise<PalDefenderKickResult> {
    const response = await this.moderatePlayer(
      kickResponseSchema,
      "kick",
      playerId,
      message?.trim() ? { Reason: message.trim() } : {},
    );
    return { success: response.Success, playerId };
  }

  async banPlayer(
    playerId: string,
    options: PalDefenderBanOptions = {},
  ): Promise<PalDefenderBanResult> {
    const response = await this.moderatePlayer(
      banResponseSchema,
      "ban",
      playerId,
      {
        ...(options.reason?.trim() ? { Reason: options.reason.trim() } : {}),
        ...(options.ipBan ? { IP: true } : {}),
      },
    );
    return {
      success: response.Success,
      playerId,
      ipBanned: response.IP,
      bannedIp: response.BannedIP.trim() || null,
      kickedPlayers: response.Kicked,
    };
  }

  async broadcast(message: string): Promise<PalDefenderBroadcastResult> {
    const response = await this.parse(broadcastResponseSchema, "/Broadcast", {
      method: "POST",
      body: JSON.stringify({ Message: message }),
    });
    return { success: response.Success };
  }

  private moderatePlayer<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    action: "kick" | "ban",
    playerId: string,
    body: Record<string, string | boolean>,
  ): Promise<z.infer<TSchema>> {
    return this.parse(schema, `/${action}/${encodePlayerId(playerId)}`, {
      method: "POST",
      body: JSON.stringify(body),
    });
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

function encodeGuildId(guildId: string): string {
  const value = guildId.trim();
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new PalDefenderError(
      "The guild identifier is invalid.",
      400,
      "INVALID_GUILD_ID",
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
