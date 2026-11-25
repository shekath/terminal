// Connectivity check: lists each configured server's tools.
import { SERVERS, listTools } from './mcp.js';

for (const name of Object.keys(SERVERS)) {
  try { console.log(name, '→', (await listTools(name)).join(', ')); }
  catch (e) { console.log(name, '✗', e.message); }
}
process.exit(0);
