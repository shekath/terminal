# Terminal gateway

Connects to the NSE MCP servers and serves their data to the terminal UI.

| Server | Env var | Used for |
|---|---|---|
| NSE Capital Market live (`cm-market`) | `NSE_LIVE_MCP_URL` (+ optional `NSE_LIVE_MCP_TOKEN`) | indices, quotes, movers |
| NSE Bhavcopy (`nse-bhavcopy`) | `NSE_HISTORY_MCP_URL` (+ optional `NSE_HISTORY_MCP_TOKEN`) | bulk quotes, OHLCV history, breadth, corporate actions, symbol search |

```bash
cp .env.example .env   # fill in the server URLs
npm install
node --env-file=.env src/check.js   # lists each server's tools
node --env-file=.env src/server.js  # http://localhost:8787
```

## Endpoints

| Endpoint | MCP tool |
|---|---|
| `GET /api/indices?group=&name=` | `cm_get_live_indices` |
| `GET /api/indices/:name` | `cm_get_index_quote` |
| `GET /api/quote/:symbol` | `cm_get_stock_quote` |
| `GET /api/movers?index=NIFTY&limit=10` | `nse_get_market_movers` |
| `GET /api/quotes?symbols=RELIANCE,TCS` | `get_bulk_quote` |
| `GET /api/history/:symbol?months=3&end=yyyy-MM-dd` | `get_stock_history` |
| `GET /api/breadth?date=` | `get_market_breadth` |
| `GET /api/corporate-actions/:symbol` | `get_corporate_actions` |
| `GET /api/search?q=` | `search_symbols` |
| `GET /api/stream/quotes?symbols=…` | SSE, polls `cm_get_stock_quote` every 60 s |

Notes: history prices are unadjusted for corporate actions; live data is
stale outside 09:15–15:30 IST. Data is for educational/research use per the
servers' SEBI disclaimers — confirm NSE's licensing terms before any
commercial redistribution.
