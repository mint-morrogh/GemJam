// ---------------------------------------------------------------------------
// Shop system — appears between levels after shake+settle
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import { setGarnetChance, getGarnetChance, setHeavyChance, getHeavyChance, setBonusChance, getBonusChance, setTierSkipChance, getTierSkipChance, setBonusGemSpawnChance, getBonusGemSpawnChance, setBlackholeChance, getBlackholeChance, setExplosionChance, getExplosionChance, setRainbowDropChance, getRainbowDropChance } from './state';

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

let gold = 0;
let goldEarnedThisRun = 0;
export function getGold(): number { return gold; }
export function getGoldEarnedThisRun(): number { return goldEarnedThisRun; }
export function addGold(amount: number): void {
  const a = Math.round(amount * goldMultiplier);
  gold += a;
  goldEarnedThisRun += a;
}
export function setGoldAmount(v: number): void { gold = v; }

/** Gold earned per merge by result tier. */
const GOLD_PER_TIER = [1, 1, 2, 3, 5, 8, 12, 20, 35, 60, 100, 200];

export function goldForTier(tier: number): number {
  return GOLD_PER_TIER[tier] ?? 1;
}

// ---------------------------------------------------------------------------
// Floating gold text
// ---------------------------------------------------------------------------

interface FloatingText {
  x: number;
  y: number;
  text: string;
  age: number;
  lifetime: number;
  color: string;
  fontSize: number;
  rainbow: boolean;
}

const floats: FloatingText[] = [];

export function spawnFloatingLabel(x: number, y: number, text: string, color: string, lifetime = 1.0, fontSize = 14): void {
  floats.push({ x, y, text, age: 0, lifetime, color, fontSize, rainbow: false });
}

export function spawnGoldText(x: number, y: number, amount: number): void {
  floats.push({
    x, y,
    text: `+${amount} GOLD`,
    age: 0,
    lifetime: 0.8,
    color: '#FBBF24',
    fontSize: 14,
    rainbow: false,
  });
}

export function spawnScoreText(x: number, y: number, points: number, combo: number): void {
  const size = Math.min(32, 13 + combo * 3);
  const isRainbow = combo >= 5;
  const comboStr = combo >= 2 ? ` x${combo}` : '';
  floats.push({
    x, y,
    text: `+${points.toLocaleString()} SCORE${comboStr}`,
    age: 0,
    lifetime: 0.7 + Math.min(combo * 0.1, 0.5),
    color: '#ffffff',
    fontSize: size,
    rainbow: isRainbow,
  });
}

export function updateFloatingText(dt: number): void {
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].age += dt;
    floats[i].y -= 50 * dt; // faster upward drift
    if (floats[i].age >= floats[i].lifetime) {
      floats[i] = floats[floats.length - 1];
      floats.pop();
    }
  }
}

export function drawFloatingText(ctx: CanvasRenderingContext2D): void {
  if (floats.length === 0) return;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const f of floats) {
    const t = f.age / f.lifetime;
    // Pop-in scale: starts at 1.4x then settles to 1.0x in first 20%
    const scaleT = t < 0.2 ? 1.4 - t * 2 : 1;
    // Fade out in the second half
    const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) / 0.5;
    const sz = Math.round(f.fontSize * scaleT);

    ctx.globalAlpha = alpha;
    ctx.font = `bold ${sz}px monospace`;

    // Subtle shadow/outline for readability
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillText(f.text, f.x + 1, f.y + 1);

    if (f.rainbow) {
      // Cycling rainbow hue
      const hue = ((f.age * 360) + f.x) % 360;
      ctx.fillStyle = `hsl(${hue}, 100%, 70%)`;
    } else {
      ctx.fillStyle = f.color;
    }
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Rarity system
// ---------------------------------------------------------------------------

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const RARITY_WEIGHTS = [50, 25, 15, 7, 3]; // drop weights
const RARITY_COLORS: Record<Rarity, string> = {
  common: '#9CA3AF',
  uncommon: '#4ADE80',
  rare: '#60A5FA',
  epic: '#C084FC',
  legendary: '#FBBF24',
};
const RARITY_LABELS: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};
const RARITY_MULT: Record<Rarity, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 2,
  epic: 3,
  legendary: 5,
};
const RARITY_COST_MULT: Record<Rarity, number> = {
  common: 1,
  uncommon: 2,
  rare: 4,
  epic: 8,
  legendary: 16,
};

function rollRarity(): Rarity {
  const total = RARITY_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < RARITIES.length; i++) {
    r -= RARITY_WEIGHTS[i];
    if (r <= 0) return RARITIES[i];
  }
  return 'common';
}

// ---------------------------------------------------------------------------
// Shop item definitions
// ---------------------------------------------------------------------------

interface ShopItemDef {
  id: string;
  name: string;
  /** Optional color for the item name (e.g. red for Garnet). */
  nameColor?: string;
  description: (pct: number) => string;
  basePct: number;
  baseCost: number;
  apply: (pct: number) => void;
  /**
   * Flat unlocks don't scale with rarity: fixed cost, fixed effect per purchase,
   * no rarity border. Their `apply` ignores the pct argument. The card is
   * displayed in a distinct "upgrade" style.
   */
  flat?: boolean;
  /**
   * Returns false once the upgrade has hit its cap. When false, the def is
   * excluded from shop rolls so it stops appearing.
   */
  isAvailable?: () => boolean;
  /**
   * Optional per-rarity count override. If set, replaces the default
   * `basePct × RARITY_MULT[rarity]` scaling — useful when the effect is an
   * integer count that doesn't fit the multiplicative pct curve.
   */
  rarityPct?: Record<Rarity, number>;
}

// Combo window state (accessible to scoring via import)
let comboWindowBonus = 0;
export function getComboWindowBonus(): number { return comboWindowBonus; }

// Gold multiplier
let goldMultiplier = 1;
export function getGoldMultiplier(): number { return goldMultiplier; }

let bounceBonus = 0;
export function getBounceBonus(): number { return bounceBonus; }

// -- New meta-upgrade state -------------------------------------------------

/** Fraction of unspent gold awarded as interest when the shop opens (0..0.5). */
let interestRate = 0;
/** Fraction discounted off all item prices (0..0.5). Does not apply to reroll cost. */
let discountRate = 0;
/** Total free rerolls purchased across the run (capped at 3). */
let freeRerollsPurchased = 0;
/** Free rerolls remaining in the current shop visit. Refilled on shop open. */
let freeRerollsRemaining = 0;
/** Extra shop slots purchased (capped at 2 — 6 base → up to 8 total). */
let extraSlots = 0;
/** Max items the player can lock simultaneously (base 1, capped at 3). */
let lockCapacity = 1;
/** Monotonic counter: stamps each lock so we can evict the oldest when over cap. */
let lockOrderCounter = 0;
/** Remaining "redo" charges — each consumed charge discards the current launcher gem. Persists across levels. */
let skipThrowCharges = 0;

export function getInterestRate(): number { return interestRate; }
export function getDiscountRate(): number { return discountRate; }
export function getFreeRerollsRemaining(): number { return freeRerollsRemaining; }
export function getLockCapacity(): number { return lockCapacity; }
export function getSkipThrowCharges(): number { return skipThrowCharges; }
export function consumeSkipThrowCharge(): boolean {
  if (skipThrowCharges <= 0) return false;
  skipThrowCharges -= 1;
  return true;
}
function getSlotCount(): number { return 6 + extraSlots; }
function applyDiscount(baseCost: number): number {
  return Math.max(1, Math.round(baseCost * (1 - discountRate)));
}

const ITEM_DEFS: ShopItemDef[] = [
  {
    id: 'garnet_chance',
    name: 'Sapphire Finder',
    nameColor: '#2563EB',
    description: (pct) => `+${pct.toFixed(1)}% sapphire in launcher`,
    basePct: 1,
    baseCost: 120,
    apply: (pct) => setGarnetChance(Math.min(0.5, getGarnetChance() + pct / 100)),
  },
  {
    id: 'heavy_chance',
    name: 'Heavy Gem',
    description: (pct) => `+${pct.toFixed(1)}% heavy gem chance`,
    basePct: 1,
    baseCost: 150,
    apply: (pct) => setHeavyChance(Math.min(0.4, getHeavyChance() + pct / 100)),
  },
  {
    id: 'combo_window',
    name: 'Combo Extender',
    description: (pct) => `+${(pct * 10).toFixed(0)}ms combo window`,
    basePct: 1,
    baseCost: 100,
    apply: (pct) => { comboWindowBonus += pct * 0.01; },
  },
  {
    id: 'gold_rush',
    name: 'Gold Rush',
    description: (pct) => `+${pct.toFixed(0)}% gold per merge`,
    basePct: 5,
    baseCost: 180,
    apply: (pct) => { goldMultiplier += pct / 100; },
  },
  {
    id: 'bouncy',
    name: 'Bounce Boost',
    description: (pct) => `+${pct.toFixed(0)}% bouncier gems`,
    basePct: 5,
    baseCost: 100,
    apply: (pct) => { bounceBonus += pct / 100; },
  },
  {
    id: 'bonus_chance',
    name: 'Score Gem',
    description: (pct) => `+${pct.toFixed(1)}% chance for 5x score gem`,
    basePct: 1,
    baseCost: 200,
    apply: (pct) => setBonusChance(Math.min(0.3, getBonusChance() + pct / 100)),
  },
  {
    id: 'tier_skip',
    name: 'Tier Skip',
    description: (pct) => `+${pct.toFixed(1)}% chance to skip a tier on merge`,
    basePct: 2,
    baseCost: 220,
    apply: (pct) => setTierSkipChance(Math.min(0.4, getTierSkipChance() + pct / 100)),
  },
  {
    id: 'bonus_gem_spawn',
    name: 'Bonus Gem',
    description: (pct) => `+${pct.toFixed(1)}% chance to spawn extra gem on merge`,
    basePct: 1,
    baseCost: 180,
    apply: (pct) => setBonusGemSpawnChance(Math.min(0.3, getBonusGemSpawnChance() + pct / 100)),
  },
  {
    id: 'blackhole',
    name: 'Black Hole',
    description: (pct) => `+${pct.toFixed(1)}% chance for black hole gem`,
    basePct: 0.3,
    baseCost: 300,
    apply: (pct) => setBlackholeChance(Math.min(0.15, getBlackholeChance() + pct / 100)),
  },
  {
    id: 'explosion',
    name: 'Volatile Merge',
    description: (pct) => `+${pct.toFixed(1)}% chance merge explodes`,
    basePct: 0.3,
    baseCost: 160,
    apply: (pct) => setExplosionChance(Math.min(0.2, getExplosionChance() + pct / 100)),
  },
  // -- Meta upgrades --------------------------------------------------------
  // These rewrite shop economy rather than in-run gem behavior.
  {
    id: 'interest',
    name: 'Interest',
    nameColor: '#FBBF24',
    description: (pct) => `+${pct.toFixed(1)}% interest on unspent gold between shops`,
    basePct: 5,
    baseCost: 250,
    apply: (pct) => { interestRate = Math.min(0.5, interestRate + pct / 100); },
    isAvailable: () => interestRate < 0.5,
  },
  {
    id: 'discount',
    name: 'Discount',
    nameColor: '#34D399',
    description: (pct) => `-${pct.toFixed(1)}% off all shop items`,
    basePct: 5,
    baseCost: 200,
    apply: (pct) => { discountRate = Math.min(0.5, discountRate + pct / 100); },
    isAvailable: () => discountRate < 0.5,
  },
  {
    id: 'free_reroll',
    name: 'Free Reroll',
    nameColor: '#7dd3fc',
    description: () => '+1 free reroll every shop visit',
    basePct: 1,
    baseCost: 300,
    flat: true,
    apply: () => {
      freeRerollsPurchased += 1;
      freeRerollsRemaining += 1; // usable in the current shop
    },
    isAvailable: () => freeRerollsPurchased < 3,
  },
  {
    id: 'extra_slot',
    name: 'Extra Slot',
    nameColor: '#FBBF24',
    description: () => '+1 shop slot for the rest of the run',
    basePct: 1,
    baseCost: 500,
    flat: true,
    apply: () => { extraSlots += 1; },
    isAvailable: () => extraSlots < 2,
  },
  {
    id: 'extra_lock',
    name: 'Extra Lock',
    nameColor: '#C084FC',
    description: () => '+1 item you can lock at a time',
    basePct: 1,
    baseCost: 350,
    flat: true,
    apply: () => { lockCapacity += 1; },
    isAvailable: () => lockCapacity < 3,
  },
  {
    id: 'skip_throw',
    name: 'Skip Throw',
    nameColor: '#67E8F9',
    description: (pct) => `+${Math.round(pct)} redo charges to discard the current gem`,
    basePct: 1, // unused — rarityPct below overrides the default scaling
    baseCost: 180,
    apply: (pct) => { skipThrowCharges += Math.round(pct); },
    // Cluster purchase — generous base + ~+3 per rarity step so banking a
    // stockpile is a viable strategy. No hard cap.
    rarityPct: { common: 4, uncommon: 7, rare: 10, epic: 13, legendary: 16 },
  },
  {
    id: 'rainbow_drop',
    name: 'Rainbow Drop',
    nameColor: '#F472B6',
    description: (pct) => `+${pct.toFixed(2)}% chance launcher gem is rainbow`,
    basePct: 0.1,
    baseCost: 800, // wildly expensive — these spawn prestige gems
    apply: (pct) => setRainbowDropChance(Math.min(0.02, getRainbowDropChance() + pct / 100)),
    isAvailable: () => getRainbowDropChance() < 0.02,
  },
];

// ---------------------------------------------------------------------------
// Shop state
// ---------------------------------------------------------------------------

export interface ShopItem {
  def: ShopItemDef;
  rarity: Rarity;
  pct: number;
  cost: number;
  bought: boolean;
  locked: boolean;
  /**
   * Monotonic stamp set when locked; 0 when unlocked. Used to evict the oldest
   * lock when a new one would exceed lockCapacity.
   */
  lockOrder: number;
  /** Seconds remaining of the unlock animation when this item arrives from the previous shop. 0 = none. */
  unlockAnim: number;
}

let shopItems: ShopItem[] = [];
let shopOpen = false;
let rerollCount = 0;
/** Items locked in the previous shop visit, waiting to appear in the next one. */
let pendingLockedItems: ShopItem[] = [];

const UNLOCK_ANIM_DURATION = 0.6; // seconds for the lock-disappearing animation

export function isShopOpen(): boolean { return shopOpen; }
export function getRerollCost(): number { return 100 * Math.pow(2, rerollCount); }

/** Return ITEM_DEFS filtered to only currently-available upgrades. */
function availableDefs(): ShopItemDef[] {
  return ITEM_DEFS.filter(d => !d.isAvailable || d.isAvailable());
}

/** Build a fresh ShopItem from a def. Flat items skip rarity scaling. */
function makeShopItem(def: ShopItemDef): ShopItem {
  if (def.flat) {
    return {
      def,
      rarity: 'common', // unused for flat items — display overrides anyway
      pct: def.basePct,
      cost: applyDiscount(def.baseCost),
      bought: false,
      locked: false,
      lockOrder: 0,
      unlockAnim: 0,
    };
  }
  const rarity = rollRarity();
  const mult = RARITY_MULT[rarity];
  const costMult = RARITY_COST_MULT[rarity];
  const pct = def.rarityPct ? def.rarityPct[rarity] : def.basePct * mult;
  return {
    def,
    rarity,
    pct,
    cost: applyDiscount(def.baseCost * costMult),
    bought: false,
    locked: false,
    lockOrder: 0,
    unlockAnim: 0,
  };
}

function rollShopItems(): void {
  shopItems = [];
  // Carried-over locked items take priority — they get the leftmost slots
  // and play an unlock animation when the shop opens.
  for (const carried of pendingLockedItems) {
    carried.locked = false;
    carried.lockOrder = 0;
    carried.unlockAnim = UNLOCK_ANIM_DURATION;
    shopItems.push(carried);
  }
  pendingLockedItems = [];
  // Fill the remaining slots with fresh rolls, avoiding maxed-out upgrades.
  const slotCount = getSlotCount();
  while (shopItems.length < slotCount) {
    const pool = availableDefs();
    if (pool.length === 0) break; // every upgrade is maxed — leave remaining slots empty
    const def = pool[Math.floor(Math.random() * pool.length)];
    shopItems.push(makeShopItem(def));
  }
}

/** Open the shop. Only generates new items if the shop is empty. */
export function openShop(): void {
  shopOpen = true;
  if (shopItems.length === 0) {
    // Pay interest on carried-over gold BEFORE rolling items so the player
    // sees the new total factored into affordability. Floating text is spawned
    // by the caller (main.ts owns VIRTUAL_WIDTH/HEIGHT + float positioning).
    if (interestRate > 0 && gold > 0) {
      const bonus = Math.floor(gold * interestRate);
      if (bonus > 0) {
        gold += bonus;
        lastInterestPaid = bonus;
      }
    }
    // Reset free rerolls for the new visit
    freeRerollsRemaining = freeRerollsPurchased;
    rollShopItems();
  }
}

/** Interest paid the most recent time openShop ran. Consumed by the renderer for feedback. */
let lastInterestPaid = 0;
export function consumeLastInterestPaid(): number {
  const v = lastInterestPaid;
  lastInterestPaid = 0;
  return v;
}

/** Advance unlock animations. Call each frame while the shop is open. */
export function updateShop(dt: number): void {
  if (!shopOpen) return;
  for (const item of shopItems) {
    if (item.unlockAnim > 0) {
      item.unlockAnim = Math.max(0, item.unlockAnim - dt);
    }
  }
}

/** Reroll only the unbought, unlocked items. Locked items keep their slots. */
export function rerollShop(): boolean {
  // Free rerolls take priority: they don't consume gold and don't advance
  // rerollCount (so the paid price doesn't climb from "spending" freebies).
  if (freeRerollsRemaining > 0) {
    freeRerollsRemaining -= 1;
  } else {
    const cost = getRerollCost();
    if (gold < cost) return false;
    gold -= cost;
    rerollCount++;
  }
  for (let i = 0; i < shopItems.length; i++) {
    const cur = shopItems[i];
    if (cur.locked || cur.bought) continue; // preserve locked + already-bought slots
    const pool = availableDefs();
    if (pool.length === 0) continue;
    const def = pool[Math.floor(Math.random() * pool.length)];
    shopItems[i] = makeShopItem(def);
  }
  return true;
}

export function closeShop(): void {
  shopOpen = false;
}

export function buyItem(index: number): boolean {
  const item = shopItems[index];
  if (!item || item.bought || item.locked || gold < item.cost) return false;
  gold -= item.cost;
  item.bought = true;
  item.def.apply(item.pct);
  return true;
}

export function clearShopForNextLevel(): void {
  // Carry locked, unbought items into the next shop visit. They'll appear
  // with an unlock animation when the next shop opens.
  pendingLockedItems = shopItems.filter(it => it.locked && !it.bought);
  shopItems = [];
  shopOpen = false;
  rerollCount = 0;
}

export function resetShop(): void {
  gold = 0;
  goldEarnedThisRun = 0;
  shopItems = [];
  pendingLockedItems = [];
  shopOpen = false;
  rerollCount = 0;
  setGarnetChance(0);
  setHeavyChance(0);
  setBonusChance(0);
  setTierSkipChance(0);
  setBonusGemSpawnChance(0);
  setBlackholeChance(0);
  setExplosionChance(0);
  comboWindowBonus = 0;
  goldMultiplier = 1;
  bounceBonus = 0;
  interestRate = 0;
  discountRate = 0;
  freeRerollsPurchased = 0;
  freeRerollsRemaining = 0;
  extraSlots = 0;
  lockCapacity = 1;
  lockOrderCounter = 0;
  lastInterestPaid = 0;
  skipThrowCharges = 0;
  setRainbowDropChance(0);
}

// ---------------------------------------------------------------------------
// Shop persistence helpers
// ---------------------------------------------------------------------------

/** Get summary of all active upgrades for display. */
export function getActiveUpgrades(): { name: string; value: string }[] {
  const ups: { name: string; value: string }[] = [];
  const gc = getGarnetChance();    if (gc > 0) ups.push({ name: 'Sapphire Finder', value: `${(gc * 100).toFixed(1)}%` });
  const hc = getHeavyChance();     if (hc > 0) ups.push({ name: 'Heavy Gem', value: `${(hc * 100).toFixed(1)}%` });
  const bc = getBonusChance();     if (bc > 0) ups.push({ name: 'Score Gem', value: `${(bc * 100).toFixed(1)}%` });
  const ts = getTierSkipChance();  if (ts > 0) ups.push({ name: 'Tier Skip', value: `${(ts * 100).toFixed(1)}%` });
  const bg = getBonusGemSpawnChance(); if (bg > 0) ups.push({ name: 'Bonus Gem', value: `${(bg * 100).toFixed(1)}%` });
  const bh = getBlackholeChance(); if (bh > 0) ups.push({ name: 'Black Hole', value: `${(bh * 100).toFixed(1)}%` });
  const ex = getExplosionChance(); if (ex > 0) ups.push({ name: 'Volatile Merge', value: `${(ex * 100).toFixed(1)}%` });
  if (comboWindowBonus > 0) ups.push({ name: 'Combo Extend', value: `+${(comboWindowBonus * 1000).toFixed(0)}ms` });
  if (goldMultiplier > 1) ups.push({ name: 'Gold Rush', value: `${((goldMultiplier - 1) * 100).toFixed(0)}%` });
  if (bounceBonus > 0) ups.push({ name: 'Bounce Boost', value: `+${(bounceBonus * 100).toFixed(0)}%` });
  if (interestRate > 0) ups.push({ name: 'Interest', value: `${(interestRate * 100).toFixed(0)}%` });
  if (discountRate > 0) ups.push({ name: 'Discount', value: `-${(discountRate * 100).toFixed(0)}%` });
  if (freeRerollsPurchased > 0) ups.push({ name: 'Free Rerolls', value: `${freeRerollsPurchased}` });
  if (extraSlots > 0) ups.push({ name: 'Extra Slots', value: `+${extraSlots}` });
  if (lockCapacity > 1) ups.push({ name: 'Lock Capacity', value: `${lockCapacity}` });
  if (skipThrowCharges > 0) ups.push({ name: 'Skip Throws', value: `${skipThrowCharges}` });
  const rd = getRainbowDropChance(); if (rd > 0) ups.push({ name: 'Rainbow Drop', value: `${(rd * 100).toFixed(2)}%` });
  return ups;
}

export function getShopSaveData(): Record<string, any> {
  return {
    gold,
    garnetChance: getGarnetChance(),
    heavyChance: getHeavyChance(),
    bonusChance: getBonusChance(),
    tierSkipChance: getTierSkipChance(),
    bonusGemSpawnChance: getBonusGemSpawnChance(),
    blackholeChance: getBlackholeChance(),
    explosionChance: getExplosionChance(),
    comboWindowBonus,
    goldMultiplier,
    bounceBonus,
    rerollCount,
    interestRate,
    discountRate,
    freeRerollsPurchased,
    freeRerollsRemaining,
    extraSlots,
    lockCapacity,
    lockOrderCounter,
    skipThrowCharges,
    rainbowDropChance: getRainbowDropChance(),
    // Persist shop items so they survive blur/restore
    shopItemsSave: shopItems.map(it => ({
      defId: it.def.id,
      rarity: it.rarity,
      pct: it.pct,
      cost: it.cost,
      bought: it.bought,
      locked: it.locked,
      lockOrder: it.lockOrder,
    })),
    // Persist locked items waiting to appear in the next shop visit
    pendingLockedSave: pendingLockedItems.map(it => ({
      defId: it.def.id,
      rarity: it.rarity,
      pct: it.pct,
      cost: it.cost,
    })),
  };
}

export function restoreShopData(data: Record<string, any>): void {
  if (data.gold != null) gold = data.gold;
  if (data.garnetChance != null) setGarnetChance(data.garnetChance);
  if (data.heavyChance != null) setHeavyChance(data.heavyChance);
  if (data.bonusChance != null) setBonusChance(data.bonusChance);
  if (data.tierSkipChance != null) setTierSkipChance(data.tierSkipChance);
  if (data.bonusGemSpawnChance != null) setBonusGemSpawnChance(data.bonusGemSpawnChance);
  if (data.blackholeChance != null) setBlackholeChance(data.blackholeChance);
  if (data.explosionChance != null) setExplosionChance(data.explosionChance);
  if (data.comboWindowBonus != null) comboWindowBonus = data.comboWindowBonus;
  if (data.goldMultiplier != null) goldMultiplier = data.goldMultiplier;
  if (data.bounceBonus != null) bounceBonus = data.bounceBonus;
  if (data.rerollCount != null) rerollCount = data.rerollCount;
  if (data.interestRate != null) interestRate = data.interestRate;
  if (data.discountRate != null) discountRate = data.discountRate;
  if (data.freeRerollsPurchased != null) freeRerollsPurchased = data.freeRerollsPurchased;
  if (data.freeRerollsRemaining != null) freeRerollsRemaining = data.freeRerollsRemaining;
  if (data.extraSlots != null) extraSlots = data.extraSlots;
  if (data.lockCapacity != null) lockCapacity = data.lockCapacity;
  if (data.lockOrderCounter != null) lockOrderCounter = data.lockOrderCounter;
  if (data.skipThrowCharges != null) skipThrowCharges = data.skipThrowCharges;
  if (data.rainbowDropChance != null) setRainbowDropChance(data.rainbowDropChance);
  // Restore shop items
  if (Array.isArray(data.shopItemsSave)) {
    shopItems = [];
    for (const s of data.shopItemsSave) {
      const def = ITEM_DEFS.find(d => d.id === s.defId);
      if (def) shopItems.push({
        def, rarity: s.rarity, pct: s.pct, cost: s.cost, bought: s.bought,
        locked: !!s.locked, lockOrder: s.lockOrder ?? 0, unlockAnim: 0,
      });
    }
  }
  // Restore pending locked items (carried over from a prior shop close)
  if (Array.isArray(data.pendingLockedSave)) {
    pendingLockedItems = [];
    for (const s of data.pendingLockedSave) {
      const def = ITEM_DEFS.find(d => d.id === s.defId);
      if (def) pendingLockedItems.push({
        def, rarity: s.rarity, pct: s.pct, cost: s.cost, bought: false,
        locked: true, lockOrder: 0, unlockAnim: 0,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/** Draw text wrapped within maxWidth, centered, returning lines drawn. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, maxWidth: number, lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, y + lines * lineHeight);
      line = word;
      lines++;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, cx, y + lines * lineHeight); lines++; }
  return lines;
}

const CARD_W = IS_PORTRAIT ? 180 : 150;
const CARD_H = IS_PORTRAIT ? 110 : 95;
const CARD_GAP = IS_PORTRAIT ? 12 : 10;
const COLS = IS_PORTRAIT ? 2 : 3;
/** Rows grow with the slot count (base 6 → 8 max). */
function getRows(): number { return Math.ceil(getSlotCount() / COLS); }

const LOCK_BTN_SIZE = 22;

/** Draw a small padlock icon centered on (cx, cy). */
function drawLockIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string, locked: boolean): void {
  const w = size;
  const h = size * 1.2;
  const bodyH = h * 0.6;
  const bodyW = w * 0.85;
  const shackleR = bodyW * 0.4;
  const shackleY = cy - h / 2 + shackleR;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.2, size / 9);
  ctx.lineCap = 'round';

  // Shackle (arc) — open if unlocked
  ctx.beginPath();
  if (locked) {
    ctx.arc(cx, shackleY, shackleR, Math.PI, Math.PI * 2);
  } else {
    ctx.arc(cx + shackleR * 0.4, shackleY, shackleR, Math.PI * 1.1, Math.PI * 2.05);
  }
  ctx.stroke();

  // Body (rounded rect)
  const bodyY = cy + h / 2 - bodyH;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(cx - bodyW / 2, bodyY, bodyW, bodyH, Math.max(1, size / 8));
  ctx.fill();
  ctx.restore();
}

function shopGridOrigin(): { startX: number; startY: number } {
  const rows = getRows();
  const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
  const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
  return {
    startX: (VIRTUAL_WIDTH - gridW) / 2,
    startY: (VIRTUAL_HEIGHT - gridH) / 2 + 30,
  };
}

function cardOrigin(i: number): { cx: number; cy: number } {
  const { startX, startY } = shopGridOrigin();
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { cx: startX + col * (CARD_W + CARD_GAP), cy: startY + row * (CARD_H + CARD_GAP) };
}

function lockBtnRect(i: number): { x: number; y: number; w: number; h: number } {
  const { cx, cy } = cardOrigin(i);
  return { x: cx + CARD_W - LOCK_BTN_SIZE - 4, y: cy + 4, w: LOCK_BTN_SIZE, h: LOCK_BTN_SIZE };
}

// Hit target is larger than the visual button so fat-finger taps near the
// lock icon lock the item instead of falling through to buyItem.
const LOCK_HIT_PAD = 14;
function lockHitRect(i: number): { x: number; y: number; w: number; h: number } {
  const r = lockBtnRect(i);
  return { x: r.x - LOCK_HIT_PAD, y: r.y - LOCK_HIT_PAD / 2, w: r.w + LOCK_HIT_PAD * 1.5, h: r.h + LOCK_HIT_PAD };
}

export function getShopClickIndex(vx: number, vy: number): number {
  if (!shopOpen) return -1;
  for (let i = 0; i < shopItems.length; i++) {
    const { cx, cy } = cardOrigin(i);
    if (vx >= cx && vx <= cx + CARD_W && vy >= cy && vy <= cy + CARD_H) return i;
  }
  return -1;
}

/**
 * Toggle lock on the clicked shop item. Returns true if a lock button was hit.
 * Up to `lockCapacity` items can be locked at once. If the cap is reached and
 * the player locks another, the oldest-locked item is evicted to make room.
 * Bought items can't be locked; mid-unlock-animation items can't be locked.
 */
export function handleShopLockClick(vx: number, vy: number): boolean {
  if (!shopOpen) return false;
  for (let i = 0; i < shopItems.length; i++) {
    const r = lockHitRect(i);
    if (vx >= r.x && vx <= r.x + r.w && vy >= r.y && vy <= r.y + r.h) {
      const item = shopItems[i];
      if (item.bought) return true;
      if (item.unlockAnim > 0) return true;
      if (item.locked) {
        item.locked = false;
        item.lockOrder = 0;
      } else {
        const locked = shopItems.filter(it => it.locked);
        if (locked.length >= lockCapacity) {
          // Evict the oldest lock (smallest lockOrder) so the player can always
          // lock whatever they just tapped without a pre-unlock step.
          let oldest = locked[0];
          for (const l of locked) if (l.lockOrder < oldest.lockOrder) oldest = l;
          oldest.locked = false;
          oldest.lockOrder = 0;
        }
        item.locked = true;
        item.lockOrder = ++lockOrderCounter;
      }
      return true;
    }
  }
  return false;
}

/** Check if click is on the "Continue" button. */
// Button layout at the bottom of the shop
function getButtonLayout() {
  const rows = getRows();
  const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
  const baseY = (VIRTUAL_HEIGHT - gridH) / 2 + 30 + gridH + 15;
  const btnW = 140;
  const btnH = 40;
  const gap = 12;
  const totalW = btnW * 2 + gap;
  const startX = (VIRTUAL_WIDTH - totalW) / 2;
  return {
    reroll: { x: startX, y: baseY, w: btnW, h: btnH },
    cont: { x: startX + btnW + gap, y: baseY, w: btnW, h: btnH },
  };
}

export function isClickOnContinue(vx: number, vy: number): boolean {
  if (!shopOpen) return false;
  const { cont } = getButtonLayout();
  return vx >= cont.x && vx <= cont.x + cont.w && vy >= cont.y && vy <= cont.y + cont.h;
}

export function isClickOnReroll(vx: number, vy: number): boolean {
  if (!shopOpen) return false;
  const { reroll } = getButtonLayout();
  return vx >= reroll.x && vx <= reroll.x + reroll.w && vy >= reroll.y && vy <= reroll.y + reroll.h;
}

export function drawShop(ctx: CanvasRenderingContext2D): void {
  if (!shopOpen) return;

  const w = VIRTUAL_WIDTH;
  const h = VIRTUAL_HEIGHT;

  // Backdrop
  ctx.save();
  ctx.fillStyle = 'rgba(4, 6, 10, 0.85)';
  ctx.fillRect(0, 0, w, h);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Title
  ctx.font = `bold ${IS_PORTRAIT ? 28 : 24}px monospace`;
  ctx.fillStyle = '#e8c44a';
  ctx.fillText('SHOP', w / 2, IS_PORTRAIT ? 60 : 40);

  // Gold display
  ctx.font = `bold 16px monospace`;
  ctx.fillStyle = '#FBBF24';
  ctx.fillText(`${gold.toLocaleString()} gold`, w / 2, IS_PORTRAIT ? 88 : 62);

  // Item grid
  const rows = getRows();
  const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
  const gridH = rows * CARD_H + (rows - 1) * CARD_GAP;
  const startX = (w - gridW) / 2;
  const startY = (h - gridH) / 2 + 30;

  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = startX + col * (CARD_W + CARD_GAP);
    const cy = startY + row * (CARD_H + CARD_GAP);
    // Flat items bypass rarity styling — they use a distinct gold frame so
    // unlocks read as something structurally different from stat upgrades.
    const flat = !!item.def.flat;
    const rc = flat ? '#FBBF24' : RARITY_COLORS[item.rarity];

    ctx.save();

    // Card background — locked items get a darker, slightly desaturated tint
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H, 10);
    if (item.bought) ctx.fillStyle = 'rgba(30, 40, 30, 0.8)';
    else if (item.locked) ctx.fillStyle = 'rgba(20, 22, 32, 0.92)';
    else if (flat) ctx.fillStyle = 'rgba(24, 20, 8, 0.92)';
    else ctx.fillStyle = 'rgba(12, 16, 24, 0.9)';
    ctx.fill();

    // Rarity border
    ctx.strokeStyle = item.bought ? 'rgba(100, 100, 100, 0.3)' : rc;
    ctx.lineWidth = item.bought ? 1 : (flat ? 2 : 1.5);
    ctx.globalAlpha = item.bought ? 0.4 : (item.locked ? 0.35 : (flat ? 0.8 : 0.6));
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (item.bought) {
      // Sold overlay
      ctx.font = `bold 16px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText('SOLD', cx + CARD_W / 2, cy + CARD_H / 2);
    } else {
      // Locked items render their content dimmed
      const contentAlpha = item.locked ? 0.35 : 1;

      // Category label — rarity for normal items, UPGRADE for flat unlocks
      ctx.globalAlpha = contentAlpha;
      ctx.font = `bold 9px monospace`;
      ctx.fillStyle = rc;
      ctx.fillText(
        flat ? 'UPGRADE' : RARITY_LABELS[item.rarity].toUpperCase(),
        cx + CARD_W / 2, cy + 14,
      );

      // Item name
      ctx.font = `bold 11px monospace`;
      ctx.fillStyle = item.def.nameColor ?? '#ffffff';
      ctx.fillText(item.def.name, cx + CARD_W / 2, cy + 32);

      // Description (word-wrapped)
      ctx.font = `10px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      wrapText(ctx, item.def.description(item.pct), cx + CARD_W / 2, cy + 48, CARD_W - 16, 12);

      // Cost
      const canAfford = gold >= item.cost;
      ctx.font = `bold 13px monospace`;
      ctx.fillStyle = item.locked ? 'rgba(120, 120, 120, 0.8)'
        : (canAfford ? '#FBBF24' : '#f87171');
      ctx.fillText(`${item.cost} gold`, cx + CARD_W / 2, cy + CARD_H - 18);
      ctx.globalAlpha = 1;
    }

    // -- Lock toggle button (top-right corner) --
    if (!item.bought) {
      const lr = lockBtnRect(i);
      ctx.beginPath();
      ctx.roundRect(lr.x, lr.y, lr.w, lr.h, 5);
      ctx.fillStyle = item.locked ? 'rgba(232, 196, 74, 0.18)' : 'rgba(255, 255, 255, 0.06)';
      ctx.fill();
      ctx.strokeStyle = item.locked ? 'rgba(232, 196, 74, 0.6)' : 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      drawLockIcon(ctx, lr.x + lr.w / 2, lr.y + lr.h / 2, 9, item.locked ? '#FBBF24' : 'rgba(255, 255, 255, 0.5)', item.locked);
    }

    // -- Unlock animation: big lock icon scaling out + fading --
    if (item.unlockAnim > 0) {
      const t = item.unlockAnim / UNLOCK_ANIM_DURATION; // 1 → 0
      const alpha = t;
      const scale = 1 + (1 - t) * 1.5; // grow from 1× to 2.5×
      ctx.save();
      ctx.globalAlpha = alpha;
      const centerX = cx + CARD_W / 2;
      const centerY = cy + CARD_H / 2;
      drawLockIcon(ctx, centerX, centerY, 28 * scale, '#FBBF24', true);
      ctx.restore();
    }

    ctx.restore();
  }

  // Bottom buttons: Reroll + Continue
  const btns = getButtonLayout();
  const rerollCost = getRerollCost();
  const hasFreeReroll = freeRerollsRemaining > 0;
  const canReroll = hasFreeReroll || gold >= rerollCost;

  // Reroll button — highlights green while free rerolls are available.
  ctx.beginPath();
  ctx.roundRect(btns.reroll.x, btns.reroll.y, btns.reroll.w, btns.reroll.h, 10);
  if (hasFreeReroll) ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
  else ctx.fillStyle = canReroll ? 'rgba(100, 120, 200, 0.2)' : 'rgba(60, 60, 80, 0.15)';
  ctx.fill();
  if (hasFreeReroll) ctx.strokeStyle = 'rgba(74, 222, 128, 0.5)';
  else ctx.strokeStyle = canReroll ? 'rgba(100, 120, 200, 0.4)' : 'rgba(60, 60, 80, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 12px monospace`;
  ctx.fillStyle = hasFreeReroll ? '#4ADE80' : (canReroll ? '#7dd3fc' : '#4a5568');
  ctx.fillText(`Reroll`, btns.reroll.x + btns.reroll.w / 2, btns.reroll.y + btns.reroll.h / 2 - 6);
  ctx.font = `10px monospace`;
  if (hasFreeReroll) {
    ctx.fillStyle = '#4ADE80';
    ctx.fillText(
      `FREE (${freeRerollsRemaining})`,
      btns.reroll.x + btns.reroll.w / 2,
      btns.reroll.y + btns.reroll.h / 2 + 8,
    );
  } else {
    ctx.fillStyle = canReroll ? '#FBBF24' : '#4a5568';
    ctx.fillText(`${rerollCost} gold`, btns.reroll.x + btns.reroll.w / 2, btns.reroll.y + btns.reroll.h / 2 + 8);
  }

  // Continue button
  ctx.beginPath();
  ctx.roundRect(btns.cont.x, btns.cont.y, btns.cont.w, btns.cont.h, 10);
  ctx.fillStyle = '#22C55E';
  ctx.fill();
  ctx.font = `bold 13px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Continue', btns.cont.x + btns.cont.w / 2, btns.cont.y + btns.cont.h / 2);

  ctx.restore();
}
