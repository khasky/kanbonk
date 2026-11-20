# MCP server for AI agents

Implementation: [`src/mcp/tools.ts`](../src/mcp/tools.ts), [`src/mcp/agent.ts`](../src/mcp/agent.ts), [`mcp/kanbonk-mcp.mjs`](../mcp/kanbonk-mcp.mjs). Tests: [`tests/mcpTools.test.ts`](../tests/mcpTools.test.ts).

Kanbonk has no server, so the MCP server is a **headless Kanbonk device**: it keeps its own copy of the data in a folder, exposes Kanbonk operations as [Model Context Protocol](https://modelcontextprotocol.io/) tools over stdio, and syncs with your devices over the encrypted Wi-Fi relay like any other device. The app asks you to trust it once, exactly as with a new phone.

## Setup

```sh
pnpm install
pnpm build:mcp            # bundles src/mcp/agent.ts into dist-mcp/
pnpm build && pnpm serve:lan   # the app and the Wi-Fi relay on http://127.0.0.1:4173, if not running yet
```

In the app: **⋯ → Sync → Wi-Fi / local network → Create code → Connect with code**. Copy the code, then register the server with your MCP client. Claude Code:

```sh
claude mcp add kanbonk --env KANBONK_SYNC_URL=http://127.0.0.1:4173 --env KANBONK_SYNC_CODE=<code> -- node /path/to/kanbonk/mcp/kanbonk-mcp.mjs
```

Claude Desktop, Cursor and other clients take the same command in their JSON config:

```json
{ "mcpServers": { "kanbonk": { "command": "node", "args": ["/path/to/kanbonk/mcp/kanbonk-mcp.mjs"], "env": { "KANBONK_SYNC_URL": "http://127.0.0.1:4173", "KANBONK_SYNC_CODE": "<code>" } } } }
```

When the agent connects, the app shows "New device “AI agent (MCP)” (<id>) wants to sync. Add it to trusted devices?". After you approve, both sides exchange data; the agent's changes reach the app within a second while it is connected, and the app's changes reach the agent the same way.

| Variable | Meaning |
|---|---|
| `KANBONK_SYNC_URL` | Address of the relay (`http://` or `ws://`) |
| `KANBONK_SYNC_CODE` | Pairing code created in the app |
| `KANBONK_MCP_DIR` | Data folder, default `~/.kanbonk-mcp` (`state.json`, `device.json`, `files/`) |
| `KANBONK_DEVICE_NAME` | Name shown in the trust prompt, default `AI agent (MCP)` |

A relay room connects two devices, so while the agent is paired with one device, other devices sync with that device in another room or later. Without the sync variables the server works on its own data only, which is useful for trying the tools. Logs go to stderr; stdout carries only MCP messages.

## Tools

| Tool | Does |
|---|---|
| `list_workspaces`, `get_board`, `get_card`, `search_cards` | Read workspaces, boards with lists and cards, a full card; search with the app's operators (`board:`, `label:`, `due:`, …) |
| `board_summary`, `get_board_doc`, `update_board_doc` | The live project state, and the board document (see [ai.md](ai.md)) |
| `create_workspace`, `create_board`, `create_list`, `move_list`, `create_zone` | Structure |
| `create_card` (also sub-cards via `parentCardId`), `update_card`, `move_card`, `clone_card` | Cards: dates, description, completion, full-card colour |
| `add_comment`, `add_checklist`, `set_checklist_item`, `add_dependency` | Card details |
| `find_duplicates`, `merge_cards` | Cards with similar meaning across boards (the app's duplicate finder) and merging a pair |
| `delete`, `restore`, `list_trash` | The trash: deletion is restorable for 30 days, restore brings back parents |
| `sync_status`, `sync_now` | Connection to the app |

Read-only tools are annotated with `readOnlyHint`, `delete` and `merge_cards` with `destructiveHint`, so clients can ask before running them. Every change is a normal revision signed by the agent's device ID, so it appears in the card history and can be rolled back.

## Security

The agent is a trusted device: it can change everything the app can. Trust it only on a computer you control, and remove it from **Sync → Trusted devices** to revoke access. The pairing code is a secret: keep it out of shared config files and repositories.
