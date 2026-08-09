# PalCenter Engineering Workflow

These instructions apply to all work in this repository.

## Local pre-PR validation

For normal application feature work, run only the fast local checks needed to catch obvious defects:

- formatting check
- lint
- type checking
- relevant or affected automated tests
- `git diff --check`

Do not routinely run local AMD64 or ARM64 production Docker builds, cross-platform Docker builds, or the complete CI-equivalent Docker validation suite. GitHub Actions is authoritative for those checks after a Draft PR is opened.

Local Docker or image validation is required only when the task changes Dockerfiles, Docker Compose configuration, container packaging, image architecture behavior, build tooling, or runtime image dependencies, or when a GitHub Actions failure specifically requires local reproduction.

## Pull request workflow

For normal feature work:

1. Branch from the latest `origin/dev`.
2. Implement only the scoped change.
3. Run fast local validation.
4. Push the feature branch.
5. Open a Draft PR targeting `dev`.
6. Let GitHub Actions perform full CI and production image validation.
7. Investigate only actual CI failures.
8. Perform required live UAT.
9. Update the PR evidence and status.
10. Stop for project-owner review and merge.

Do not duplicate expensive CI work locally before opening the PR. Never target `main` or merge a PR unless the project owner explicitly directs it.

## PalDefender validation discipline

A PalDefender `VALIDATION_FAILED` response does not establish that an endpoint is broken. Before classifying an endpoint as blocked or provider-defective:

1. Verify the exact documented request schema.
2. Verify every game identifier is an internal ID rather than a friendly or display name.
3. Check known authoritative runtime data where available.
4. Compare the request with existing successful PalCenter and PalDefender conventions.
5. If uncertainty remains, report the exact request and response and ask the project owner before declaring the provider broken.

Do not guess identifiers. Do not mark an issue blocked merely because one live request returns `VALIDATION_FAILED`. Do not move an issue to blocked or Backlog based on an uncertain provider diagnosis without strong evidence.

## Palworld identifiers

Treat friendly or display names and internal game IDs as distinct concepts. Established examples include:

- Foxparks display name → `Kitsunebi` internal Pal ID
- `Arrow` is a valid Technology ID
- `PalEgg_Fire_01` is a valid Fire Egg ID

PalDefender write endpoints generally require the appropriate internal identifiers. Do not substitute friendly names into provider requests unless an authoritative mapping explicitly establishes that behavior.

## Live mutation discipline

For state-changing UAT:

- perform the minimum mutation necessary
- do not retry ambiguous writes automatically
- inspect the exact provider response
- use read-after-write verification where available
- restore reversible owner state when appropriate
- never conclude provider incompatibility from one unverified identifier or input

## Owner-operated live UAT

For any PalCenter feature that changes live Palworld or PalDefender state, the project owner performs the final UAT through the actual PalCenter web UI. Codex must not normally perform the final state-changing action itself.

Codex must:

1. Start or verify the local Palworld and PalDefender test environment.
2. Start or verify the PalCenter feature branch locally.
3. Confirm the required player is connected when applicable.
4. Tell the project owner the local PalCenter URL, server to select, page or workspace to open, feature being tested, and expected result.
5. Stop and explicitly wait for the owner.

The owner uses PalCenter's UI to select or enter the actual values and perform the action. This is especially important for PalID, EggID, TechID, ItemID, template identifiers, player identifiers, base or guild identifiers, and every other game-internal identifier. Do not choose or substitute friendly or display names for internal IDs on the owner's behalf during final UAT.

After the owner performs the action, Codex may inspect PalCenter logs and PalDefender responses, call authoritative read endpoints, verify resulting server or player state, capture appropriate screenshots, and document the result in the PR. Ask the owner for in-game confirmation when the result is only observable or meaningfully verified in the game client.

## Direct provider testing

Direct REST calls, PowerShell, curl, RCON, and similar mechanisms are diagnostic tools, not substitutes for final PalCenter UAT. Use direct provider testing when necessary to isolate whether a failure originates in PalCenter, request serialization, incorrect identifiers or input, PalDefender, or the game server.

When PalCenter UAT fails with `VALIDATION_FAILED` or another unclear provider error:

1. Preserve the exact request and response.
2. Do not immediately declare the provider broken.
3. Do not automatically retry.
4. Verify identifiers and the request contract.
5. Ask the project owner when input validity is uncertain.
6. Use a direct REST comparison when needed.

Once the cause is corrected, final UAT must still be repeated through the PalCenter UI.

## Terminology

In user-facing progress reports and UAT instructions, prefer natural administrative terms such as action, operation, change, grant, ban or unban, learn or forget, send, and delete. Avoid repeatedly calling ordinary game or server administrative actions "mutations." Technical code and tests may continue using "mutation" where that is the established software or API terminology.
