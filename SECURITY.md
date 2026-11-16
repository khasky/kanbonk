# Security policy

## Supported versions

Kanbonk is in alpha. Only the latest version on the `main` branch receives fixes.

## Reporting a vulnerability

Please **do not** open a public issue for security problems. Use GitHub's [private vulnerability reporting](https://github.com/khasky/kanbonk/security/advisories/new) instead.

Include the affected component (sync, file bundles, backup restore, Trello import, LAN server, browser extension…), steps to reproduce and the impact you expect. We aim to acknowledge a report within 7 days.

## Security model in brief

- All data stays on the user's devices; there is no Kanbonk server or account.
- Sync packets between devices are encrypted with XChaCha20-Poly1305 using a key derived from a 128-bit pairing code; WebRTC links use DTLS.
- A device must be explicitly trusted before its data is accepted.
- The LAN server (`server.mjs`) serves the app over plain HTTP and is meant for trusted home networks only.

The full threat model and its known limitations are in [docs/sync.md](docs/sync.md#security-model).
