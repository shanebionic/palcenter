import type { UserRole } from "../types/users.js";

// Least-privilege PalDefender permission profiles derived from PalCenter's
// EXPLICIT authorization rules (not the generic non-GET fallback). Every
// permission traces to a PalCenter route/capability, the PalCenter
// permission guarding that route, and the roles eligible for it.
//
// Read class (PalCenter permission `read`; all roles):
//   GET  /paldefender/players                  -> moderator, visitor, administrator -> REST.Players.Read
//   GET  /paldefender/players/:id              -> all -> REST.Player.Read
//   GET  /paldefender/players/:id/inventory    -> all -> REST.Items.Read
//   GET  /paldefender/players/:id/pals         -> all -> REST.Pals.Read
//   GET  /paldefender/players/:id/technology   -> all -> REST.Techs.Read
//   GET  /paldefender/players/:id/progression  -> all -> REST.Progression.Read
//   GET  /paldefender/guilds (source of the base list)   -> all -> REST.Guilds.Read
//   GET  /paldefender/guilds/:id (source of base detail) -> all -> REST.Guild.Read
//   GET  /moderation (ban list)                -> all -> REST.Banlist.Read
//
// Operate class (PalCenter permission `operate`; moderator, administrator):
//   POST /paldefender/players/:id/kick            -> REST.Punishments.Kick
//   POST /paldefender/players/:id/ban             -> REST.Punishments.Ban
//        (special case: the route's optional IP flag additionally requires
//         REST.Punishments.BanIP, which is therefore granted here too)
//   POST /moderation/users/:id/unban              -> REST.Punishments.Unban
//   POST /moderation/ip/ban                       -> REST.Punishments.BanIP
//   POST /moderation/ip/unban                     -> REST.Punishments.UnbanIP
//   POST /paldefender/players/:id/items           -> REST.Items.Give
//   POST /paldefender/players/:id/pals            -> REST.Pals.Give
//   POST /paldefender/players/:id/pal-templates   -> REST.PalTemplates.Give
//   POST /paldefender/players/:id/pal-eggs        -> REST.PalEggs.Give
//   POST /paldefender/players/:id/progression     -> REST.Progression.Give
//   POST /paldefender/players/:id/technology/learn   -> REST.Techs.Learn
//   POST /paldefender/players/:id/technology/forget  -> REST.Techs.Forget
//   POST /paldefender/broadcast                   -> REST.Messages.Broadcast
//   POST /paldefender/alert                       -> REST.Messages.Alert
//   POST /paldefender/player-message (route exposes all six send types)
//        -> REST.Messages.Send.PlayerChat, REST.Messages.Send.GlobalChat,
//           REST.Messages.Send.GuildChat, REST.Messages.Send.Log.Normal,
//           REST.Messages.Send.Log.Important, REST.Messages.Send.Log.VeryImportant
//
// Manage-servers class (PalCenter permission `manage_servers`; administrator):
//   POST /paldefender/bases/:id/delete -> REST.Base.Delete
//   POST /paldefender/reload-config    -> REST.Reload.Config
//
// Deliberately excluded from every generated profile:
//   REST.Version.Read - status probes and connection tests always use the
//     server-default token; no user-token code path calls /version.
//   REST.* - never generated for user credentials.

export const VISITOR_PERMISSIONS = [
  "REST.Banlist.Read",
  "REST.Guild.Read",
  "REST.Guilds.Read",
  "REST.Items.Read",
  "REST.Pals.Read",
  "REST.Player.Read",
  "REST.Players.Read",
  "REST.Progression.Read",
  "REST.Techs.Read",
] as const;

export const MODERATOR_PERMISSIONS = [
  ...VISITOR_PERMISSIONS,
  "REST.Items.Give",
  "REST.Messages.Alert",
  "REST.Messages.Broadcast",
  "REST.Messages.Send.GlobalChat",
  "REST.Messages.Send.GuildChat",
  "REST.Messages.Send.Log.Important",
  "REST.Messages.Send.Log.Normal",
  "REST.Messages.Send.Log.VeryImportant",
  "REST.Messages.Send.PlayerChat",
  "REST.Pals.Give",
  "REST.PalEggs.Give",
  "REST.PalTemplates.Give",
  "REST.Progression.Give",
  "REST.Punishments.Ban",
  "REST.Punishments.BanIP",
  "REST.Punishments.Kick",
  "REST.Punishments.Unban",
  "REST.Punishments.UnbanIP",
  "REST.Techs.Forget",
  "REST.Techs.Learn",
] as const;

export const ADMINISTRATOR_PERMISSIONS = [
  ...MODERATOR_PERMISSIONS,
  "REST.Base.Delete",
  "REST.Reload.Config",
] as const;

const PERMISSIONS_BY_ROLE: Record<UserRole, readonly string[]> = {
  visitor: VISITOR_PERMISSIONS,
  moderator: MODERATOR_PERMISSIONS,
  administrator: ADMINISTRATOR_PERMISSIONS,
};

export function permissionsForRole(role: UserRole): readonly string[] {
  return PERMISSIONS_BY_ROLE[role];
}
