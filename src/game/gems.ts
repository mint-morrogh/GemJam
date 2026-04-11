import { VIRTUAL_WIDTH, IS_PORTRAIT } from '../canvas';

// ---------------------------------------------------------------------------
// Gem data model
// ---------------------------------------------------------------------------

/** Static definition for each gem tier (immutable lookup data). */
export interface GemDef {
  /** Numeric tier id (0-based index). */
  id: number;
  /** Tier identifier, e.g. "ruby", "sapphire". */
  type: string;
  /** Hex fill color. */
  color: string;
  /** Circle radius in virtual pixels. */
  radius: number;
  /** Points awarded on merge that creates this tier. */
  points: number;
}

/** Alias used by merge system. */
export type GemTier = GemDef;

/** Runtime gem instance living on the board. */
export interface Gem {
  type: string;
  color: string;
  /** Radius in virtual pixels. */
  size: number;
  position: { x: number; y: number };
}

/**
 * Gem tiers ordered small → large (12 tiers: 0-11).
 * Merging two of tier N produces one of tier N+1.
 *
 * Tiers 0-3: natural-color assets (no runtime tint)
 * Tiers 4-10: grayscale assets with runtime color tint
 * Tier 11: natural diamond (no tint)
 *
 * Prestige cycle: two tier-11 → rainbow pebble (tier 0), then rainbow
 * progression through all tiers. Two rainbow tier-11 → gems disappear.
 */
export const GEM_TIERS: readonly GemDef[] = [
  { id: 0,  type: 'pebble',      color: '#C0B8A8', radius: 24, points: 2     },
  { id: 1,  type: 'ore',         color: '#A0A0A0', radius: 29, points: 5     },
  { id: 2,  type: 'geode',       color: '#8899AA', radius: 35, points: 12    },
  { id: 3,  type: 'cluster',     color: '#88BBCC', radius: 42, points: 30    },
  { id: 4,  type: 'garnet',      color: '#DC2626', radius: 50, points: 80    },
  { id: 5,  type: 'sapphire',    color: '#2563EB', radius: 60, points: 200   },
  { id: 6,  type: 'emerald',     color: '#50C878', radius: 72, points: 500   },
  { id: 7,  type: 'topaz',       color: '#F5C542', radius: 86, points: 1200  },
  { id: 8,  type: 'amethyst',    color: '#9333EA', radius: 103, points: 3000  },
  { id: 9,  type: 'aquamarine',  color: '#67E8F9', radius: 125, points: 7500  },
  { id: 10, type: 'ruby',        color: '#F472B6', radius: 149, points: 18000 },
  { id: 11, type: 'diamond',     color: '#E8E8E8', radius: 179, points: 50000 },
] as const;

/**
 * Merge mapping: tierN → tierN+1.
 * Tier 11 is NOT in this map — the merge detector handles the prestige
 * cycle (normal tier 11 → rainbow tier 0, rainbow tier 11 → disappear).
 */
export const MERGE_MAP: Record<number, number> = Object.fromEntries(
  GEM_TIERS.slice(0, -1).map((g) => [g.id, g.id + 1]),
);

/** Max tier index that can be spawned for a new drop (keeps big gems merge-only). */
export const MAX_SPAWN_TIER = 3;

/** Look up a GemDef by type name. */
export function getGemDef(type: string): GemDef | undefined {
  return GEM_TIERS.find((g) => g.type === type);
}

/** Get the next tier after a merge. Returns undefined if already max tier. */
export function getNextTier(tierIndex: number): GemDef | undefined {
  return GEM_TIERS[tierIndex + 1];
}

// ---------------------------------------------------------------------------
// Drop-column grid layout
// ---------------------------------------------------------------------------

/** One vertical column the player can drop a gem into. */
export interface DropZone {
  /** Column index (0-based left to right). */
  index: number;
  /** Center X in virtual coordinates. */
  centerX: number;
  /** Left edge of this column's zone. */
  minX: number;
  /** Right edge of this column's zone. */
  maxX: number;
}

export interface GridConfig {
  /** Number of drop columns. */
  columnCount: number;
  /** Width of each column in virtual pixels. */
  columnWidth: number;
  /** Pre-computed drop zones. */
  dropZones: DropZone[];
  /** Container left edge (virtual X). */
  containerX: number;
  /** Container top edge (virtual Y). */
  containerY: number;
  /** Container width (virtual px). */
  containerWidth: number;
  /** Container height (virtual px). */
  containerHeight: number;
  /** Y position of the drop line where gems are held before release. */
  dropY: number;
}

// -- Container dimensions (centered in virtual viewport) --------------------

const CONTAINER_WIDTH = IS_PORTRAIT ? 472 : 450;
const CONTAINER_HEIGHT = IS_PORTRAIT ? 720 : 540;
const CONTAINER_X = (VIRTUAL_WIDTH - CONTAINER_WIDTH) / 2;
const CONTAINER_Y = IS_PORTRAIT
  ? 200 // below top-nav (40px) + next-gem strip (55px) + launcher zone
  : 170; // below nav + strip in landscape
const DROP_Y = CONTAINER_Y - 30; // gem preview sits above the container
const COLUMN_COUNT = 7;
const COLUMN_WIDTH = CONTAINER_WIDTH / COLUMN_COUNT;

/** Build drop-zone array from container geometry. */
function buildDropZones(): DropZone[] {
  const zones: DropZone[] = [];
  for (let i = 0; i < COLUMN_COUNT; i++) {
    const minX = CONTAINER_X + i * COLUMN_WIDTH;
    const maxX = minX + COLUMN_WIDTH;
    zones.push({
      index: i,
      centerX: minX + COLUMN_WIDTH / 2,
      minX,
      maxX,
    });
  }
  return zones;
}

/** The active grid configuration. */
export const GRID: GridConfig = {
  columnCount: COLUMN_COUNT,
  columnWidth: COLUMN_WIDTH,
  dropZones: buildDropZones(),
  containerX: CONTAINER_X,
  containerY: CONTAINER_Y,
  containerWidth: CONTAINER_WIDTH,
  containerHeight: CONTAINER_HEIGHT,
  dropY: DROP_Y,
};

/**
 * Given an X position in virtual coordinates, return the nearest drop zone.
 * Clamps to the first/last column when outside the container.
 */
export function nearestDropZone(virtualX: number): DropZone {
  const clamped = Math.max(GRID.containerX, Math.min(virtualX, GRID.containerX + GRID.containerWidth));
  const colIndex = Math.min(
    COLUMN_COUNT - 1,
    Math.max(0, Math.floor((clamped - GRID.containerX) / COLUMN_WIDTH)),
  );
  return GRID.dropZones[colIndex];
}

// ---------------------------------------------------------------------------
// Touch-to-grid coordinate mapping
// ---------------------------------------------------------------------------

/** Result of mapping a touch point to the grid. */
export interface GridCell {
  /** Column index (0-based), or -1 if outside the grid horizontally. */
  column: number;
  /** Row index from bottom (0 = floor), or -1 if outside the grid vertically. */
  row: number;
  /** Whether the touch point is inside the game container bounds. */
  inBounds: boolean;
}

/**
 * Convert virtual coordinates to a grid cell (column + row).
 * Row is computed from bottom of the container using COLUMN_WIDTH as row height
 * (square cells), giving a logical grid overlay for the physics-based board.
 */
export function virtualToGrid(vx: number, vy: number): GridCell {
  const relX = vx - CONTAINER_X;
  const relY = vy - CONTAINER_Y;

  const inBounds =
    relX >= 0 && relX < CONTAINER_WIDTH &&
    relY >= 0 && relY < CONTAINER_HEIGHT;

  if (!inBounds) {
    // Clamp column for out-of-bounds but return row -1
    const clampedCol = relX < 0 ? -1 : relX >= CONTAINER_WIDTH ? -1 : Math.floor(relX / COLUMN_WIDTH);
    const clampedRow = relY < 0 ? -1 : relY >= CONTAINER_HEIGHT ? -1 : Math.floor((CONTAINER_HEIGHT - relY) / COLUMN_WIDTH);
    return { column: clampedCol, row: clampedRow, inBounds: false };
  }

  const column = Math.min(COLUMN_COUNT - 1, Math.floor(relX / COLUMN_WIDTH));
  // Row 0 = bottom of container, increasing upward. Use column width as row height for square cells.
  const row = Math.floor((CONTAINER_HEIGHT - relY) / COLUMN_WIDTH);

  return { column, row, inBounds };
}
