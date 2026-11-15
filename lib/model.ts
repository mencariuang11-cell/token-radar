// The token radar's model, version radar-2: one snapshot of the protocol universe in, one ranked
// board out. Where radar-1 (the starter) multiplied every TVL by one flat constant, radar-2 prices
// each protocol the way the market already prices its traded peers:
//
//   peers      = the snapshot's own token-bearing protocols with a market cap, a TVL of at least
//                $25M and a category that is not CEX: the launches that already happened.
//   multiple   = market cap / TVL for each peer, clamped to [0.005, 20] so one micro-cap cannot
//                bend a category.
//   category   = a category's multiple is its peers' median, shrunk toward the global median with
//                a prior strength of 5 peers: M = (n x median + 5 x global) / (n + 5). A category
//                with no qualifying peer (Insurance, CeDeFi, ...) takes the global median whole.
//   implied    = TVL x M x momentum x maturity x breadth, where
//     momentum = 1 + clamp(change_7d, -50, 100)/100 x 0.6   (unreported growth counts as 0)
//     maturity = 0.75 + 0.5 x min(age_days, 1460)/1460      (an unlisted age counts as 365 days)
//     breadth  = 1 + 0.03 x min(chains - 1, 7)
//   low/high   = the same product with the category's shrunk 25th / 75th percentile multiple: the
//                spread the traded peers themselves show, not a confidence trick.
//
// Every row carries the multiple it used, the peer count behind it, the category and global medians
// and each multiplier, so any reader (or the dashboard, which recomputes it) can audit the number.
// A row also carries the raw seven-day change the snapshot records, beside the clamped figure the
// momentum factor actually used: four records in this snapshot run past the clamp, and the audit
// trail prints both rather than letting the clamped figure pose as the record.
// No protocol name is ever special-cased: the same function scores every row.
//
// The board covers every slug in the snapshot's watchlist and adds every other rankable pre-token
// protocol: the early rows the radar exists to find. Rankable applies the watchlist's own product
// rule at every size, not only above the floor: no token recorded, not an exchange, not a versioned
// pool of another protocol, and not a wrapped, staked or bridged product (the Bridge, Canonical
// Bridge, Liquid Staking, Liquid Restaking and Restaked BTC categories, a name carrying the whole
// word wrapped, staked or staking, or a name beginning with an exchange's). A wrapped product of a
// token that already trades is not a launch still to come, at $5M any more than at $50M.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  peer_min_tvl_usd: number;
  multiple_clamp_low: number;
  multiple_clamp_high: number;
  shrinkage_peers: number;
  momentum_weight: number;
  momentum_floor: number;
  momentum_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  chain_bonus_per_chain: number;
  chain_bonus_max_extra: number;
}

export const MODEL: ModelConstants = {
  peer_min_tvl_usd: 25_000_000,
  multiple_clamp_low: 0.005,
  multiple_clamp_high: 20,
  shrinkage_peers: 5,
  momentum_weight: 0.6,
  momentum_floor: -50,
  momentum_cap: 100,
  maturity_floor: 0.75,
  maturity_range: 0.5,
  maturity_days: 1460,
  unknown_age_days: 365,
  chain_bonus_per_chain: 0.03,
  chain_bonus_max_extra: 7,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2';

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 40;

/** The board's safety cap, far above this snapshot's rankable count and below the gate's 4,000. */
export const BOARD_MAX = 3900;

/** One category's peer statistics: the traded launches the model prices from. */
export interface CategoryStats {
  category: string;
  peers: number;
  median: number | null;
  p25: number | null;
  p75: number | null;
  /** The multiple a row of this category is priced with: the median shrunk toward the global one. */
  effective: number;
  effective_low: number;
  effective_high: number;
}

/** The global peer statistics: every qualifying peer, whatever its category. */
export interface GlobalStats {
  peers: number;
  median: number;
  p25: number;
  p75: number;
}

/** A qualifying peer: a token-bearing protocol the multiples are derived from. */
export interface PeerRow {
  slug: string;
  name: string;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
  multiple: number;
}

/** The audit trail of one row's implied value: every input the number came from. */
export interface RowModel {
  version: string;
  category_multiple: number;
  category_peers: number;
  category_median: number | null;
  global_median: number;
  multiple_low: number;
  multiple_high: number;
  /** The seven-day change exactly as the snapshot records it (null when unreported). */
  growth_raw_pct: number | null;
  /** The change the momentum factor used: growth_raw_pct clamped to the model's band. */
  growth_pct: number;
  momentum_multiplier: number;
  age_multiplier: number;
  chain_multiplier: number;
  chain_count: number;
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
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: RowModel;
  farm_steps: string[];
}

/** The dashboard's view of one board row: the row, its audit trail and its farm plan. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  listed_at: string | null;
  watchlist: boolean;
  age_days: number | null;
  implied_value_usd: number;
  implied_low_usd: number;
  implied_high_usd: number;
  model: RowModel;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** Everything the dashboard needs: the board, the comps behind it, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  implied_total_usd: number;
  watchlist_implied_usd: number;
  global: GlobalStats;
  categories: CategoryStats[];
  peers: PeerRow[];
  rows: RadarRow[];
  live: LiveRow[];
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

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** The median of a non-empty list. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** The lower quantile of a non-empty list: the value at floor(f x n), the definition the page reuses. */
function quantile(values: number[], f: number): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(f * s.length))]!;
}

/** A peer multiple, clamped to the band the model prices within. */
function peerMultiple(p: SnapshotProtocol, model: ModelConstants): number {
  const raw = p.mcap_usd! / p.tvl_usd;
  return Math.min(model.multiple_clamp_high, Math.max(model.multiple_clamp_low, raw));
}

/**
 * A qualifying peer: a protocol whose token already trades at a measurable size. Its market cap and
 * TVL are both recorded, its TVL clears the peer floor, and it is not an exchange's own token.
 */
export function isPeer(p: SnapshotProtocol, model: ModelConstants = MODEL): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd >= model.peer_min_tvl_usd && p.category !== 'CEX';
}

/** The category key a protocol's multiples are looked up under. */
function categoryKey(p: SnapshotProtocol): string {
  return p.category ?? 'Uncategorised';
}

/** Every category's peer statistics, and the global one, from the snapshot's traded protocols. */
export function peerStats(snapshot: Snapshot, model: ModelConstants = MODEL): { global: GlobalStats; byCategory: Map<string, CategoryStats> } {
  const peers = snapshot.protocols.filter((p) => isPeer(p, model));
  const all = peers.map((p) => peerMultiple(p, model));
  const global: GlobalStats = {
    peers: all.length,
    median: all.length > 0 ? median(all) : 0,
    p25: all.length > 0 ? quantile(all, 0.25) : 0,
    p75: all.length > 0 ? quantile(all, 0.75) : 0,
  };
  const groups = new Map<string, number[]>();
  for (const p of peers) {
    const key = categoryKey(p);
    const list = groups.get(key) ?? [];
    list.push(peerMultiple(p, model));
    groups.set(key, list);
  }
  const shrink = (n: number, own: number, globalValue: number): number =>
    n === 0 ? globalValue : (n * own + model.shrinkage_peers * globalValue) / (n + model.shrinkage_peers);
  const byCategory = new Map<string, CategoryStats>();
  for (const [category, values] of groups) {
    const med = median(values);
    const lo = quantile(values, 0.25);
    const hi = quantile(values, 0.75);
    byCategory.set(category, {
      category,
      peers: values.length,
      median: med,
      p25: lo,
      p75: hi,
      effective: shrink(values.length, med, global.median),
      effective_low: shrink(values.length, lo, global.p25),
      effective_high: shrink(values.length, hi, global.p75),
    });
  }
  return { global, byCategory };
}

/** The stats a category is priced with: its own when it has peers, the global fallback when not. */
function statsFor(byCategory: Map<string, CategoryStats>, global: GlobalStats, category: string): CategoryStats {
  return (
    byCategory.get(category) ?? {
      category,
      peers: 0,
      median: null,
      p25: null,
      p75: null,
      effective: global.median,
      effective_low: global.p25,
      effective_high: global.p75,
    }
  );
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  stats: CategoryStats,
  model: ModelConstants = MODEL,
): { implied: number; low: number; high: number; growthRawPct: number | null; growthPct: number; momentumMult: number; maturityMult: number; breadthMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const growthRawPct = typeof protocol.change_7d === 'number' && Number.isFinite(protocol.change_7d) ? protocol.change_7d : null;
  const growthPct = Math.min(model.momentum_cap, Math.max(model.momentum_floor, growthRawPct ?? 0));
  // Every factor is rounded to 4 places before it is used, so the factors a row prints are exactly
  // the factors that priced it: a reader (or the dashboard) multiplying the printed inputs gets the
  // printed value back, to the dollar.
  const momentumMult = round4(1 + (growthPct / 100) * model.momentum_weight);
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = round4(model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range);
  const breadthMult = round4(1 + model.chain_bonus_per_chain * Math.min(Math.max(protocol.chains.length - 1, 0), model.chain_bonus_max_extra));
  const at = (multiple: number): number => Math.max(1, Math.round(protocol.tvl_usd * round4(multiple) * momentumMult * maturityMult * breadthMult));
  const implied = at(stats.effective);
  return {
    implied,
    low: Math.min(implied, at(stats.effective_low)),
    high: Math.max(implied, at(stats.effective_high)),
    growthRawPct,
    growthPct,
    momentumMult,
    maturityMult,
    breadthMult,
    age,
  };
}

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** The categories that are a wrapped, staked or bridged product of another protocol by construction. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** A name carrying the whole word wrapped, staked or staking, in any case. */
const PRODUCT_WORD = /(?:^|[^A-Za-z])(wrapped|staked|staking)(?:[^A-Za-z]|$)/i;

/** A name beginning with an exchange's name. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/**
 * Whether a protocol is one the board may rank: pre-token, and not a wrapped, staked or bridged
 * product of a token that already trades — the watchlist's own rule, applied at every size.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return (
    isPreToken(p) &&
    !PRODUCT_CATEGORIES.has(p.category ?? '') &&
    !VERSIONED.test(p.name) &&
    !PRODUCT_WORD.test(p.name) &&
    !EXCHANGE_PREFIX.test(p.name)
  );
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const watchlist = new Set(snapshot.watchlist);
  const { global, byCategory } = peerStats(snapshot, model);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: every other rankable pre-token protocol, at any size, capped only for safety.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, Math.max(0, BOARD_MAX - chosen.size));
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => {
    const stats = statsFor(byCategory, global, categoryKey(p));
    const v = impliedValue(p, snapshot.as_of, stats, model);
    return { p, stats, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
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
    watchlist: watchlist.has(s.p.slug),
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    implied_low_usd: s.v.low,
    implied_high_usd: s.v.high,
    model: {
      version: MODEL_VERSION,
      category_multiple: round4(s.stats.effective),
      category_peers: s.stats.peers,
      category_median: s.stats.median === null ? null : round4(s.stats.median),
      global_median: round4(global.median),
      multiple_low: round4(s.stats.effective_low),
      multiple_high: round4(s.stats.effective_high),
      growth_raw_pct: s.v.growthRawPct === null ? null : round4(s.v.growthRawPct),
      growth_pct: s.v.growthPct,
      momentum_multiplier: round4(s.v.momentumMult),
      age_multiplier: round4(s.v.maturityMult),
      chain_multiplier: round4(s.v.breadthMult),
      chain_count: s.p.chains.length,
    },
    farm_steps: farmSteps(s.p, s.v.age, { rank: i + 1, of: scored.length, implied: s.v.implied }),
  }));
}

// ---------------------------------------------------------------- farm plans

/** What a farm plan is built from: the protocol's own record, nothing else. */
interface FarmProfile {
  /** The core position, as a sentence with the capital and chain already placed. */
  core: (name: string, chain: string, capital: number) => string;
  /** A second, different interaction with the same protocol. */
  second: (name: string, chain: string, capital: number) => string;
  /** The weekly qualifying action, as a noun phrase. */
  weekly: string;
}

/** The category profiles: how a farmer actually uses each kind of protocol. */
const PROFILES: Record<string, FarmProfile> = {
  Lending: {
    core: (n, c, k) => `Supply $${k} of USDC to ${n}'s markets on ${c} and leave the supply open.`,
    second: (n) => `Borrow a small amount against that supply on ${n} and repay it a few days later, so the wallet shows both sides of the market.`,
    weekly: 'a fresh supply, borrow or repay',
  },
  Dexs: {
    core: (n, c, k) => `Provide $${k} of liquidity to a main ${n} pool on ${c} (a stablecoin or blue-chip pair) and keep the position open.`,
    second: (n) => `Route a few swaps a week through ${n} itself rather than an aggregator, so the wallet builds its own trade volume there.`,
    weekly: 'a swap or a liquidity top-up',
  },
  'Risk Curators': {
    core: (n, c, k) => `Deposit $${k} of USDC into a ${n}-curated vault on ${c}, picking the vault with the deepest liquidity it lists.`,
    second: (n) => `Put a second, smaller deposit into a different ${n} vault with a different strategy, and keep both shares in the same wallet.`,
    weekly: 'a vault deposit or a move between vaults',
  },
  'Onchain Capital Allocator': {
    core: (n, c, k) => `Deposit $${k} of USDC into an allocator vault ${n} runs on ${c} and hold the vault shares in the same wallet.`,
    second: (n) => `Add a second deposit in a later week rather than one lump sum, so the wallet's history spans more than one snapshot.`,
    weekly: 'a deposit or a top-up',
  },
  Yield: {
    core: (n, c, k) => `Deposit $${k} of USDC into ${n}'s highest-TVL vault on ${c} and keep the shares.`,
    second: (n) => `Harvest or claim the yield once it accrues, so the wallet records a full earn cycle and not only a deposit.`,
    weekly: 'a deposit, a harvest or a top-up',
  },
  'Yield Aggregator': {
    core: (n, c, k) => `Deposit $${k} of USDC into a ${n} vault on ${c} and keep the vault shares.`,
    second: (n) => `Move a small part of the position into a second ${n} strategy, so the wallet shows more than one route through the app.`,
    weekly: 'a deposit, harvest or strategy switch',
  },
  RWA: {
    core: (n, c, k) => `Mint or buy $${k} of ${n}'s yield-bearing asset on ${c} and hold it in your own wallet.`,
    second: (n) => `Complete ${n}'s own onboarding if it asks for one (some RWA issuers gate minting), then hold through one full yield distribution before moving anything.`,
    weekly: 'a balance check and a claim of accrued yield where offered',
  },
  CDP: {
    core: (n, c, k) => `Open a vault on ${n} (${c}): post collateral and mint about $${k} worth of its stablecoin against it.`,
    second: (n) => `Repay part of the minted debt, then mint again in a later week, so the wallet shows a complete borrow cycle.`,
    weekly: 'a collateral top-up, mint or repay',
  },
  'CDP Manager': {
    core: (n, c, k) => `Open a managed CDP through ${n} on ${c} with about $${k} of collateral.`,
    second: (n) => `Let the manager run one full adjustment cycle before you intervene, so its automation records the position as live.`,
    weekly: 'a vault health check',
  },
  Derivatives: {
    core: (n, c, k) => `Deposit $${k} of USDC as margin on ${n} (${c}) and open one small hedged position.`,
    second: (n) => `Trade a second market in a different week at the same small size, keeping volume steady rather than in a single burst.`,
    weekly: 'one small trade',
  },
  'Basis Trading': {
    core: (n, c, k) => `Deposit $${k} of USDC into ${n}'s basis vault on ${c}.`,
    second: (n) => `Keep the deposit through one full funding cycle before judging it, since basis yield is paid over the cycle.`,
    weekly: 'a deposit top-up or a yield claim where offered',
  },
  Chain: {
    core: (n, c, k) => `Bridge about $${k} to ${c} and hold a working balance there, not a parked one.`,
    second: (n) => `Use two or three of the chain's own apps (a swap, a lend, a mint) so the wallet reads as a chain user.`,
    weekly: 'one transaction in the chain\u2019s own apps',
  },
  'Staking Pool': {
    core: (n, c, k) => `Stake $${k} of the chain's staking asset through ${n} on ${c} and keep the receipt in the same wallet.`,
    second: (n) => `Claim or compound the staking rewards once, so the wallet shows a rewards interaction as well as the stake.`,
    weekly: 'a small additional stake or a rewards claim',
  },
  Restaking: {
    core: (n, c, k) => `Restake $${k} of a liquid staking asset through ${n} on ${c} and keep the receipt in the same wallet.`,
    second: (n) => `Claim or compound rewards once they accrue, so the wallet records the rewards side of the protocol too.`,
    weekly: 'a small additional restake or a rewards claim',
  },
  'Leveraged Farming': {
    core: (n, c, k) => `Open a small leveraged position on ${n} (${c}) with $${k} of collateral, at the lowest leverage it offers.`,
    second: (n) => `Adjust or partially close the position once, so the wallet records risk management and not only an opening trade.`,
    weekly: 'a position check and one adjustment',
  },
  'Liquidity Manager': {
    core: (n, c, k) => `Deposit $${k} into a ${n}-managed vault or range on ${c}.`,
    second: (n) => `Withdraw and redeposit once at a new size, so the wallet shows an active managed position.`,
    weekly: 'a rebalance or a top-up',
  },
  'Prediction Market': {
    core: (n, c, k) => `Fund $${k} on ${n} and take positions in two or three of its most liquid markets.`,
    second: (n) => `Hold one position to settlement, so the wallet records a resolved market and not only open ones.`,
    weekly: 'one market position',
  },
  Payments: {
    core: (n, c, k) => `Route a real payment or a stream of about $${k} through ${n} on ${c}.`,
    second: (n) => `Keep a recurring stream or repeated payments running for several weeks rather than a single transfer.`,
    weekly: 'one payment or a stream top-up',
  },
  Insurance: {
    core: (n, c, k) => `Buy about $${k} of cover from ${n} on ${c} for a position you actually hold.`,
    second: (n) => `If ${n} takes underwriters, stake a small amount on the underwriting side as well, in a separate week.`,
    weekly: 'a cover renewal check',
  },
  Privacy: {
    core: (n, c, k) => `Deposit $${k} into ${n} on ${c} and make one shielded transfer between two wallets of your own.`,
    second: (n) => `Withdraw to a fresh address of yours after a delay, completing the full private cycle the protocol is built for.`,
    weekly: 'one shielded transfer',
  },
  'Cross Chain Bridge': {
    core: (n, c, k) => `Bridge $${k} of USDC through ${n} to ${c}, and use the bridged funds in the destination app the same day.`,
    second: (n) => `Bridge a smaller amount to a second destination, or back, in a later week.`,
    weekly: 'one small bridge',
  },
  'Stablecoin Wrapper': {
    core: (n, c, k) => `Mint about $${k} of the asset through ${n} on ${c} and hold it in your own wallet.`,
    second: (n) => `Redeem a small part once, so the wallet records both sides of the mint.`,
    weekly: 'a balance hold and one small mint or redeem',
  },
  'Dual-Token Stablecoin': {
    core: (n, c, k) => `Mint about $${k} of the stablecoin through ${n} on ${c} and hold it in your own wallet.`,
    second: (n) => `Provide a small part of it as liquidity or redeem a small part once, completing a full cycle.`,
    weekly: 'a balance hold and one small mint or redeem',
  },
  'Governance Incentives': {
    core: (n, c, k) => `Take the position ${n} rewards on ${c} (its app names it) with about $${k}.`,
    second: (n) => `Vote in one governance poll or claim one incentive round where the app offers it, from the same wallet.`,
    weekly: 'one rewarded action or a vote',
  },
  'Crypto Card Issuer': {
    core: (n, c, k) => `Activate the ${n} card if your region is served and fund it with about $${k}.`,
    second: (n) => `Make ordinary purchases with the card so the account shows real usage, not a single load.`,
    weekly: 'one card purchase',
  },
  'OTC Marketplace': {
    core: (n, c, k) => `Register on ${n} and complete one small trade of about $${k} on ${c}.`,
    second: (n) => `Quote or take a second trade in a different week, so the account shows a pattern and not a single visit.`,
    weekly: 'one quote check or small trade',
  },
  'Options Vault': {
    core: (n, c, k) => `Deposit $${k} into a ${n} options vault on ${c}.`,
    second: (n) => `Stay through one full expiry cycle before withdrawing anything, since vault shares settle on the cycle.`,
    weekly: 'a vault roll or a top-up',
  },
  'Uncollateralized Lending': {
    core: (n, c, k) => `Supply $${k} to a ${n} pool on ${c} whose borrower its own page names.`,
    second: (n) => `Hold to one repayment date before withdrawing, so the wallet records a completed loan cycle.`,
    weekly: 'a pool statement check',
  },
  'Interest Rate Derivatives': {
    core: (n, c, k) => `Deposit $${k} of margin on ${n} (${c}) and open one small interest-rate position.`,
    second: (n) => `Roll or close the position at expiry and open another in a later week.`,
    weekly: 'one position check',
  },
  'Collateral Markets': {
    core: (n, c, k) => `Post $${k} of collateral on ${n} (${c}) in the market it runs.`,
    second: (n) => `Use the posted collateral for one small position rather than leaving it idle.`,
    weekly: 'a collateral top-up or a position check',
  },
  CeDeFi: {
    core: (n, c, k) => `Deposit $${k} through ${n}'s app on ${c} into its main yield product.`,
    second: (n) => `Withdraw a small part once and redeposit it, completing a full cycle in the app.`,
    weekly: 'a balance and yield check',
  },
  Farm: {
    core: (n, c, k) => `Stake $${k} in ${n}'s main farm on ${c}.`,
    second: (n) => `Harvest the rewards once and restake or hold them in the same wallet.`,
    weekly: 'a harvest or a top-up',
  },
};

/** The profile a category farms by: its own entry, else a keyword match, else the default. */
function profileFor(category: string | null): FarmProfile {
  if (category !== null && PROFILES[category] !== undefined) return PROFILES[category]!;
  const c = (category ?? '').toLowerCase();
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return PROFILES['Lending']!;
  if (c.includes('dex') || c.includes('swap')) return PROFILES['Dexs']!;
  if (c.includes('curator')) return PROFILES['Risk Curators']!;
  if (c.includes('bridge')) return PROFILES['Cross Chain Bridge']!;
  if (c.includes('restak')) return PROFILES['Restaking']!;
  if (c.includes('staking') || c.includes('stake')) return PROFILES['Staking Pool']!;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('option')) return PROFILES['Derivatives']!;
  if (c.includes('prediction')) return PROFILES['Prediction Market']!;
  if (c.includes('stable')) return PROFILES['Stablecoin Wrapper']!;
  if (c.includes('rwa')) return PROFILES['RWA']!;
  if (c.includes('insurance')) return PROFILES['Insurance']!;
  if (c.includes('yield') || c.includes('vault') || c.includes('allocator')) return PROFILES['Yield']!;
  return {
    core: (n, ch, k) => `Deposit $${k} of USDC into ${n} on ${ch} and keep the position open.`,
    second: (n) => `Make one further interaction of a different kind in ${n}'s app (a second deposit, a claim or a vote) in a later week.`,
    weekly: 'one qualifying action',
  };
}

/** The gas token a chain's fees are paid in, for the chains farmers meet most; else a plain phrase. */
const GAS_TOKEN: Record<string, string> = {
  Ethereum: 'ETH', Base: 'ETH', Arbitrum: 'ETH', Optimism: 'ETH', Linea: 'ETH', Scroll: 'ETH',
  'zkSync Era': 'ETH', Blast: 'ETH', Mode: 'ETH', Mantle: 'MNT', Solana: 'SOL', 'BNB Chain': 'BNB',
  Avalanche: 'AVAX', Polygon: 'POL', Sui: 'SUI', Aptos: 'APT', Near: 'NEAR', Tron: 'TRX',
  Bitcoin: 'BTC', Berachain: 'BERA', Sonic: 'S', Sei: 'SEI', Hyperliquid: 'HYPE', Monad: 'MON',
  Cosmos: 'ATOM', Fantom: 'FTM', Gnosis: 'xDAI', Celo: 'CELO', Starknet: 'STRK', TON: 'TON',
};

/** About what one transaction costs on a chain: mainnet is dear, most others are cents. */
function gasCost(chain: string): string {
  if (chain === 'Ethereum') return 'about $10';
  if (chain === 'Bitcoin') return 'about $3';
  if (chain === 'Solana' || chain === 'Tron') return 'about $1';
  return 'about $2';
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 250_000_000) return 200;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 25_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  if (age < 730) return 30;
  return 21;
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: { text: string; cost: string; time: string }): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, built from the
 * protocol's own record — its category's way of being used, its first two chains by name, a capital
 * sized to its TVL, a hold sized to its age, and a note that follows its seven-day momentum. The
 * last step closes with the stake: the rank and implied launch value the board itself gives the
 * protocol, so the plan names the prize it farms toward. No name is special-cased and no two
 * protocols of different categories share a plan.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, stake?: { rank: number; of: number; implied: number }): string[] {
  const profile = profileFor(p.category);
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = GAS_TOKEN[chain] ?? 'the chain\u2019s gas token';
  const steps: { text: string; cost: string; time: string }[] = [
    {
      text: `Set up a fresh wallet for ${p.name} and fund it on ${chain} with ${gas} for fees plus the position capital below; keep its seed phrase offline and use this one wallet for everything that follows.`,
      cost: `${gasCost(chain)} of gas to fund and approve`,
      time: '10 minutes',
    },
    {
      text: profile.core(p.name, chain, capital),
      cost: `$${capital} of capital and ${gasCost(chain)} of gas`,
      time: '15 minutes to set up',
    },
    {
      text: profile.second(p.name, chain, capital),
      cost: `about $${Math.max(10, Math.round(capital / 5))} at most, plus ${gasCost(chain)} of gas`,
      time: '10 minutes',
    },
  ];
  if (p.chains.length >= 2) {
    const second = p.chains[1]!;
    const more = p.chains.length >= 3 ? `, and later on ${p.chains[2]}` : '';
    steps.push({
      text: `Repeat the core position on ${second} at about half size${more}: ${p.name} runs on ${p.chains.length} chains, and activity on more than one of them is the pattern points programs most often reward.`,
      cost: `about $${Math.round(capital / 2)} of capital and ${gasCost(second)} of gas`,
      time: '15 minutes',
    });
  } else {
    steps.push({
      text: `Deepen the same position on ${chain} with a second deposit of about half the first, in a separate week, so the wallet's history is a pattern of use and not a single visit.`,
      cost: `about $${Math.round(capital / 2)} of capital and ${gasCost(chain)} of gas`,
      time: '10 minutes',
    });
  }
  steps.push({
    text: `Keep a weekly rhythm: ${profile.weekly} on ${p.name}, every week, from the same wallet.`,
    cost: 'about $2 of gas a week',
    time: '10 minutes a week',
  });
  const momentum =
    p.change_7d === null
      ? `Its TVL was steady in the record this board reads.`
      : p.change_7d >= 10
        ? `Its TVL grew ${p.change_7d.toFixed(1)}% in the last seven days of the record, so keep the position through the growth: weekly snapshots catch holders, not visitors.`
        : p.change_7d <= -10
          ? `Its TVL fell ${Math.abs(p.change_7d).toFixed(1)}% in the last seven days of the record; steady activity through a dip is what separates a farmer from a tourist in most points programs.`
          : `Its TVL moved ${p.change_7d >= 0 ? '+' : ''}${p.change_7d.toFixed(1)}% in the last seven days of the record, no strong signal either way.`;
  steps.push({
    text: `Hold every position for at least ${hold} days so the activity lands in several weekly snapshots. ${momentum}`,
    cost: `the $${capital} stays in the position`,
    time: `${hold} days`,
  });
  const stakeText =
    stake === undefined
      ? ''
      : ` The stake: this board ranks ${p.name} #${stake.rank} of ${stake.of} at an implied launch value of $${stake.implied.toLocaleString('en-US')} — the prize this plan farms toward, and it moves if the record does.`;
  steps.push({
    text: `Open ${p.name}'s own app and look for its points, rewards or governance page; if it runs one, link this same wallet there and claim only from a link the app itself publishes — never pay a third party to claim. Write the wallet, the dates and every transaction in a farm log as you go.${stakeText}`,
    cost: 'no fee to check, and never pay to claim',
    time: '10 minutes, then 5 minutes a week for the log',
  });
  return steps.map(stepText);
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : 1))
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's form for data.js: the row, its audit trail and its farm plan. */
export function radarRow(row: BoardRow): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    listed_at: row.listed_at,
    watchlist: row.watchlist,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    implied_low_usd: row.implied_low_usd,
    implied_high_usd: row.implied_high_usd,
    model: row.model,
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { global, byCategory } = peerStats(snapshot, model);
  const boardCategories = new Map<string, { rows: number; watchlist: number }>();
  for (const row of board) {
    const key = row.category ?? 'Uncategorised';
    const entry = boardCategories.get(key) ?? { rows: 0, watchlist: 0 };
    entry.rows += 1;
    if (row.watchlist) entry.watchlist += 1;
    boardCategories.set(key, entry);
  }
  const categories: CategoryStats[] = [...boardCategories.entries()]
    .map(([category]) => statsFor(byCategory, global, category))
    .sort((a, b) => (boardCategories.get(b.category)?.rows ?? 0) - (boardCategories.get(a.category)?.rows ?? 0) || (a.category < b.category ? -1 : 1));
  const peers: PeerRow[] = snapshot.protocols
    .filter((p) => isPeer(p, model))
    .sort((a, b) => b.mcap_usd! - a.mcap_usd! || (a.slug < b.slug ? -1 : 1))
    .slice(0, 120)
    .map((p) => ({ slug: p.slug, name: p.name, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd!, multiple: round4(peerMultiple(p, model)) }));
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: board.filter((r) => !r.watchlist).length,
    live_size: live.length,
    implied_total_usd: board.reduce((n, r) => n + r.implied_value_usd, 0),
    watchlist_implied_usd: board.filter((r) => r.watchlist).reduce((n, r) => n + r.implied_value_usd, 0),
    global: { peers: global.peers, median: round4(global.median), p25: round4(global.p25), p75: round4(global.p75) },
    categories,
    peers,
    rows: board.map(radarRow),
    live,
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
    for (const s of steps) if (s.trim().length < 20 || s.trim().length > 600) return `${r.slug} has a farm step of ${s.trim().length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!(r.implied_low_usd <= r.implied_value_usd && r.implied_value_usd <= r.implied_high_usd)) return `${r.slug} has an implied range that excludes its own value`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
