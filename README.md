# Terminal

Keyboard-driven market terminal (Phase 1) on NSE data via MCP.

```
gateway/  Node data gateway: NSE MCP servers → REST/SSE
web/      React + Vite UI (lightweight-charts)
docs/     Feature-parity plan
```

## Run

```bash
cd gateway && npm install && cp .env.example .env
```

```bash
cd web && npm install && npm run build
```

```bash
cd gateway && node --env-file=.env src/server.js   # serves UI + API on http://localhost:8787
```

Dev mode with hot reload: run the gateway, then `cd web && npm run dev` (http://localhost:5173, proxies `/api`).

## Phase 1 functions

Type in the command line (`/` to focus), e.g. `RELIANCE GP`, `INFY BT 10 40`, `CMP TCS INFY`.

| Code | Function |
|---|---|
| LP | Launchpad: 6-index monitor (area + MA20 + volume), watchlist with sparklines & heat cells, sector movers heat grid, breadth & India VIX |
| GP | Candlestick/line chart, SMA 20/50, volume, 1M–2Y ranges, 52-week stats |
| BT | SMA-crossover backtest: signals on chart, P&L curve, stats (return, win rate, drawdown, Sharpe), grid-search optimizer |
| HEAT | NSE index heatmap, 1D–1Y |
| MOV | Top gainers/losers across NSE |
| CMP | Rebased relative performance of up to 6 symbols + drawdowns |
| MOOD | Stock/index breadth, benchmarks, India VIX |
| ASK | Natural-language commands (rule-based in Phase 1) |
| HELP | Function directory, shortcuts (F1–F4, Esc) |

Charts use TradingView lightweight-charts (Apache-2.0; attribution logo shown as required).
Data: NSE bhavcopy MCP — daily, unadjusted, educational/research use.
