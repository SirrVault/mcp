#!/usr/bin/env node
/**
 * @sirrlock/mcp — MCP server for Sirr secret vault
 *
 * Exposes Sirr as MCP tools so AI assistants can store and read ephemeral secrets.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
// @ts-ignore
import { SirrClient, SirrError } from "@sirrlock/node";
import { version } from "../package.json";

// ── Config ────────────────────────────────────────────────────────────────────

const SIRR_SERVER = process.env["SIRR_SERVER"] || "https://sirr.sirrlock.com";
const SIRR_TOKEN = process.env["SIRR_TOKEN"] || "";

const client = new SirrClient({
  server: SIRR_SERVER,
  key: SIRR_TOKEN,
});

// ── Tool definitions ──────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "store_secret",
    description: "Store a secret in Sirr. Returns a hash and URL.",
    inputSchema: {
      type: "object",
      properties: {
        value: { type: "string", description: "Secret value to store." },
        ttl_seconds: { type: "number", description: "Optional TTL in seconds." },
        reads: { type: "number", description: "Optional max read count." },
        prefix: { type: "string", description: "Optional hash prefix." },
      },
      required: ["value"],
    },
  },
  {
    name: "read_secret",
    description: "Read a secret value by hash. Consumes a read. Returns null if burned/expired.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Secret hash to read." },
      },
      required: ["hash"],
    },
  },
  {
    name: "inspect_secret",
    description: "Check secret metadata via HEAD without consuming a read.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Secret hash to inspect." },
      },
      required: ["hash"],
    },
  },
  {
    name: "patch_secret",
    description: "Update an existing secret (requires owner key).",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Secret hash to update." },
        value: { type: "string", description: "New value (optional)." },
        ttl_seconds: { type: "number", description: "New TTL (optional)." },
        reads: { type: "number", description: "New read budget (optional)." },
      },
      required: ["hash"],
    },
  },
  {
    name: "burn_secret",
    description: "Delete a secret immediately.",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Secret hash to burn." },
      },
      required: ["hash"],
    },
  },
  {
    name: "audit_secret",
    description: "Get the audit trail for a secret (requires owner key).",
    inputSchema: {
      type: "object",
      properties: {
        hash: { type: "string", description: "Secret hash to audit." },
      },
      required: ["hash"],
    },
  },
  {
    name: "list_secrets",
    description: "List all secrets owned by the calling key.",
    inputSchema: { type: "object", properties: {} },
  },
];

// ── MCP Server ────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "sirr", version },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "store_secret": {
        const { value, ttl_seconds, reads, prefix } = args as any;
        const data = await client.push(value, { ttl_seconds, reads, prefix });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "read_secret": {
        const { hash } = args as any;
        const val = await client.get(hash);
        return { content: [{ type: "text", text: val === null ? "null" : val }] };
      }

      case "inspect_secret": {
        const { hash } = args as any;
        const status = await client.inspect(hash);
        return { content: [{ type: "text", text: JSON.stringify(status, null, 2) }] };
      }

      case "patch_secret": {
        const { hash, value, ttl_seconds, reads } = args as any;
        const data = await client.patch(hash, { value, ttl_seconds, reads });
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "burn_secret": {
        const { hash } = args as any;
        await client.burn(hash);
        return { content: [{ type: "text", text: "Secret burned." }] };
      }

      case "audit_secret": {
        const { hash } = args as any;
        const data = await client.audit(hash);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      case "list_secrets": {
        const data = await client.list();
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (err: any) {
    const msg = err instanceof SirrError ? `Sirr ${err.status}: ${err.message}` : err.message;
    return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((e) => {
  process.stderr.write(`sirr-mcp fatal: ${e}\n`);
  process.exit(1);
});
