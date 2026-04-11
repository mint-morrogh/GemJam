// ---------------------------------------------------------------------------
// Gem type definitions
// ---------------------------------------------------------------------------

/** Static definition for a gem tier (immutable lookup data). */
export interface GemTier {
  /** Numeric tier id (0-based). */
  id: number;
  /** Display name, e.g. "Ruby", "Sapphire". */
  name: string;
  /** Circle radius in virtual pixels. */
  radius: number;
  /** Base hex color for this tier. */
  baseColor: string;
  /** Points awarded when this tier is created via merge. */
  points: number;
  /** Key used to look up the sprite asset for this tier. */
  spriteKey: string;
}

/** A fully resolved gem instance with all tier properties and sprite ref. */
export interface GemInstance {
  /** Tier id this gem belongs to. */
  tierId: number;
  /** Display name. */
  name: string;
  /** Radius in virtual pixels. */
  radius: number;
  /** Hex color. */
  baseColor: string;
  /** Point value. */
  points: number;
  /** Sprite key for asset lookup. */
  spriteKey: string;
  /** Pre-rendered sprite (CanvasImageSource from the sprite cache). */
  sprite: CanvasImageSource;
}

/**
 * Merge mapping: maps a tier id to the resulting tier id when two gems of
 * that tier merge. A value of `null` means the tier is terminal (max tier).
 */
export type GemMergeMap = Record<number, number | null>;
