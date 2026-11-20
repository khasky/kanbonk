# Contributing to Kanbonk

Thanks for helping. This guide covers how to set up the project, what a good change looks like and how to send it.

## Ground rules

- Kanbonk is **local-first**: no accounts, no cloud storage and no Kanbonk-operated servers. Changes that send user data to a third party will not be accepted.
- One codebase serves every platform. Keep platform checks inside [`src/platform.ts`](src/platform.ts); the rest of `src/` must work the same on web, extension, desktop and mobile.
- Data on users' devices must survive upgrades. Changes to the persisted state, the sync protocol or the backup format need a migration or must stay backward compatible (see [docs/data-model.md](docs/data-model.md)).
- Please open an issue before starting a large feature or a new dependency, so we can agree on the approach first.

## Development setup

```sh
pnpm install
pnpm dev          # web app at http://localhost:1420
pnpm test             # unit tests (Vitest)
pnpm build        # type check (tsc) and production build
```

Native builds (Windows, Android) and the browser extension are described in [docs/platforms.md](docs/platforms.md).

## Project layout

| Path | Contents |
|---|---|
| `src/` | The shared React app and all domain logic |
| `tests/` | Vitest unit tests, one file per module or feature |
| `extension/` | Manifest and service worker of the Kanbonk browser extension |
| `trello-import-extension/` | Browser extension that exports a Trello board with its files for import |
| `src-tauri/` | Tauri shell for desktop and mobile |
| `server.mjs` | LAN server: serves `dist/` and relays encrypted sync packets |
| `scripts/` | Build scripts |
| `docs/` | Documentation |

[docs/architecture.md](docs/architecture.md) explains how the pieces fit together.

## Making a change

1. Fork the repository and create a branch from `main`, named after the commit type it carries: `feat/…`, `fix/…`, `docs/…`, `refactor/…`, `perf/…`, `ci/…`, `chore/…`. One branch, one change.
2. Keep domain logic in pure functions in its own module (`src/zones.ts` and `src/trash.ts` are good examples) and cover it with a test in `tests/`.
3. Run `pnpm test` and `pnpm build`. Both must pass.
4. If your change affects behavior across devices, check it with two browser profiles syncing over `pnpm serve:lan` (see [docs/testing.md](docs/testing.md)).
5. Update the documentation in `docs/` when behavior or formats change.

## Code style

- TypeScript in strict mode; `tsc` must report no errors, including unused locals.
- Prefer native platform features (`<input type="date">`, CSS) over new code or dependencies.
- Comments explain *why*, not *what*.
- The UI text is English; keep new strings consistent with the surrounding UI.

## Commit messages

This repo follows [Conventional Commits](https://www.conventionalcommits.org/). A `commit-msg` hook (husky + commitlint, installed automatically on `pnpm install`) rejects messages that don't parse, so the format never drifts and the version and changelog are derived straight from history.

Shape — `type(scope)?: subject`:

```text
feat(calendar): resize a card to change its due date
fix(sync): reconnect after the relay restarts
docs: document the MCP setup
```

Types: `feat`, `fix`, `perf`, `refactor`, `docs`, `style`, `test`, `build`, `ci`, `chore`, `revert`. The version bump derives from the commits since the last release: a breaking change bumps major, `feat` minor, anything else patch. `feat`, `fix`, `perf`, `refactor`, and `revert` show up in `CHANGELOG.md`; the rest (`docs`, `style`, `test`, `build`, `ci`, `chore`) are hidden from it. The header and the body lines are capped at 100 characters (commitlint enforces both). Footer lines are not: a trailer can carry a URL, a GHSA id or a commit sha, and those are one unbreakable token — so anything too long to wrap goes in a trailer (`Refs: <url>`), not mid-paragraph.

**`chore` and `style` are hidden from the changelog, so nothing a user can see may hide behind them.** `chore` is housekeeping invisible from the outside — dependency bumps, config, release chores. `style` is formatting with no semantic effect: import order, whitespace. A changed UI string, a moved button, a colour, a security hardening — those are `fix` or `feat` with the scope of the area, however small the diff.

Scope is the area touched, and it is optional. `commitlint.config.js` carries the list of scopes already in use and **warns** on anything else: the warning is there to catch a typo or a second name for an area that has one (`cards` for `card`, `bundle` for `sync`), not to block a new area — a scope that's genuinely new lands with the warning, and the list grows in `commitlint.config.js`.

Two footers are enforced rather than suggested:

- **`revert` needs `Refs: <sha>`** naming the commit it undoes. Prose in the body is for the why; the trailer is what pairs the two commits.
- **A `!` header needs a `BREAKING CHANGE: <what breaks>` footer.** The `!` says something breaks and can't say what; the footer is the line that lands under **Breaking Changes** in `CHANGELOG.md`.

```text
revert(sync): drop automatic reconnect on the offline event

It reconnected twice when the relay and the network came back together.

Refs: 79a8186
```

Pull requests land as a **squash merge**, so the PR title becomes the commit message on `main` and must follow the same convention; `.github/workflows/pr-title.yml` validates it, because the `commit-msg` hook cannot see a PR title. Keep one concern per commit and per PR: a title that needs a comma-separated list of changes is two PRs.

## Releasing

`pnpm release` (commit-and-tag-version) reads the commits since the last `v*` tag, bumps the version in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` and `src-tauri/Cargo.lock`, writes `CHANGELOG.md`, commits and tags. Push the commit and the tag afterwards.

## Reporting bugs

Open an issue with:

- the platform and version (browser, Windows, Android…);
- steps to reproduce, what you expected and what happened;
- whether sync was involved, and between which platforms.

Please never attach real board exports that contain personal data.

Security issues go through [SECURITY.md](SECURITY.md), not public issues.
