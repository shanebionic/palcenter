import assert from "node:assert/strict";
import test from "node:test";
import {
  serverConnectionPayload,
  untestedConnectionWarning,
} from "../lib/server-connection";

test("blank connection passwords are omitted while replacements are submitted", () => {
  assert.deepEqual(
    serverConnectionPayload({
      name: "Server",
      baseUrl: "http://server.example:8212",
      adminPassword: "",
    }),
    {
      name: "Server",
      baseUrl: "http://server.example:8212",
    },
  );
  assert.deepEqual(
    serverConnectionPayload({
      name: "Server",
      baseUrl: "https://server.example:9443",
      adminPassword: "replacement",
    }),
    {
      name: "Server",
      baseUrl: "https://server.example:9443",
      adminPassword: "replacement",
    },
  );
  assert.match(untestedConnectionWarning, /server that is currently offline/i);
});
