// Token Radar Senja — the fitted launch-value model.
//
// One sealed snapshot in, one ranked board out. Nothing here names a protocol:
// every number a row carries is computed from the snapshot's own figures.
//
//   peers     the 128 protocols whose market cap is set and positive. They are
//             the only comps: log(mcap) is regressed on log(TVL) over them.
//   fit       a global log-log OLS fit, plus a per-category intercept. A thin
//             category's intercept is shrunk toward the global one, weight
//             n / (n + 8), so a category with two peers cannot set its own price.
//   fitted    exp(a_cat + b * ln TVL): what the comps say a token would be worth.
//   maturity  0.70 + 0.30 * min(age_days, 1095) / 1095 (unknown age: 0.85).
//             A protocol that has run longer with no token recorded has had
//             more time to build the base a launch would price.
//   growth    1 + clamp(change_7d, -40, 80) / 100 * 0.5: dampened, never dominant.
//   chains    1 + 0.05 * min(chains - 1, 4): a little credit for being multichain.
//   odds      the peers' own listing record: half the listing rate of the
//             protocol's age band, half its category's, clamped to [0.03, 0.45].
//             It is a probability, not a judgement: older bands and categories
//             whose peers mostly list score higher.
//   implied   fitted * maturity * growth * chains * odds, rounded to dollars.
//   band      implied * exp(+/- held-out median absolute log error): the fit's
//             own error, measured out of sample, not a guessed spread.
//
// The fit is tested, not asserted: two deterministic held-out folds (every
// 5th peer by slug hash, folds 0 and 1) report R-squared in log space and the
// median absolute log error. The board and the dashboard print both numbers.
//
// Farm verdicts are netted, not slogans: the plan's gas total is summed from
// its steps, the expected value to one farmer is the band's low end times a
// stated 5% farmer pool divided by an estimated farmer count (TVL / $100k,
// clamped 100..5000), and the verdict is farm when the net is >= $25, thin
// when it is >= $0, skip otherwise. Every assumption is printed on the page.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, printed on the dashboard next to the fit. */
export interface ModelConstants {
  shrink_n: number;
  maturity_floor: number;
  maturity_days: number;
  unknown_age_maturity: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  chain_step: number;
  chain_max: number;
  odds_floor: number;
  odds_cap: number;
  farmer_pool_share: number;
  farmer_capital_divisor: number;
  farmer_min: number;
  farmer_max: number;
  farm_net: number;
}

export const MODEL: ModelConstants = {
  shrink_n: 8,
  maturity_floor: 0.7,
  maturity_days: 1095,
  unknown_age_maturity: 0.85,
  growth_weight: 0.5,
  growth_floor: -40,
  growth_cap: 80,
  chain_step: 0.05,
  chain_max: 4,
  odds_floor: 0.03,
  odds_cap: 0.45,
  farmer_pool_share: 0.05,
  farmer_capital_divisor: 100_000,
  farmer_min: 100,
  farmer_max: 5000,
  farm_net: 25,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'senja-fitted-1';

/** One held-out fold's report, in log space. */
export interface FoldReport {
  fold: number;
  train_n: number;
  test_n: number;
  r2: number;
  median_abs_log_error: number;
}

/** The fitted comps model, as the dashboard states it. */
export interface FitReport {
  peers_n: number;
  global_intercept: number;
  global_slope: number;
  in_sample_r2: number;
  residual_sd: number;
  median_abs_log_error: number;
  folds: FoldReport[];
  heldout_median_abs_log_error: number;
  global_listing_rate: number;
  age_band_rates: Record<string, number>;
  category_rates: Record<string, number>;
}

/** One farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
  expected_farmer_usd: number;
  plan_cost_usd: number;
  model: {
    fitted_mcap_usd: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    chain_multiplier: number;
    token_odds: number;
    age_band: string;
    age_band_rate: number;
    category_rate: number;
  };
  farm_steps: string[];
}

/** A nearest token-bearing peer, for the detail view's comps table. */
export interface CompRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

/** The dashboard's compact view of one board row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  band_low_usd: number;
  band_high_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
  expected_farmer_usd: number;
  plan_cost_usd: number;
  fitted_mcap_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  chain_multiplier: number;
  token_odds: number;
  age_band: string;
  farm_steps: string[];
  comps: CompRow[];
}

/** A protocol whose token already trades: the market's value, never a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number;
  change_7d: number | null;
}

/** A protocol set aside from the ranked board, with the reason stated. */
export interface AsideRow {
  slug: string;
  name: string;
  category: string | null;
  reason: string;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  fit: FitReport;
  watchlist_size: number;
  watchlist: string[];
  board_size: number;
  protocols_total: number;
  live_size: number;
  aside_size: number;
  rows: RadarRow[];
  live: LiveRow[];
  aside: AsideRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;
const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The age band a protocol's age falls in; the odds table is keyed on it. */
export function ageBand(age: number | null): string {
  if (age === null) return 'unknown';
  if (age < 365) return '<1y';
  if (age < 730) return '1-2y';
  if (age < 1095) return '2-3y';
  return '3y+';
}

/** A small deterministic hash of a slug, for the held-out folds. */
function slugHash(slug: string): number {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) >>> 0;
  return h;
}

/** Ordinary least squares of y on x; returns intercept, slope, R-squared. */
function ols(xs: number[], ys: number[]): { a: number; b: number; r2: number } {
  const n = xs.length;
  const mx = xs.reduce((s, x) => s + x, 0) / n;
  const my = ys.reduce((s, y) => s + y, 0) / n;
  let sxx = 0;
  let sxy = 0;
  let sst = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i]! - mx) ** 2;
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sst += (ys[i]! - my) ** 2;
  }
  const b = sxx === 0 ? 0 : sxy / sxx;
  const a = my - b * mx;
  let ssr = 0;
  for (let i = 0; i < n; i++) ssr += (ys[i]! - (a + b * xs[i]!)) ** 2;
  return { a, b, r2: sst === 0 ? 0 : 1 - ssr / sst };
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const v = [...values].sort((a, b) => a - b);
  const mid = Math.floor(v.length / 2);
  return v.length % 2 === 1 ? v[mid]! : (v[mid - 1]! + v[mid]!) / 2;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories that are not a launch candidate: a wrapped, staked, bridged or exchange product. */
const NOT_A_LAUNCH = new Set(['CEX', 'Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC']);

/** Whether a protocol records no token at all (no market cap, no CoinGecko id, no symbol). */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol is one the board may rank: no token recorded at all
 *  (no market cap, no CoinGecko id, no symbol), not an exchange, not a
 *  versioned pool. A symbol alone is a record: protocols behind a famous
 *  stablecoin or DEX carry one while their market cap is blank, and ranking
 *  them as pre-token would be the board's own error. */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !NOT_A_LAUNCH.has(p.category ?? '') && !VERSIONED.test(p.name);
}

/** Why a protocol with no market cap is set aside instead of ranked. */
function asideReason(p: SnapshotProtocol): string {
  if (p.mcap_usd === null && (p.symbol !== null || p.gecko_id !== null)) return 'records a symbol or CoinGecko id: its token may already trade';
  if (p.category === 'CEX') return 'exchange: its token, if any, is the exchange itself';
  if (NOT_A_LAUNCH.has(p.category ?? '')) return `${p.category ?? 'bridged product'}: a wrapped, staked or bridged product, not a launch`;
  if (VERSIONED.test(p.name)) return 'versioned pool: a release of a protocol whose token already trades';
  return 'set aside';
}

/** The fitted comps model and its held-out test, computed from the snapshot's own peers. */
export function fitModel(snapshot: Snapshot): { fit: FitReport; predict: (p: SnapshotProtocol) => number; categoryIntercept: (category: string | null) => number } {
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0);
  const xs = peers.map((p) => Math.log(p.tvl_usd));
  const ys = peers.map((p) => Math.log(p.mcap_usd!));
  const global = ols(xs, ys);
  const resid = ys.map((y, i) => y - (global.a + global.b * xs[i]!));
  const residSd = Math.sqrt(resid.reduce((s, r) => s + r * r, 0) / Math.max(1, resid.length));
  const medAbs = median(resid.map((r) => Math.abs(r)));

  // Per-category intercepts: the median log residual of the category's peers,
  // shrunk toward the global intercept by n / (n + shrink_n).
  const byCat = new Map<string, SnapshotProtocol[]>();
  for (const p of peers) {
    const key = p.category ?? '(none)';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(p);
  }
  const catIntercept = new Map<string, number>();
  for (const [cat, grp] of byCat) {
    const raw = global.a + median(grp.map((p) => Math.log(p.mcap_usd!) - global.b * Math.log(p.tvl_usd) - global.a));
    const w = grp.length / (grp.length + MODEL.shrink_n);
    catIntercept.set(cat, w * raw + (1 - w) * global.a);
  }
  const categoryIntercept = (category: string | null): number => catIntercept.get(category ?? '(none)') ?? global.a;
  const predict = (p: SnapshotProtocol): number => Math.exp(categoryIntercept(p.category) + global.b * Math.log(Math.max(1, p.tvl_usd)));

  // Listing rates: share of protocols that record a market cap, by age band and by category.
  const listed = (p: SnapshotProtocol): boolean => p.mcap_usd !== null;
  const bandGroups = new Map<string, SnapshotProtocol[]>();
  const catGroups = new Map<string, SnapshotProtocol[]>();
  for (const p of snapshot.protocols) {
    const band = ageBand(ageDays(snapshot.as_of, p.listed_at));
    if (!bandGroups.has(band)) bandGroups.set(band, []);
    bandGroups.get(band)!.push(p);
    const key = p.category ?? '(none)';
    if (!catGroups.has(key)) catGroups.set(key, []);
    catGroups.get(key)!.push(p);
  }
  const rateOf = (grp: SnapshotProtocol[]): number => (grp.length === 0 ? 0 : grp.filter(listed).length / grp.length);
  const age_band_rates: Record<string, number> = {};
  for (const [band, grp] of [...bandGroups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) age_band_rates[band] = round4(rateOf(grp));
  const category_rates: Record<string, number> = {};
  for (const [cat, grp] of [...catGroups].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (grp.length >= 5) category_rates[cat] = round4(rateOf(grp));
  }
  const globalRate = round4(rateOf(snapshot.protocols));

  // Held-out test, twice: fold k holds out every peer whose slug hash mod 5 is k.
  const folds: FoldReport[] = [];
  const heldErrs: number[] = [];
  for (const fold of [0, 1]) {
    const train = peers.filter((p) => slugHash(p.slug) % 5 !== fold);
    const test = peers.filter((p) => slugHash(p.slug) % 5 === fold);
    const f = ols(train.map((p) => Math.log(p.tvl_usd)), train.map((p) => Math.log(p.mcap_usd!)));
    const errs = test.map((p) => Math.abs(Math.log(p.mcap_usd!) - (f.a + f.b * Math.log(p.tvl_usd))));
    const testYs = test.map((p) => Math.log(p.mcap_usd!));
    const testMean = testYs.reduce((s, y) => s + y, 0) / Math.max(1, testYs.length);
    const sst = testYs.reduce((s, y) => s + (y - testMean) ** 2, 0);
    const ssr = test.reduce((s, p, i) => s + (Math.log(p.mcap_usd!) - (f.a + f.b * Math.log(p.tvl_usd))) ** 2, 0);
    folds.push({ fold, train_n: train.length, test_n: test.length, r2: round4(sst === 0 ? 0 : 1 - ssr / sst), median_abs_log_error: round4(median(errs)) });
    heldErrs.push(...errs);
  }

  const fit: FitReport = {
    peers_n: peers.length,
    global_intercept: round4(global.a),
    global_slope: round4(global.b),
    in_sample_r2: round4(global.r2),
    residual_sd: round4(residSd),
    median_abs_log_error: round4(medAbs),
    folds,
    heldout_median_abs_log_error: round4(median(heldErrs)),
    global_listing_rate: globalRate,
    age_band_rates,
    category_rates,
  };
  return { fit, predict, categoryIntercept };
}

/** The token odds for a protocol: half its age band's listing rate, half its category's. */
function tokenOdds(p: SnapshotProtocol, snapshot: Snapshot, fit: FitReport): { odds: number; band: string; bandRate: number; catRate: number } {
  const band = ageBand(ageDays(snapshot.as_of, p.listed_at));
  const bandRate = fit.age_band_rates[band] ?? fit.global_listing_rate;
  const catRate = fit.category_rates[p.category ?? '(none)'] ?? fit.global_listing_rate;
  const odds = clamp(0.5 * bandRate + 0.5 * catRate, MODEL.odds_floor, MODEL.odds_cap);
  return { odds, band, bandRate, catRate };
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on a chain, in whole dollars. */
function gasPerTx(chain: string): number {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return 8;
  if (c === 'solana') return 1;
  if (c === 'tron') return 1;
  if (c === 'bitcoin' || c === 'bittensor') return 3;
  return 1; // every other chain named here is a low-fee L2 or sidechain
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and keep the position open.`;
  if (c.includes('dex')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and keep the position open.`;
  if (c.includes('risk curator') || c.includes('allocator') || c.includes('curator')) return `Deposit $${capital} into a ${name} vault on ${chain} and keep the vault shares.`;
  if (c.includes('yield')) return `Deposit $${capital} into ${name}'s highest-TVL vault on ${chain} and keep the shares.`;
  if (c.includes('rwa') || c.includes('real world')) return `Mint $${capital} of ${name}'s yield asset on ${chain} and hold it.`;
  if (c.includes('derivative') || c.includes('perpetual') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedged position.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and use the bridged funds in its app.`;
  if (c.includes('staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and keep the receipt.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and keep the policy.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} over two separate weeks.`;
  if (c.includes('basis')) return `Deposit $${capital} into ${name}'s basis vault on ${chain} and keep the position open.`;
  if (c.includes('governance')) return `Lock $${capital} of voting power through ${name} on ${chain} and vote once.`;
  if (c.includes('chain')) return `Use $${capital} of ${name} on ${chain} for two real transactions a week apart.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`;
}

/**
 * A protocol's farm plan: six steps, each an action with a cost and a time.
 * The plan is derived from the protocol's own record (category, chains, TVL,
 * age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasPerTx(chain);
  const action = actionFor(p, capital, chain);
  return [
    {
      text: `Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.`,
      cost: `about $${gas} of gas for the first transaction`,
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and about $${gas} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: `Make one qualifying action each week for four weeks, such as a deposit, a borrow, a swap or a vote.`,
      cost: `about $${gas} of gas a week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot): BoardRow[] {
  const { fit, predict } = fitModel(snapshot);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the rankable rule would
  // set aside. A watchlist protocol is ranked whatever its category.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable protocol with no market cap.
  for (const p of snapshot.protocols) {
    if (!chosen.has(p.slug) && isRankable(p)) chosen.set(p.slug, p);
  }

  const err = fit.heldout_median_abs_log_error;
  const scored = [...chosen.values()].map((p) => {
    const age = ageDays(snapshot.as_of, p.listed_at);
    const fitted = predict(p);
    const growthPct = clamp(finite(p.change_7d, 0), MODEL.growth_floor, MODEL.growth_cap);
    const growthMult = 1 + (growthPct / 100) * MODEL.growth_weight;
    const maturityMult = age === null ? MODEL.unknown_age_maturity : MODEL.maturity_floor + (Math.min(age, MODEL.maturity_days) / MODEL.maturity_days) * (1 - MODEL.maturity_floor);
    const chainMult = 1 + MODEL.chain_step * Math.min(Math.max(p.chains.length - 1, 0), MODEL.chain_max);
    const { odds, band, bandRate, catRate } = tokenOdds(p, snapshot, fit);
    const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult * chainMult * odds));
    const bandLow = Math.max(1, Math.round(implied * Math.exp(-err)));
    const bandHigh = Math.max(1, Math.round(implied * Math.exp(err)));
    const gas = gasPerTx(chainOf(p));
    const planCost = gas * 6; // six gas-paying steps: setup, four weekly actions, claim
    const farmers = clamp(Math.round(p.tvl_usd / MODEL.farmer_capital_divisor), MODEL.farmer_min, MODEL.farmer_max);
    const expected = Math.round((bandLow * MODEL.farmer_pool_share) / farmers);
    const net = expected - planCost;
    const verdict: 'farm' | 'thin' | 'skip' = net >= MODEL.farm_net ? 'farm' : net >= 0 ? 'thin' : 'skip';
    return {
      p,
      age,
      fitted,
      growthMult,
      maturityMult,
      chainMult,
      odds,
      band,
      bandRate,
      catRate,
      implied,
      bandLow,
      bandHigh,
      planCost,
      expected,
      verdict,
    };
  });
  scored.sort((a, b) => b.implied - a.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    band_low_usd: s.bandLow,
    band_high_usd: s.bandHigh,
    verdict: s.verdict,
    expected_farmer_usd: s.expected,
    plan_cost_usd: s.planCost,
    model: {
      fitted_mcap_usd: Math.round(s.fitted),
      growth_multiplier: round4(s.growthMult),
      maturity_multiplier: round4(s.maturityMult),
      chain_multiplier: round4(s.chainMult),
      token_odds: round4(s.odds),
      age_band: s.band,
      age_band_rate: s.bandRate,
      category_rate: s.catRate,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** The live-token protocols, by market cap, for the dashboard's Live token view.
 *  Every protocol that records a market cap is here, even one recorded at $0:
 *  the board accounts for all 758 protocols, and none is silently dropped. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => p.mcap_usd !== null)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      change_7d: p.change_7d,
    }));
}

/** The protocols with no market cap that the board sets aside, with the reason. */
export function asideRows(snapshot: Snapshot, board: BoardRow[]): AsideRow[] {
  const onBoard = new Set(board.map((r) => r.slug));
  return snapshot.protocols
    .filter((p) => p.mcap_usd === null && !onBoard.has(p.slug))
    .sort((a, b) => b.tvl_usd - a.tvl_usd)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, reason: asideReason(p) }));
}

/** A board row's compact form for data.js, with its nearest token-bearing peers. */
export function radarRow(row: BoardRow, snapshot: Snapshot): RadarRow {
  const peers = snapshot.protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({ p, sameCat: (p.category ?? '') === (row.category ?? ''), dist: Math.abs(Math.log(p.tvl_usd) - Math.log(row.tvl_usd)) }))
    .sort((a, b) => (a.sameCat === b.sameCat ? a.dist - b.dist : a.sameCat ? -1 : 1))
    .slice(0, 3)
    .map(({ p }) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd!,
      multiple: round4(p.mcap_usd! / p.tvl_usd),
    }));
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    band_low_usd: row.band_low_usd,
    band_high_usd: row.band_high_usd,
    verdict: row.verdict,
    expected_farmer_usd: row.expected_farmer_usd,
    plan_cost_usd: row.plan_cost_usd,
    fitted_mcap_usd: row.model.fitted_mcap_usd,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    chain_multiplier: row.model.chain_multiplier,
    token_odds: row.model.token_odds,
    age_band: row.model.age_band,
    farm_steps: row.farm_steps,
    comps: peers,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot);
  const { fit } = fitModel(snapshot);
  const live = liveRows(snapshot);
  const aside = asideRows(snapshot, board);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model: MODEL,
    model_version: MODEL_VERSION,
    fit,
    watchlist_size: snapshot.watchlist.length,
    watchlist: [...snapshot.watchlist].sort(),
    board_size: board.length,
    protocols_total: snapshot.protocols.length,
    live_size: live.length,
    aside_size: aside.length,
    rows: board.map((r) => radarRow(r, snapshot)),
    live,
    aside,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
