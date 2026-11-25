# Feature-Parity Plan — Institutional Edition

Target users: hedge funds, HFT / systematic desks, family offices & HNW
wealth managers, market strategists. Scope: match the *capabilities* of
Bloomberg's professional product family, built clean-room with original
code, UI, names and licensed data. (Bloomberg product names below are used
only to identify the capability area being matched.)

Source note: professional.bloomberg.com was unreachable from the build
environment; this map is based on publicly known descriptions of the
product family. Re-verify against the site before final scoping.

---

## A. Product lines → our modules

| Capability area (Bloomberg reference) | Our product | Primary users |
|---|---|---|
| Terminal (desktop analytics, news, chat) | **Terminal Desktop** | All |
| B-PIPE / real-time enterprise feed | **Pulse Feed** — normalized low-latency market data | HFT, quant, enterprise |
| Data License / reference & historical data | **Vault Data** — bulk reference, pricing, history, fundamentals | Quant, risk, ops |
| BQL / BQuant (query language + notebooks) | **Query & Lab** — query language, hosted Python notebooks, backtester | Quant, strategists |
| EMSX / Tradebook (execution) | **Execute** — EMS with algos, broker routing, TCA | Traders, HFT |
| AIM / TOMS (order & portfolio management) | **OMS** — order lifecycle, allocations, compliance checks | Hedge funds, PMs |
| PORT / MARS (portfolio & risk analytics) | **Risk & Attribution** | PMs, risk, HNW |
| BVAL (evaluated pricing) | **Fair Value** — evaluated pricing for illiquids | Funds, ops, audit |
| Vault / compliance archiving | **Comply** — comms archiving, surveillance, pre/post-trade rules | Compliance |
| IB chat / Instant Bloomberg | **Desk Chat** — secure messaging, rooms, quote sharing | All |
| Launchpad (custom workspaces) | **Workspaces** | All |
| News & research | **Wire** — aggregated licensed news, filings, transcripts, AI summaries | All |
| Excel add-in / API | **Connect** — Excel add-in, REST/WebSocket/FIX/Python SDK | All |
| AI assistant / document search | **Ask** — LLM over all data with citations | Strategists, analysts |

---

## B. Terminal Desktop — function catalogue (our codes)

### Equities
- `OVR` security overview · `CH`/`CHI` charts with 100+ studies, drawing, multi-pane · `Q`/`DEPTH`/`TS` quote, L2 book, time & sales
- `FIN` statements (as-reported + standardized), segments, KPIs · `EST` consensus & revisions · `GUID` company guidance
- `FIL` filings · `TRN` earnings-call transcripts with sentiment · `EVT` corporate events / actions
- `OWN` holders, insiders, 13F changes · `PEER` relative valuation · `SUPPLY` supply chain map
- `SCR` screener (fundamental + technical + custom formulas) · `IPO` new issues · `ESG` scores & controversies
- `SHORT` short interest & borrow · `FLOW` fund flows, block trades

### Fixed income & credit
- `BND` bond search · `YLD` yield/spread/price calculator (YTM, OAS, Z-spread, duration, convexity)
- `CRV` curves (govt, swap, credit), curve trades & butterflies · `CDS` credit default swaps
- `RATE` central bank probabilities (implied from futures) · `NEWISS` primary issuance · `MUNI` municipals
- `REPO` repo & funding · `MBS` securitized products with prepayment models

### FX, rates derivatives, commodities
- `FX` spot/forward/NDF grids, crosses, carry · `FXVOL` vol surfaces · `FXFWD` forward points
- `SWAP` IRS pricer & curve builder · `SWPT` swaptions · `FUT` futures chains, rolls, calendar spreads
- `CMD` commodities incl. energy, metals, ags, freight, weather overlays

### Options & volatility
- `OPT` chains with Greeks · `VOL` surface & term structure · `SKEW` · `OSA` strategy builder & scenario P&L
- `UOA` unusual options activity · `DISP` dispersion / correlation · `VARSWP` variance swaps

### Macro & strategy
- `ECO` economic data browser (global) · `ECAL` calendar with consensus & surprise
- `WEI` world indices · `HEAT` cross-asset heatmap · `CORR` correlation matrix · `REGIME` regime detection
- `CBANK` central bank monitor · `GEO` geopolitical risk map · `SEAS` seasonality
- `RV` relative value (any vs any) · `SPRD` spread builder

### News, research, AI
- `N` news by topic/ticker/region with priority flags · `NS` full-text search · `ALRT` alerts (price, news, filings, model signals)
- `RES` broker research (entitlement-based) · `ASK` AI Q&A with citations · `SUM` doc summarizer

### Portfolio, risk, wealth (HNW)
- `PRT` holdings, P&L, exposures · `ATTR` Brinson & factor attribution · `RISK` VaR/CVaR, stress, scenario
- `FACT` factor model exposures · `OPTIM` optimizer with constraints · `WHATIF` pre-trade impact
- `WEALTH` client households, goals, consolidated statements, private assets · `REPORT` branded client PDFs

### Trading & execution
- `EMS` multi-asset blotter · `ALGO` VWAP/TWAP/POV/IS + custom · `RFQ` multi-dealer RFQ (bonds, FX, swaps)
- `TCA` transaction cost analysis · `BOOK` OMS orders, allocations · `PRECHK` pre-trade compliance

### Collaboration & platform
- `MSG` chat · `WS` workspaces · `XL` Excel · `API` · `HELP`/`?` function search · keyboard-first command line

---

## C. High-frequency / systematic tier (separate from the desktop)

A desktop terminal is not on the HFT critical path. Deliver a dedicated tier:

- **Direct feeds**: exchange-native feeds (ITCH/OUCH, NSE TBT, CME MDP3) decoded in C++/Rust; kernel-bypass (DPDK / Solarflare ef_vi); optional FPGA decode.
- **Co-location**: deploy in NY4/LD4/TY3/NSE colo; PTP time sync; hardware timestamping.
- **Normalized feed (Pulse Feed)**: < 50 µs internal fan-out, multicast + shared-memory delivery, gap recovery, full-depth book build.
- **Tick store**: kdb+/q or ClickHouse/QuestDB for nanosecond tick history; replay engine for backtests.
- **Execution gateway**: FIX 4.4/5.0 and native binary order entry, risk checks in hardware/software (< 5 µs), kill switch, throttles.
- **Research loop**: Lab notebooks → backtester (event-driven, realistic fills, fees, latency model) → paper → live.
- **Monitoring**: latency histograms (p50/p99/p99.9), drop-copy reconciliation.

---

## D. Data acquisition (must be licensed)

| Data | Typical sources |
|---|---|
| Real-time exchange data | Direct exchange licences; aggregators (ICE, Exegy, Refinitiv, Polygon) |
| Reference & corporate actions | ICE, exchange masters, OpenFIGI, GLEIF (LEI) |
| Fundamentals & estimates | S&P Capital IQ, FactSet, LSEG, or SEC XBRL + own normalization |
| Fixed income pricing | TRACE, MarketAxess, ICE, own evaluated pricing |
| Options (OPRA) | OPRA licence via vendor |
| News | Licensed wires (Dow Jones, Reuters, PTI), press releases, filings, Bigdata.com |
| Macro | FRED, IMF, World Bank, OECD, national statistics, central banks |
| Alternative | Web traffic, card spend, satellite, shipping (AIS) vendors |

---

## E. Non-functional requirements (institutional grade)

- Availability 99.99%, multi-region active-active; DR RPO ≤ 1 min.
- Desktop: native shell (Tauri/Electron + WebGL/Canvas grids), 4–6 monitors, 60 fps tick updates, < 100 ms command response.
- Security: SSO/SAML, hardware-key MFA, per-field data entitlements, SOC 2 Type II, ISO 27001, encryption at rest/in transit.
- Compliance: SEC/FINRA/SEBI/MiFID II record keeping, comms archiving, audit trails, best-execution reports.
- Entitlements & billing: per-user, per-exchange licence tracking and usage reporting to exchanges.

---

## F. Delivery roadmap

| Phase | Months | Deliverable |
|---|---|---|
| 0 | 0–2 | Data licences, entitlement service, instrument master, core infra |
| 1 | 2–6 | Desktop shell, command line, quotes, charts, equities pages, news, watchlists, alerts, chat |
| 2 | 6–10 | Fixed income, FX, commodities, curves, macro & strategist tools, Excel add-in |
| 3 | 10–14 | Options & vol, portfolio/risk/attribution, HNW wealth module, Ask AI |
| 4 | 14–20 | EMS/OMS, RFQ, algos, TCA, pre-trade compliance |
| 5 | 18–24 | HFT tier: direct feeds, colo, tick store, low-latency gateway, Lab backtester |
| 6 | 24+ | Fair-value pricing, comms archiving/surveillance, alt data, enterprise data distribution |

Team sketch for this scope: ~60–120 engineers (frontend, data, quant,
low-latency C++/Rust, SRE, security) plus data-licensing, compliance and
market-structure specialists.
