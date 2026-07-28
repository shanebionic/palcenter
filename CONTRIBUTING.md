# Contributing to PalCenter

Thank you for helping improve PalCenter.

## Before you start

- Search the [issue tracker](https://github.com/shanebionic/palcenter/issues)
  for an existing report or request.
- Use GitHub Discussions or an issue to confirm the intended approach before a
  large change.
- Do not include Palworld administrator passwords, notification credentials,
  backups, or other private deployment data.
- Report security vulnerabilities according to [SECURITY.md](SECURITY.md).

## Local development

Requirements:

- Node.js 22.13 or newer
- pnpm 9

Install dependencies and run PalCenter:

```sh
pnpm install
pnpm dev
```

The frontend runs on port `3000` and the API on port `3001`.

## Validation

Before opening a pull request, run:

```sh
pnpm check-types
pnpm lint
pnpm build
pnpm test
pnpm audit --prod
docker build .
```

Changes to deployment documentation should also be checked against the current
Docker Compose file and release image behavior.

## Pull requests

- Keep each pull request focused on one issue.
- Explain the user-facing outcome and how it was validated.
- Update documentation when behavior or deployment requirements change.
- Do not commit generated build output, local environment files, runtime data,
  or secrets.

## Development and release branches

PalCenter uses a permanent development channel:

```text
feature/* → dev → ghcr.io/shanebionic/palcenter:dev
```

Feature branches are reviewed into `dev`. The Validation workflow checks
dependencies, types, linting, tests, the production application build, and a
non-publishing multi-platform Docker build. The consolidated workflow preserves
both existing status checks required for `dev` and `main`:
`Type check, lint, and build` and `Build production image`.

Pushes to `dev` independently publish the multi-platform development image.
The publishing workflow does not repeat application validation already covered
by branch protection. Manual Development Docker Image runs must select the
`dev` branch; the workflow rejects every other selected ref before registry
login or image publication.

After development testing:

```text
dev → main → vX.Y.Z tag → versioned image + latest
```

Production releases are prepared by merging the tested `dev` state into
`main`, then creating a semantic version tag. Application source code does not
need channel-specific edits; the Docker workflows inject version, channel, and
commit metadata during the image build.

The repository intentionally has three workflows:

- **Validation** verifies application and Docker builds without publishing.
- **Development Docker Image** publishes only `dev` images.
- **Release** publishes production images and creates or updates the GitHub
  Release from `RELEASE_NOTES.md`.

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).
