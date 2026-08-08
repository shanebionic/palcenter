import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalPlayerId,
  matchPalDefenderPlayer,
} from "../lib/player-identity";

test("matches native and PalDefender players by stable PlayerUID without display names", () => {
  const native = {
    name: "Native Name",
    playerId: "0094A2FA000000000000000000000000",
    userId: "platform-private",
    ip: "192.0.2.1",
    status: "online" as const,
  };
  const enhanced = [
    {
      name: "Different Display Name",
      playerId: "0094A2FA-00000000-00000000-00000000",
      online: true,
      guild: "Guild",
      level: 42,
    },
  ];

  assert.equal(
    canonicalPlayerId(native.playerId),
    canonicalPlayerId(enhanced[0]!.playerId),
  );
  assert.equal(matchPalDefenderPlayer(native, enhanced), enhanced[0]);
});

test("does not merge players merely because their display names match", () => {
  const native = {
    name: "Same Name",
    playerId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    userId: "native-user",
    ip: null,
    status: "online" as const,
  };
  const enhanced = [
    {
      name: "Same Name",
      playerId: "bbbbbbbb-bbbbbbbb-bbbbbbbb-bbbbbbbb",
      online: true,
      guild: null,
      level: null,
    },
  ];

  assert.equal(matchPalDefenderPlayer(native, enhanced), undefined);
});
