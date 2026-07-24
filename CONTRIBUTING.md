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
pnpm --filter @palcenter/api test
```

Changes to deployment documentation should also be checked against the current
Docker Compose file and release image behavior.

## Pull requests

- Keep each pull request focused on one issue.
- Explain the user-facing outcome and how it was validated.
- Update documentation when behavior or deployment requirements change.
- Do not commit generated build output, local environment files, runtime data,
  or secrets.

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).
