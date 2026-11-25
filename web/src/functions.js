// Our function catalogue (original codes). `needsSymbol` functions take a ticker.
export const FUNCTIONS = [
  { code: 'LP', name: 'Launchpad — multi-chart, movers, watchlist, breadth' },
  { code: 'GP', name: 'Price chart: candles, MAs, volume, crosshair', needsSymbol: true },
  { code: 'BT', name: 'Backtest & optimize MA-crossover strategy', needsSymbol: true },
  { code: 'HEAT', name: 'Index heatmap (sectoral / thematic)' },
  { code: 'MOV', name: 'Top gainers & losers (stocks + indices)' },
  { code: 'CMP', name: 'Relative performance: compare up to 6 symbols', needsSymbol: true },
  { code: 'MOOD', name: 'Market mood: breadth, benchmarks, India VIX' },
  { code: 'ASK', name: 'Ask — natural-language commands' },
  { code: 'HELP', name: 'Function directory & keyboard shortcuts' },
];
export const ROADMAP = ['MAP geo-data maps', 'FIN financials', 'OPT options', 'N news', 'PRT portfolio', 'MSG chat'];

// Parses "RELIANCE GP", "GP RELIANCE", "CMP TCS INFY", "BT INFY 10 40".
export function parseCommand(input) {
  const parts = input.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const fn = FUNCTIONS.find((f) => parts.includes(f.code));
  const rest = parts.filter((p) => p !== fn?.code && p !== 'EQ' && p !== 'IN' && p !== 'GO');
  const nums = rest.filter((p) => /^\d+$/.test(p)).map(Number);
  const symbols = rest.filter((p) => !/^\d+$/.test(p));
  if (!fn) return symbols.length ? { code: 'GP', symbols, nums } : null;
  return { code: fn.code, symbols, nums };
}
