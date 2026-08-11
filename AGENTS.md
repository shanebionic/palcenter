# PalCenter Engineering Workflow

These instructions apply to all autonomous coding agents working on this repository.

## Role and Authority

- The repository and current source code are authoritative for implementation state.
- GitHub issues, pull requests, and project state are authoritative for tracked work.
- This document is authoritative for agent workflow and repository operating rules.
- The project owner makes product and design decisions and performs final live UAT.
- When repository or GitHub evidence is unclear, ask the owner rather than guessing.

Do not invent requirements. Do not assume stale assumptions are current when contradicting evidence exists.

## Source Control Baseline

Before beginning any implementation or documentation work:

1. Inspect `git status` and protect existing uncommitted work if present.
2. Run `git fetch origin`.
3. Switch to local `dev`.
4. Fast-forward local `dev` from `origin/dev` using a non-interactive `--ff-only` operation.
5. Verify local `dev` matches current `origin/dev`.
6. Create and switch to a fresh appropriately named feature, fix, or docs branch.
7. Verify that the new branch is based on current `origin/dev`.

Only then begin editing.

If the working tree is unexpectedly dirty, stop and determine why before changing repository state.

Never use destructive reset, restore, or stash operations to accomplish this baseline workflow. Never:

- Commit feature work directly onto local `dev`.
- Begin editing before updating `dev` and creating the branch.
- Assume local `dev` is current because it was current earlier in the session.

## Non-Interactive Git

All autonomous Git operations must be CLI-only and non-interactive:

- Provide commit messages via `-m`.
- Use non-interactive rebase/merge methods when appropriate.
- Avoid commands that launch an editor (interactive rebase, `git commit` without `-m`, etc.).
- Never leave a task waiting on a GUI or editor process it cannot control.

## Execution Persistence

Once a task is approved for execution, continue through the requested workflow rather than stopping after every intermediate tool call.

Do not end a turn merely because:

- a file read completed;
- a grep or search completed;
- a tool returned results;
- analysis steps produced output that requires further action to complete the task.

Continue automatically until:

- the requested task is fully complete;
- a concrete blocker exists (missing credentials, permissions failure, unavailable service);
- owner authorization is explicitly required (final live UAT, merge, release tag);
- an ambiguous product or design decision genuinely needs owner input;
- continuing would risk destructive irreversible action.

Do not stop after planning when executable requested steps remain.

## Tool Selection

Use the correct tool for each operation. Avoid redundancy when built-in tools already cover the task.

**GitHub MCP:** issues, pull requests, GitHub Actions status, repository metadata, and other supported GitHub reads and mutations. Prefer GitHub MCP for all operations it supports.

**gh CLI / GitHub GraphQL:** use only where GitHub MCP lacks the required capability, especially PalCenter Roadmap Projects v2 field updates (Status, Priority) and adding issues to projects. Use the maintained Projects v2 helper script when available; do not rediscover schema or IDs from scratch each time.

**Playwright MCP:** rendered UI inspection, browser behavior verification, navigation checks, targeted UI automation. Generated `.playwright-mcp/` artifacts must remain untracked by git.

**Context7:** current version-sensitive framework and library documentation (Next.js, React, Fastify, TypeScript, etc.). Use when implementation depends on uncertain or potentially stale framework behavior. Repository and project-specific rules always come from PalCenter source code, documentation, AGENTS.md, and GitHub state—not Context7.

**Native tools / shell:** repository file operations, content search, edits, Git CLI, package scripts, build/test/lint/format commands.

Do not use gh CLI as a default substitute when a corresponding GitHub MCP tool is available.

## Validation

For normal application feature work, run only the fast local checks needed to catch obvious defects before opening a PR:

```bash
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
git diff --check
```

Review the final `git diff` for correctness.

Do not routinely run local AMD64 or ARM64 production Docker builds, cross-platform Docker builds, or the complete CI-equivalent Docker validation suite. GitHub Actions is authoritative for those checks after a Draft PR is opened.

Local Docker or image validation is required only when the task modifies `Dockerfile`, Docker Compose configuration, multi-stage build steps, base image versions, CI workflow files, or runtime container dependencies. It is also required when a GitHub Actions failure specifically demands local reproduction.

Do not claim validation passed unless each command actually completed without error.

## Issue Lifecycle

Every feature and fix must maintain its GitHub issue tracking throughout development.

### Creating a new issue

When creating a new implementation or stabilization issue:

1. Create the GitHub issue with clear scope.
2. Add it to the PalCenter Roadmap project.
3. Set the appropriate initial Status field.
4. Set Priority according to established PalCenter conventions when applicable.
5. Read the project item back and verify it is present with expected fields.

Creating the issue alone is not complete project bookkeeping. Do not proceed with implementation until project state is verified, unless the owner explicitly authorizes proceeding due to temporary GitHub Projects or bookkeeping unavailability.

### Before development

For work associated with existing issues:

1. Confirm issue numbers and scope.
2. Branch from the latest `origin/dev` (see Source Control Baseline).
3. Do not create duplicate issues for existing work.

### Partial or blocked scope

If a PR contains multiple issues and only some are successfully completed:

- close and move to Done only the completed issues
- leave blocked or incomplete issues open
- preserve appropriate Project status and labels
- document the distinction in the PR

Never close an issue merely because code exists if required live UAT failed or the feature remains blocked.

## Pull Request Workflow

For normal feature work:

1. Branch from current `origin/dev` (see Source Control Baseline).
2. Implement only the scoped change (see Scope Discipline).
3. Run local validation.
4. Commit and push the feature branch.
5. Open a Draft PR targeting `dev`.
6. Link associated issues by including one closing keyword per line in the PR body:

   ```text
   Closes #<issue>
   Closes #<issue>
   ```

7. Verify that GitHub recognizes the link (check `closingIssuesReferences` via the API or MCP). Mentioning an issue number in prose is not sufficient.
8. Let GitHub Actions perform full CI validation. Investigate only actual CI failures (see CI Failure Discipline).
9. Perform required live UAT.
10. Update the PR evidence, set related issues to Review status when implementation and required UAT are complete, and mark the PR as ready for review.
11. Report the final state.

At the end of feature work, report:

- PR number
- target branch
- linked issue numbers
- issue Project status
- UAT status
- GitHub Actions status
- whether the PR is ready for owner merge

Do not duplicate expensive CI work locally before opening the PR. Avoid duplicate PRs; if one already exists for the branch, update it instead of creating another. Do not target `main`.

## Merge Authorization

Never merge a pull request or publish a release unless the project owner explicitly directs or authorizes it. This rule applies at every stage: after CI passes, after UAT succeeds, and during post-merge housekeeping.

Do not create an additional PR for post-merge issue and project bookkeeping; perform those updates directly.

## CI Failure Discipline

When GitHub Actions fails on a change you pushed:

1. Inspect the specific failing job log.
2. Determine whether the failure was caused by your change or is pre-existing/environmental.
3. Do not blindly retry.
4. Do not modify production implementation solely to satisfy a stale test.
5. If intentional behavior changed, update the relevant test rather than reverting the feature.
6. Keep any fix narrowly scoped to the failure cause.
7. Re-run or verify CI passes after the fix.

Ask the owner only when causality or correct product behavior is genuinely ambiguous.

## Live UAT and Post-UAT Lifecycle

The project owner performs final live UAT for user-visible changes that affect Palworld server state. Owner live UAT is the acceptance gate.

After the owner explicitly reports successful live UAT:

1. Verify the implementation is merged into `dev`.
2. Close all linked completed GitHub issues with `state_reason` set to `"completed"`.
3. For each completed issue, read its PalCenter Roadmap Projects v2 Status field. Closing a GitHub issue does NOT automatically update the project Status field.
4. If any completed issue's Status is not Done (e.g., still UAT or Review), explicitly change it to Done.
5. After changing a project item's Status, re-read that same Projects v2 item and independently verify Status equals Done. Do not assume the mutation succeeded based solely on the response.
6. Verify any parent epic or sub-issue progress reflects the completed issue.
7. Remove obsolete workflow or blocking labels where applicable.
8. Verify the PR-to-issue linking relationship is correct.
9. Report all issue and project-status changes made in the current session output.

Do not report the post-UAT lifecycle as complete until both conditions are met:

- The GitHub issue is closed with `state_reason` equal to `"completed"`.
- The corresponding PalCenter Roadmap project item has been independently verified as Status equals Done.

Closing an issue does NOT automatically mean the project item is Done. Updating project Status does NOT automatically close the issue. Both states must be verified independently.

Do not merge unrelated PRs or publish releases as part of post-UAT housekeeping without explicit owner authorization.

## Scope Discipline

- Make only changes relevant to the requested task.
- Do not perform opportunistic refactors unrelated to the scope.
- Distinguish necessary cleanup (e.g., formatting required for CI to pass) from unrelated cleanup.
- Avoid touching already UAT-approved surfaces unless the change requires it.
- If pre-existing lint, test, or build errors prevent passing validation, report them rather than silently broadening scope. Fix them only if necessary to complete the requested task.

## Temporary and Generated Artifacts

- Generated tooling artifacts such as `.playwright-mcp/` must remain untracked and should be gitignored.
- Use approved temporary directories for helper files or intermediate outputs rather than cluttering the repository.
- Do not weaken external-directory permissions globally to avoid prompts.

## PalDefender Validation and Identifier Discipline

A PalDefender `VALIDATION_FAILED` response does not establish that an endpoint is broken. Before classifying an endpoint as blocked or provider-defective:

1. Verify the exact documented request schema.
2. Verify every game identifier is an internal ID rather than a friendly or display name.
3. Check known authoritative runtime data where available.
4. Compare with existing successful PalCenter and PalDefender conventions.
5. If uncertainty remains, report the exact request and response and ask the owner before declaring the provider broken.

Do not guess identifiers. Do not mark an issue blocked merely because one live request returns `VALIDATION_FAILED`. Do not move an issue to blocked or Backlog based on an uncertain provider diagnosis without strong evidence.

PalDefender write endpoints generally require internal game identifiers. Treat display names and internal IDs as distinct. Do not substitute friendly names into provider requests unless authoritative mapping establishes that behavior. Consult live endpoint data for identifier verification, not historical examples.

### State-changing operations

For UAT actions that modify live Palworld or PalDefender state:

- perform the minimum write necessary
- do not retry ambiguous writes automatically
- inspect the exact provider response
- use read-after-write verification where available
- restore reversible owner state when appropriate

## Owner-Operated Live UAT

For any PalCenter feature that changes live Palworld or PalDefender state, the project owner performs the final UAT action through the PalCenter web UI. The agent must not normally perform the final state-changing action itself.

The agent prepares the environment by:

1. Starting or verifying the local Palworld and PalDefender test environment.
2. Starting or verifying the PalCenter feature branch locally.
3. Confirming the required player is connected when applicable.
4. Providing the owner with the local URL, server to select, page to open, feature being tested, and expected result.
5. Stopping and explicitly waiting for the owner.

The owner enters actual identifiers and performs the action through PalCenter's UI. The agent does not choose or substitute identifier values on the owner's behalf during final UAT.

After the owner performs the action, the agent may inspect logs, call authoritative read endpoints, verify resulting server or player state, capture screenshots, and document the result in the PR. Ask the owner for in-game confirmation when a result is only observable or meaningfully verifiable in the game client.

## Direct Provider Testing

Direct REST calls, PowerShell, curl, RCON, and similar mechanisms are diagnostic tools, not substitutes for final PalCenter UAT. Use them only to isolate whether a failure originates in PalCenter, request serialization, incorrect identifiers, PalDefender, or the game server.

When PalCenter UAT fails with `VALIDATION_FAILED` or another unclear provider error:

1. Preserve the exact request and response.
2. Do not immediately declare the provider broken.
3. Verify identifiers and the request contract before comparing via a direct REST call.
4. Ask the owner when input validity is uncertain.

Once a cause is corrected, final UAT must still be repeated through the PalCenter UI.

## Browser and UI Tooling

Use Playwright MCP for browser automation and UI inspection when automated browser verification is appropriate. Do not substitute HTTP clients (curl, Invoke-WebRequest) for browser validation when rendered UI behavior is required.

For live Palworld/PalDefender UAT that changes real server state, follow the Owner-Operated Live UAT rules above.

## Workspace Discipline

All PalCenter development uses the canonical repository under `C:\Development`.

Do not create project clones, worktrees, build staging directories, or UAT workspaces under the root of `C:\`, the user profile, Documents, or arbitrary temporary locations. If an isolated workspace is genuinely required, place it under `C:\Development` and clean it up when the task is complete.

Clean up processes, development servers, containers, and Playwright browser sessions created during testing unless the owner explicitly asks that they remain running for manual UAT.

## Release Preparation

Release preparation follows a gated workflow. When preparing for a release:

1. Stop feature work at the release-hardening point.
2. Code and repository review before broad modifications.
3. Audit findings must be reported before making changes.
4. Reconcile `CHANGELOG.md` and `RELEASE_NOTES.md` against actual Git/GitHub history.
5. Run the complete release validation defined by the repository's current scripts and CI workflows, including production and image validation where applicable.
6. The owner performs final release-candidate live UAT.
7. Do not merge to a release branch or `main`, create version tags, trigger GitHub Releases, or publish container images without explicit owner authorization.

Do not routinely duplicate expensive Docker/image validation locally during normal development; that gate belongs to CI. Local Docker validation is only required when modifying Dockerfile, Docker Compose configuration, multi-stage build steps, base image versions, CI workflow files, or runtime container dependencies, or when a GitHub Actions failure specifically demands local reproduction.

Detailed release runbook procedures follow this policy and are maintained separately during active release preparation.

## Terminology

In user-facing progress reports and UAT instructions, prefer natural administrative terms such as action, operation, change, grant, ban or unban, learn or forget, send, and delete. Avoid repeatedly calling ordinary game or server administrative actions "mutations." Technical code and tests may continue using "mutation" where that is the established terminology.
