import assert from "node:assert/strict";
import test from "node:test";
import {
  serverRemovalDescription,
  serverRemovalTitle,
} from "../lib/server-removal";

test("removal confirmation names the server and states the remote server is untouched", () => {
  assert.equal(
    serverRemovalTitle("Island One"),
    "Remove “Island One” from PalCenter?",
  );
  assert.match(serverRemovalDescription, /saved server connection/);
  assert.match(serverRemovalDescription, /PalCenter-managed data/);
  assert.match(
    serverRemovalDescription,
    /does not stop, uninstall, or delete the remote Palworld server/,
  );
  assert.match(serverRemovalDescription, /world files/);
});
