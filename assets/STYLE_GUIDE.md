# GemJam — 16-Bit Retro Style Guide

All assets must follow these rules to ensure visual cohesion across the game.

---

## Pixel Grid

| Property | Value |
|----------|-------|
| Small icons (gems, potions, upgrades) | **16×16** logical pixels |
| Large effects (spells) | **32×32** logical pixels |
| UI elements | Variable width, height in multiples of 2 |
| Render scales | 1× (native) and 2× (crisp upscale, no filtering) |
| Sub-pixel geometry | Forbidden — all edges snap to whole pixel boundaries |

In SVGs, use integer coordinates only. Each "pixel" is a 1×1 `<rect>` or aligned path segment. No anti-aliased curves.

---

## Color Palette (32 colors max)

### Core / UI (8 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#0A0A14` | Void Black | Backgrounds, deepest shadows |
| ■ | `#1A1A2A` | Dark Slate | Panel fills, inventory slots |
| ■ | `#2A2A3A` | Mid Slate | Button pressed, tooltip bg |
| ■ | `#3A3A4A` | Stone | Button normal, frames |
| ■ | `#4A4A5A` | Light Stone | Borders, dividers |
| ■ | `#5A5A6A` | Pale Stone | Button hover |
| ■ | `#A8B8C8` | Silver | Highlights, disabled text |
| ■ | `#E0E8F0` | White Mist | Text, bright highlights |

### Red Family (3 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#9B1B30` | Deep Crimson | Raw ruby, dark accents, rage |
| ■ | `#E83F5B` | Bright Red | Cut ruby, health bar, health potion |
| ■ | `#FF2D55` | Vivid Scarlet | Perfect ruby, crit effects |

### Blue Family (3 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#1B3A9B` | Navy | Raw sapphire, dark blue accents |
| ■ | `#3F6AE8` | Royal Blue | Cut sapphire, mana bar, mana potion |
| ■ | `#2D7FFF` | Bright Azure | Perfect sapphire, speed badge |

### Green Family (3 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#1B6B3A` | Forest Green | Raw emerald, luck badge |
| ■ | `#3ABF5E` | Jade | Cut emerald, poison potion |
| ■ | `#2DFF6A` | Vivid Green | Perfect emerald, heal glow |

### Yellow / Gold Family (3 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#8B6914` | Dark Amber | Raw topaz, earth tones |
| ■ | `#E8B83F` | Gold | Cut topaz, UI gold trim, score frame |
| ■ | `#FFD52D` | Bright Gold | Perfect topaz, lightning, sparkle |

### Purple Family (3 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#5B1B8B` | Deep Plum | Raw amethyst, dark magic |
| ■ | `#9B3FE8` | Violet | Cut amethyst, wisdom potion |
| ■ | `#C02DFF` | Bright Purple | Perfect amethyst, arcane glow |

### Effect Colors (5 colors)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#FF6B2D` | Flame Orange | Fire spells, fire potion |
| ■ | `#2DD4FF` | Ice Cyan | Ice spells, ice potion, magnet |
| ■ | `#A8E8E0` | Mint Wind | Wind spell, speed potion |
| ■ | `#2D1B4A` | Shadow | Dark spell base |
| ■ | `#FFFFFF` | Pure White | Lightning flash, shine dots, sparkle |

### Accent (1 color)

| Swatch | Hex | Name | Usage |
|--------|-----|------|-------|
| ■ | `#1B2B3B` | Deep Teal | Neutral dark badge bg |

**Total: 32 colors**

---

## Outline Rules

- **All sprites get a 1px outline** in `#0A0A14` (Void Black) on all exterior edges.
- Interior detail lines use the **darkest shade** of that object's color family (e.g., `#9B1B30` for ruby interior lines).
- Outlines are **mandatory** — they're what makes sprites readable at 16×16 on any background.
- No double-thick outlines. Exactly 1px everywhere.

---

## Shading Rules

Each surface uses exactly **3 tones** from its color family:

1. **Shadow** — darkest shade, applied to bottom and right edges (light comes from top-left).
2. **Base** — mid tone, fills the main body.
3. **Highlight** — lightest shade, 1-2px on top-left edges/corners.

```
Light source: ↘ (top-left)

  ██ HH ██        H = Highlight
  HH BB SS        B = Base
  ██ SS SS        S = Shadow
```

- Never use more than 3 tones per surface (excluding outline and special effects).
- Never use gradients — flat fills only.
- Dithering is allowed sparingly (checkerboard pattern) for transitions between tones on larger (32×32) sprites.

---

## Glow & Effect Conventions

### Gem Shine
- **Raw tier**: No shine. Flat 2-tone shading (shadow + base only).
- **Cut tier**: 1px white (`#FFFFFF`) highlight dot at top-left facet corner.
- **Perfect tier**: 1px white highlight dot + 2-4px glow aura using the lightest family color at 50% opacity around the gem.

### Potion Bubbles
- 1-2 circles of 1-2px inside the liquid area using a lighter shade.
- Liquid level sits at ~60% of bottle height.
- Cork/stopper always in `#8B6914` (Dark Amber).

### Spell Particles
- Small 1-2px dots scattered around the main effect shape.
- Use the brightest color in the spell's family + `#FFFFFF` for sparks.
- Particle count: 4-8 particles per 32×32 spell.
- Core shape should be recognizable even without particles.

### Upgrade Badges
- Consistent frame: 1px `#4A4A5A` border, solid color fill from palette.
- Icon centered inside, using contrasting color.
- No glow effects on upgrades — clean, readable silhouettes.

### UI Glow / Active States
- Active/selected items get a 1px bright border in the relevant color family.
- No bloom or soft glow — keep it pixel-sharp.

---

## SVG Construction Rules

1. **ViewBox** must match logical pixel size: `viewBox="0 0 16 16"` or `viewBox="0 0 32 32"`.
2. Use `<rect>` elements for individual pixels or `<path>` with integer coordinates.
3. Set `shape-rendering="crispEdges"` on the root `<svg>` element.
4. No `<circle>`, `<ellipse>`, or curved `<path>` commands — approximate curves with pixel staircases.
5. No `<filter>`, `<gradient>`, `<blur>`, or `opacity` on base shapes (opacity allowed only for perfect-tier gem auras).
6. Group layers logically: `<g id="outline">`, `<g id="base">`, `<g id="highlight">`, `<g id="effects">`.
7. No transforms — position everything absolutely within the viewBox.
8. File naming: lowercase, underscores, descriptive (e.g., `gem_ruby_cut.svg`).

---

## Quick Reference

```
Pixel grid:   16×16 (small) / 32×32 (spells)
Outline:      1px #0A0A14 on all sprites
Light:        Top-left → bottom-right
Tones:        3 per surface (shadow, base, highlight)
Glow:         Only on perfect-tier gems (aura) and spell particles
Palette:      32 colors total — never go outside this set
SVG:          Integer coords, crispEdges, no curves/gradients
```
