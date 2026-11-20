// MCP server that acts as a headless trusted Kanbonk device: it keeps its own copy of the data, syncs it with the app
// over the encrypted LAN relay, and exposes Kanbonk operations to AI agents. Node-specific I/O is injected by
// mcp/kanbonk-mcp.mjs, so this module stays platform-neutral and type-checked with the app.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { emptyState, type AppState } from "../model";
import { mergeStates } from "../sync";
import { validState } from "../backup";
import { migrateLegacyState } from "../legacy";
import { LanSync, type PeerInfo } from "../lanSync";
import { runTool, ToolError, tools } from "./tools";

export interface AgentStore {
  load: () => Promise<AppState | undefined>;
  save: (state: AppState) => Promise<void>;
  loadFile: (id: string) => Promise<Blob | undefined>;
  saveFile: (id: string, blob: Blob) => Promise<void>;
}

export interface AgentOptions {
  store: AgentStore;
  self: PeerInfo;
  /** LAN relay address (http://, ws://) and the pairing code created in the app. */
  sync?: { url: string; code: string };
  log: (message: string) => void;
  version?: string;
}

export async function createAgent(options: AgentOptions) {
  const loaded = await options.store.load();
  let state: AppState =
    loaded && validState(loaded as unknown as Record<string, unknown>) ? migrateLegacyState(loaded) : emptyState();
  let queue = Promise.resolve();
  let session: LanSync | undefined;
  let status = options.sync ? "connecting" : "sync not configured (set KANBONK_SYNC_URL and KANBONK_SYNC_CODE)";
  let lastSyncAt = "";
  let conflicts = 0;
  let retry = 5000;

  /** Serialises changes so concurrent tool calls and incoming syncs never overwrite each other. */
  const update = (change: (current: AppState) => AppState | Promise<AppState>) => {
    const run = queue.then(async () => {
      const next = await change(state);
      if (next !== state) {
        state = next;
        await options.store.save(state);
      }
    });
    queue = run.catch((cause) => {
      if (!(cause instanceof ToolError)) options.log(`update failed: ${String(cause)}`);
    });
    return run;
  };

  function connect() {
    if (!options.sync) return;
    const url = options.sync.url.replace(/^http/, "ws");
    try {
      const current: LanSync = new LanSync(
        {
          trust: {
            self: options.self,
            isTrusted: () => true,
            onPeer: async (peer) => {
              options.log(`paired with ${peer.name}`);
              return true;
            },
          },
          getState: () => state,
          onState: async (remote) => {
            await update((local) => {
              const merged = mergeStates(local, remote);
              conflicts = merged.conflicts.length;
              return merged.state;
            });
            lastSyncAt = new Date().toISOString();
            retry = 5000;
            status = `synced with ${current.peer?.name ?? "peer"}`;
            await current.requestFiles(state);
          },
          onFile: () => undefined,
          onStatus: (message) => {
            status = message;
            options.log(message);
          },
          onSent: () => {
            lastSyncAt = new Date().toISOString();
          },
          onClosed: () => {
            if (session !== current) return;
            options.log(`connection lost, retrying in ${retry / 1000}s`);
            setTimeout(() => {
              if (session === current) connect();
            }, retry);
            retry = Math.min(retry * 2, 60_000);
          },
          files: { load: options.store.loadFile, save: options.store.saveFile },
        },
        { url, code: options.sync.code },
      );
      session = current;
    } catch (cause) {
      status = `sync error: ${String(cause)}`;
      options.log(status);
    }
  }

  const server = new Server(
    { name: "kanbonk", version: options.version ?? "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Kanbonk is a local-first kanban board. Use list_workspaces and get_board to find IDs before changing anything. Card links in documents look like [name](/c/<cardId>). Deleted items go to the trash for 30 days.",
    },
  );
  const syncTools = [
    {
      name: "sync_status",
      description: "Connection to the Kanbonk app over the LAN relay.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
    },
    {
      name: "sync_now",
      description: "Send this agent's changes to the connected Kanbonk device now.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
  ];
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      ...tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as { type: "object"; properties?: Record<string, object> },
        annotations: {
          readOnlyHint: Boolean(tool.readOnly),
          destructiveHint: tool.name === "delete" || tool.name === "merge_cards",
        },
      })),
      ...syncTools,
    ],
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const reply = (value: unknown, isError = false) => ({
      content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
      isError,
    });
    if (name === "sync_status")
      return reply({ status, lastSyncAt: lastSyncAt || null, conflicts, peer: session?.peer ?? null });
    if (name === "sync_now") {
      await session?.syncIfConnected();
      return reply({ status });
    }
    try {
      let result: unknown;
      await update((current) => {
        const output = runTool(current, name, args, options.self.deviceId);
        result = output.result;
        return output.state;
      });
      if (!tools.find((tool) => tool.name === name)?.readOnly) void session?.syncIfConnected();
      return reply(result);
    } catch (cause) {
      if (cause instanceof ToolError) return reply(cause.message, true);
      return reply(`Failed: ${cause instanceof Error ? cause.message : String(cause)}`, true);
    }
  });

  connect();
  return {
    server,
    state: () => state,
    close: () => {
      const current = session;
      session = undefined;
      current?.close();
    },
  };
}
