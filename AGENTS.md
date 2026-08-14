# PalCenter Agent Rules

These rules apply to all coding agents working in this repository.

## 1. Authority

- Current repository source is authoritative for implementation state.
- GitHub issues, pull requests, Actions, and Project state are authoritative for tracked work.
- This file is authoritative for agent workflow.
- The project owner makes product/design decisions and performs final live UAT.
- Do not invent requirements, identifiers, provider behavior, or repository state.
- If evidence is ambiguous and the answer affects product behavior, ask the owner.

## 2. Git Workflow

Normal development flow:

`origin/dev -> feature/fix branch -> PR to dev -> CI -> merge to dev -> owner UAT`

Before editing:

1. Check `git status`. Do not overwrite unexpected uncommitted work.
2. Run `git fetch origin`.
3. Switch to local `dev`.
4. Fast-forward from `origin/dev` using `--ff-only`.
5. Verify local `dev` matches `origin/dev`.
6. Create a fresh feature/fix/docs branch from current `dev`.
7. Verify the branch and working tree before editing.

Rules:

- Never develop directly on `dev` or `main`.
- Never target `main` during normal development.
- Never discard unknown work with destructive reset, restore, or stash operations.
- Git operations must be CLI-only and non-interactive.
- Provide commit messages with `-m`; do not launch editors.
- Reuse an existing PR for a branch instead of creating duplicates.
- Never merge a PR, promote `dev -> main`, tag, or release without explicit owner authorization.

## 3. Scope Discipline

- Implement only the requested scope.
- Do not perform unrelated refactors or cleanup.
- Avoid modifying already UAT-approved behavior unless required by the task.
- If a pre-existing lint, test, build, or formatting failure blocks validation, report it instead of silently broadening scope.
- Fix pre-existing problems only when required to complete the requested task.
- Do not invent requirements to resolve uncertainty.

## 4. Mandatory Formatting and Validation

Formatting is part of implementation, not a CI cleanup step.

### Before every commit or push

1. Identify every modified Prettier-managed file.
2. Run Prettier in **write mode** on those files:

```bash
pnpm exec prettier --write <modified files>
```

3. Run the complete local validation gate:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
git diff --check
```

4. Review the final `git diff`.
5. Commit or push only when all applicable checks pass.

### Formatting rules

- `prettier --check` and `pnpm format:check` only detect formatting problems.
- A check does not replace the required `prettier --write` step.
- Do not rely on editor auto-formatting, visual inspection, or GitHub Actions to format files.
- If the agent creates or modifies a Prettier-managed file, the agent owns the resulting formatting of that file.
- The write step is required even for small or apparently formatting-neutral changes.
- If files are modified after validation, format them again and rerun the applicable final validation before pushing.
- Never knowingly push a locally failing validation result merely to see what CI reports.
- Never claim a validation command passed unless it actually completed successfully.

### Docker validation

Do not routinely run production AMD64/ARM64 Docker builds locally. GitHub Actions is authoritative for full image validation.

Run relevant local Docker/image validation when changing:

- `Dockerfile`;
- Docker Compose configuration;
- container/runtime dependencies;
- multi-stage build behavior;
- image/base-image configuration;
- CI/container build workflows;

or when reproducing a relevant CI failure.

## 5. Issues and Project Tracking

Every feature or fix should maintain its associated GitHub tracking when applicable.

For new tracked work:

1. Create the issue with clear scope.
2. Add it to the PalCenter Roadmap.
3. Set appropriate Status and Priority.
4. Read the Project item back and verify its state.

For existing work:

- Confirm the existing issue and scope.
- Do not create duplicate issues.
- Do not close an issue merely because code exists.
- If only part of an issue/PR scope is complete, close only completed work and preserve incomplete work accurately.

## 6. Pull Request Workflow

For normal implementation work:

1. Branch from current `origin/dev`.
2. Implement only the scoped change.
3. Format modified files.
4. Run local validation.
5. Commit and push.
6. Open a Draft PR targeting `dev`.
7. Link completed issues using one closing keyword per line:

```text
Closes #<issue>
```

8. Verify GitHub recognizes the closing-issue relationship.
9. Let GitHub Actions perform full CI.
10. Investigate actual CI failures.
11. Complete required UAT.
12. Update PR, issue, and Project state as appropriate.
13. Report final status.

Do not duplicate expensive CI work locally unless required by the change or needed to diagnose a failure.

### CI failures

When CI fails:

1. Inspect the specific failing job/log.
2. Determine whether the failure was caused by the current change.
3. Do not blindly retry.
4. Fix the narrow cause.
5. Do not change correct production behavior merely to satisfy a stale test.
6. If intentional behavior changed, update the appropriate test.
7. Format any newly modified files again.
8. Rerun the applicable local validation gate.
9. Push and verify CI again.

## 7. Merge Authorization

Never merge a pull request without explicit owner authorization.

This applies even when:

- local validation passes;
- CI is green;
- automated tests pass;
- UAT passes;
- the PR is marked ready.

Likewise, never promote `dev -> main`, create a release tag, publish a release, or perform release promotion without explicit owner authorization.

## 8. Live UAT

The owner performs final live UAT for user-visible behavior and operations affecting live Palworld or PalDefender state.

When owner-operated UAT is required, prepare the environment and provide:

- URL/server to use;
- page or feature to open;
- exact action to perform;
- expected result.

Then stop when owner interaction is required.

After owner action, the agent may:

- inspect logs;
- call authoritative read endpoints;
- verify resulting server/player state;
- capture diagnostic evidence;
- update PR evidence.

Ask the owner for in-game confirmation when the result is meaningfully observable only in the game client.

### Existing UAT Environment

A reusable local UAT environment already exists at:

`C:\Development\uat-tools\uat`

Use this environment for runtime UI validation instead of creating a new
Palworld/PalDefender test environment from scratch.

It contains the established UAT tooling for:

- the Palworld test server;
- PalDefender;
- the PalCenter UAT container/runtime.

Before creating new test infrastructure, inspect and use the existing UAT
environment and its documented configuration.

The UAT environment may not have a live connected player. This limits only
player-dependent validation. It does not prevent validation of map rendering,
bases, navigation, Layers controls, fullscreen/expanded behavior, PalDefender
data that does not require an online player, or other available workflows.

Temporary PalCenter containers/images created while validating a branch may be
recreated as needed. Do not destroy or reset the reusable Palworld/PalDefender
UAT environment unless explicitly authorized by the owner.

### State-changing diagnostics

For diagnostic actions that modify live state:

- perform the minimum write necessary;
- do not automatically retry ambiguous writes;
- inspect the exact provider response;
- use read-after-write verification where available;
- restore reversible owner state when appropriate.

Direct REST calls, PowerShell, curl, RCON, and similar tools are diagnostic tools. They do not replace final PalCenter UI UAT when UI behavior is being accepted.

## 9. PalDefender Provider Rules

When PalDefender is configured, it is authoritative for functionality and data it provides.

### Provider authority

- If PalDefender is configured and provides the required capability, use PalDefender.
- If configured PalDefender is unavailable or a PalDefender request fails, expose the failure.
- Do not silently fall back to Native REST when configured PalDefender fails.
- Native REST may still provide functionality that PalDefender does not provide.
- When PalDefender is not configured, use supported Native REST functionality.

This behavior is intentional: silent fallback can conceal a broken or unhealthy PalDefender configuration from the server administrator.

### PalDefender validation

Do not guess internal game identifiers.

Display/friendly names and internal IDs are distinct unless authoritative mapping proves otherwise.

A PalDefender `VALIDATION_FAILED` response alone does not prove that PalDefender or an endpoint is broken.

Before classifying a provider defect:

1. Verify the documented/requested schema.
2. Verify internal identifiers.
3. Check authoritative runtime data where available.
4. Compare against existing successful PalCenter/PalDefender conventions.
5. Preserve the exact request and response.
6. Ask the owner if validity remains uncertain.

Do not move work to Blocked/Backlog based solely on an uncertain provider diagnosis.

## 10. Post-UAT Completion

After the owner explicitly reports successful UAT and the implementation is merged into `dev`:

1. Close completed linked GitHub issues with reason `completed`.
2. Set each completed issue's PalCenter Roadmap Status to Done.
3. Re-read each Project item and verify Status is actually Done.
4. Verify PR-to-issue linkage.
5. Verify parent/sub-issue progress when applicable.
6. Remove obsolete workflow/blocking labels where appropriate.
7. Report the resulting state.

Issue state and Project state are independent:

- GitHub issue must be closed as completed.
- Roadmap item must independently be verified as Done.

Do not merge unrelated PRs or perform release actions as part of post-UAT bookkeeping.

## 11. Tools and Workspace

Use the simplest authoritative tool for the task.

Preferred tools:

- **GitHub MCP:** GitHub issues, PRs, Actions, repository metadata, and supported mutations.
- **gh CLI / GitHub GraphQL:** only when GitHub MCP lacks the required capability, especially Projects v2 operations.
- **Playwright MCP:** rendered UI/browser behavior and targeted UI automation.
- **Context7:** uncertain or version-sensitive framework/library documentation.
- **Native shell/tools:** repository files, search, Git, formatting, linting, tests, and builds.

Rules:

- Repository/project behavior comes from PalCenter source, documentation, this file, and GitHub state.
- Do not substitute HTTP clients for browser validation when rendered UI behavior is what must be tested.
- Keep generated artifacts such as `.playwright-mcp/` untracked.
- Use the canonical repository under `C:\Development`.
- Do not create arbitrary clones, worktrees, or project copies elsewhere.
- Clean up development servers, processes, containers, and browser sessions created for testing unless the owner asks to keep them running.

## 12. Execution Persistence

Once implementation is authorized, continue through routine executable steps without stopping after individual:

- searches;
- file reads;
- edits;
- commands;
- tests;
- tool results.

Stop when:

- the requested task is complete;
- a concrete blocker exists;
- owner UAT/action is required;
- explicit merge/release authorization is required;
- an ambiguous product/design decision requires owner input;
- continuing risks destructive or irreversible action.

Do not stop after planning when the owner requested implementation and executable work remains.

## 13. Release Workflow

Release preparation is separate from normal development.

At release hardening:

1. Stop unrelated feature work.
2. Reconcile `CHANGELOG.md` and `RELEASE_NOTES.md` against actual Git/GitHub history.
3. Verify README/user documentation when release changes affect operators.
4. Verify release version and metadata.
5. Run the repository's release validation.
6. Obtain owner release-candidate UAT.
7. Promote `dev -> main` only with owner authorization.
8. Tag/release only with owner authorization.

Never merge `dev -> main`, create a release tag, trigger a GitHub Release, or publish release artifacts without explicit owner authorization.

## 14. Communication

Owner-facing documentation, reports, and UAT instructions should use clear Palworld server-administration language.

Prefer terms such as:

- action;
- operation;
- grant;
- kick;
- ban/unban;
- send;
- delete;
- learn/forget;
- server administration.

Avoid unnecessary internal engineering jargon in user-facing text. Technical code/tests may retain established technical terminology.
