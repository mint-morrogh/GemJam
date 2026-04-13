// ---------------------------------------------------------------------------
// Shop system — appears between levels after shake+settle
// ---------------------------------------------------------------------------

import { VIRTUAL_WIDTH, VIRTUAL_HEIGHT, IS_PORTRAIT } from '../canvas';
import { setGarnetChance, getGarnetChance, setHeavyChance, getHeavyChance, setBonusChance, getBonusChance, setTierSkipChance, getTierSkipChance, setBonusGemSpawnChance, getBonusGemSpawnChance, setBlackholeChance, getBlackholeChance, setExplosionChance, getExplosionChance } from './state';

// ---------------------------------------------------------------------------
// Gold
// ---------------------------------------------------------------------------

let gold = 0;
export function getGold(): number { return gold; }
export function addGold(amount: number): void { gold += Math.round(amount * goldMultiplier); }
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
}

// Combo window state (accessible to scoring via import)
let comboWindowBonus = 0;
export function getComboWindowBonus(): number { return comboWindowBonus; }

// Gold multiplier
let goldMultiplier = 1;
export function getGoldMultiplier(): number { return goldMultiplier; }

let bounceBonus = 0;
export function getBounceBonus(): number { return bounceBonus; }

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
    basePct: 3,
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
}

let shopItems: ShopItem[] = [];
let shopOpen = false;
let rerollCount = 0;

export function isShopOpen(): boolean { return shopOpen; }
export function getRerollCost(): number { return 100 * Math.pow(2, rerollCount); }

function rollShopItems(): void {
  shopItems = [];
  for (let i = 0; i < 6; i++) {
    const def = ITEM_DEFS[Math.floor(Math.random() * ITEM_DEFS.length)];
    const rarity = rollRarity();
    const mult = RARITY_MULT[rarity];
    const costMult = RARITY_COST_MULT[rarity];
    shopItems.push({
      def,
      rarity,
      pct: def.basePct * mult,
      cost: Math.round(def.baseCost * costMult),
      bought: false,
    });
  }
}

/** Open the shop. Only generates new items if the shop is empty. */
export function openShop(): void {
  shopOpen = true;
  if (shopItems.length === 0) rollShopItems();
}

/** Reroll all unbought items for increasing gold cost. Returns true if successful. */
export function rerollShop(): boolean {
  const cost = getRerollCost();
  if (gold < cost) return false;
  gold -= cost;
  rerollCount++;
  rollShopItems();
  return true;
}

export function closeShop(): void {
  shopOpen = false;
}

export function buyItem(index: number): boolean {
  const item = shopItems[index];
  if (!item || item.bought || gold < item.cost) return false;
  gold -= item.cost;
  item.bought = true;
  item.def.apply(item.pct);
  return true;
}

export function clearShopForNextLevel(): void {
  shopItems = [];
  shopOpen = false;
  rerollCount = 0;
}

export function resetShop(): void {
  gold = 0;
  shopItems = [];
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
    // Persist shop items so they survive blur/restore
    shopItemsSave: shopItems.map(it => ({
      defId: it.def.id,
      rarity: it.rarity,
      pct: it.pct,
      cost: it.cost,
      bought: it.bought,
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
  // Restore shop items
  if (Array.isArray(data.shopItemsSave)) {
    shopItems = [];
    for (const s of data.shopItemsSave) {
      const def = ITEM_DEFS.find(d => d.id === s.defId);
      if (def) shopItems.push({ def, rarity: s.rarity, pct: s.pct, cost: s.cost, bought: s.bought });
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
const ROWS = IS_PORTRAIT ? 3 : 2;

export function getShopClickIndex(vx: number, vy: number): number {
  if (!shopOpen) return -1;
  const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
  const gridH = ROWS * CARD_H + (ROWS - 1) * CARD_GAP;
  const startX = (VIRTUAL_WIDTH - gridW) / 2;
  const startY = (VIRTUAL_HEIGHT - gridH) / 2 + 30;

  for (let i = 0; i < shopItems.length; i++) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = startX + col * (CARD_W + CARD_GAP);
    const cy = startY + row * (CARD_H + CARD_GAP);
    if (vx >= cx && vx <= cx + CARD_W && vy >= cy && vy <= cy + CARD_H) return i;
  }
  return -1;
}

/** Check if click is on the "Continue" button. */
// Button layout at the bottom of the shop
function getButtonLayout() {
  const gridH = ROWS * CARD_H + (ROWS - 1) * CARD_GAP;
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
  const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
  const gridH = ROWS * CARD_H + (ROWS - 1) * CARD_GAP;
  const startX = (w - gridW) / 2;
  const startY = (h - gridH) / 2 + 30;

  for (let i = 0; i < shopItems.length; i++) {
    const item = shopItems[i];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const cx = startX + col * (CARD_W + CARD_GAP);
    const cy = startY + row * (CARD_H + CARD_GAP);
    const rc = RARITY_COLORS[item.rarity];

    ctx.save();

    // Card background
    ctx.beginPath();
    ctx.roundRect(cx, cy, CARD_W, CARD_H, 10);
    ctx.fillStyle = item.bought ? 'rgba(30, 40, 30, 0.8)' : 'rgba(12, 16, 24, 0.9)';
    ctx.fill();

    // Rarity border
    ctx.strokeStyle = item.bought ? 'rgba(100, 100, 100, 0.3)' : rc;
    ctx.lineWidth = item.bought ? 1 : 1.5;
    ctx.globalAlpha = item.bought ? 0.4 : 0.6;
    ctx.stroke();
    ctx.globalAlpha = 1;

    if (item.bought) {
      // Sold overlay
      ctx.font = `bold 16px monospace`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.fillText('SOLD', cx + CARD_W / 2, cy + CARD_H / 2);
    } else {
      // Rarity label
      ctx.font = `bold 9px monospace`;
      ctx.fillStyle = rc;
      ctx.fillText(RARITY_LABELS[item.rarity].toUpperCase(), cx + CARD_W / 2, cy + 14);

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
      ctx.fillStyle = canAfford ? '#FBBF24' : '#f87171';
      ctx.fillText(`${item.cost} gold`, cx + CARD_W / 2, cy + CARD_H - 18);
    }

    ctx.restore();
  }

  // Bottom buttons: Reroll + Continue
  const btns = getButtonLayout();
  const rerollCost = getRerollCost();
  const canReroll = gold >= rerollCost;

  // Reroll button
  ctx.beginPath();
  ctx.roundRect(btns.reroll.x, btns.reroll.y, btns.reroll.w, btns.reroll.h, 10);
  ctx.fillStyle = canReroll ? 'rgba(100, 120, 200, 0.2)' : 'rgba(60, 60, 80, 0.15)';
  ctx.fill();
  ctx.strokeStyle = canReroll ? 'rgba(100, 120, 200, 0.4)' : 'rgba(60, 60, 80, 0.2)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.font = `bold 12px monospace`;
  ctx.fillStyle = canReroll ? '#7dd3fc' : '#4a5568';
  ctx.fillText(`Reroll`, btns.reroll.x + btns.reroll.w / 2, btns.reroll.y + btns.reroll.h / 2 - 6);
  ctx.font = `10px monospace`;
  ctx.fillStyle = canReroll ? '#FBBF24' : '#4a5568';
  ctx.fillText(`${rerollCost} gold`, btns.reroll.x + btns.reroll.w / 2, btns.reroll.y + btns.reroll.h / 2 + 8);

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
