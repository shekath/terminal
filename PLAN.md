# Terminal — Feature-Parity Plan

Goal: a professional market terminal matching the functional scope of the
Bloomberg Terminal, built clean-room from public knowledge of what such
terminals do. Original code, UI, branding and command names; data only from
sources we are licensed to use. No decompiling of, or data extraction from,
Bloomberg software.

## 1. Feature map (capability parity)

| Bloomberg capability area | Our module | Command (ours) | Data source |
|---|---|---|---|
| Security description / overview | Security Overview | `OVR` | EDGAR, exchange data, vendor API |
| Price charts, technicals | Charting | `CH` / `CHI` | Exchange / vendor OHLCV |
| Intraday quotes, depth, time & sales | Quote Monitor | `Q`, `TS` | Real-time feed (Polygon, NSE, etc.) |
| Financial statements & ratios | Financials | `FIN` | SEC XBRL, vendor fundamentals |
| Estimates & consensus | Estimates | `EST` | Vendor (Finnhub/Zacks/etc.) |
| Filings | Filings | `FIL` | SEC EDGAR, NSE/BSE |
| Ownership & insiders | Holders | `OWN` | 13F, Form 4, SAST |
| Peer comparison / relative value | Peers | `PEER` | Fundamentals + quotes |
| Equity screening | Screener | `SCR` | Local factor DB |
| Earnings / corporate-action calendar | Events | `EVT` | EDGAR, exchanges, vendor |
| World indices, movers | Markets Overview | `MKT` | Index feeds |
| FX rates, crosses, forwards | FX | `FX` | ECB, vendor FX |
| Government yield curves | Curves | `CRV` | US Treasury, FRED, central banks |
| Bond search, pricing, YAS-style calc | Fixed Income | `BND`, `YLD` | TRACE, vendor, own pricer |
| Commodities & futures | Commodities | `CMD` | Exchange / vendor |
| Options chains, vol surfaces, Greeks | Options | `OPT`, `VOL` | OPRA vendor, own models |
| Economic data & calendar | Macro | `ECO`, `ECAL` | FRED, World Bank, IMF, OECD |
| News feed, search, alerts | News | `N`, `NS` | Bigdata.com, RSS, GDELT, licensed wires |
| Portfolio holdings, P&L, risk, attribution | Portfolio | `PRT`, `RISK` | User data + quotes |
| Watchlists / monitors | Monitor | `W` | Quotes |
| Alerts (price, news, filings) | Alerts | `ALRT` | All of the above |
| Messaging & chat | Chat | `MSG` | Own service |
| Excel / API data access | Data API | `API`, Excel add-in | Our gateway |
| AI research assistant | Assistant | `ASK` | LLM over our data |
| Launchpad-style custom workspaces | Workspaces | `WS` | — |
| Help, function search | Help | `HELP`, `?` | — |

## 2. Architecture

- **Client:** React + TypeScript; command bar with grammar
  `<TICKER> <MARKET> <ASSET> <FUNC> <Enter>`, autocomplete, tiled/draggable
  panels, multi-window, keyboard-first; original dark theme.
- **Gateway:** TypeScript (Node) service exposing REST + WebSocket; one
  adapter per provider behind a common instrument/quote/fundamental schema.
- **Storage:** Postgres + TimescaleDB (time series), Redis (cache, pub/sub),
  object store for filings/news.
- **Analytics:** Python services — screening, portfolio risk (VaR, factor),
  bond and option pricing (QuantLib).
- **Desktop packaging:** Tauri or Electron later.

## 3. Phases

1. **Shell & core** — command parser, panel layout, watchlists, live quotes,
   charts; adapters: NSE + SEC EDGAR.
2. **Equity depth** — OVR, FIN, FIL, OWN, PEER, EVT, SCR.
3. **Cross-asset** — MKT, FX, CRV, CMD, ECO/ECAL.
4. **News & AI** — N/NS with entity tagging, alerts, ASK assistant.
5. **Derivatives & fixed income** — OPT, VOL, BND, YLD.
6. **Portfolio & risk** — PRT, RISK, attribution.
7. **Collaboration & access** — MSG, Data API, Excel add-in, workspaces.

## 4. Data licensing checklist

Before using any provider in production, confirm redistribution/display
rights for our user count. Real-time exchange data requires exchange
display agreements.
