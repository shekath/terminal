// Thin MCP client pool: one connection per configured server, lazy, auto-reconnect.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

export const SERVERS = {
  live: { url: process.env.NSE_LIVE_MCP_URL, token: process.env.NSE_LIVE_MCP_TOKEN },
  history: { url: process.env.NSE_HISTORY_MCP_URL, token: process.env.NSE_HISTORY_MCP_TOKEN },
};

const clients = new Map();

async function connect(name) {
  const cfg = SERVERS[name];
  if (!cfg?.url) throw new Error(`MCP server "${name}" not configured (set NSE_${name.toUpperCase()}_MCP_URL)`);
  const url = new URL(cfg.url);
  const requestInit = cfg.token ? { headers: { Authorization: `Bearer ${cfg.token}` } } : undefined;
  const client = new Client({ name: 'terminal-gateway', version: '0.1.0' });
  try {
    await client.connect(new StreamableHTTPClientTransport(url, { requestInit }));
  } catch {
    // Older servers only speak SSE.
    await client.connect(new SSEClientTransport(url, { requestInit }));
  }
  client.onclose = () => clients.delete(name);
  return client;
}

async function getClient(name) {
  if (!clients.has(name)) clients.set(name, connect(name).catch((e) => { clients.delete(name); throw e; }));
  return clients.get(name);
}

// Calls a tool and returns its JSON payload (NSE servers return JSON text content).
export async function callTool(server, tool, args = {}) {
  const client = await getClient(server);
  const res = await client.callTool({ name: tool, arguments: args });
  if (res.isError) throw new Error(res.content?.map((c) => c.text).join(' ') || `${tool} failed`);
  if (res.structuredContent) return res.structuredContent;
  const text = (res.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  try { return JSON.parse(text); } catch { return { text }; }
}

export async function listTools(server) {
  const client = await getClient(server);
  return (await client.listTools()).tools.map((t) => t.name);
}
