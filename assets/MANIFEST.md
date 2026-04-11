# GemJam Asset Manifest

All assets use a 16-bit retro pixel-art style. Sizes are the logical pixel grid; render at 1x and 2x.

---

## Gems (16x16) — `assets/gems/`

Merge-based game core. 5 colors × 3 tiers (raw → cut → perfect).

| # | File | Color | Tier | Palette Notes |
|---|------|-------|------|---------------|
| 1 | `gem_ruby_raw.svg` | Red | Raw | Deep crimson base `#9B1B30`, dark outline |
| 2 | `gem_ruby_cut.svg` | Red | Cut | Brighter red `#E83F5B`, added facets + shine |
| 3 | `gem_ruby_perfect.svg` | Red | Perfect | Vivid scarlet `#FF2D55`, inner glow + sparkle |
| 4 | `gem_sapphire_raw.svg` | Blue | Raw | Navy base `#1B3A9B` |
| 5 | `gem_sapphire_cut.svg` | Blue | Cut | Royal blue `#3F6AE8`, facets |
| 6 | `gem_sapphire_perfect.svg` | Blue | Perfect | Bright azure `#2D7FFF`, glow |
| 7 | `gem_emerald_raw.svg` | Green | Raw | Forest green `#1B6B3A` |
| 8 | `gem_emerald_cut.svg` | Green | Cut | Jade `#3ABF5E`, facets |
| 9 | `gem_emerald_perfect.svg` | Green | Perfect | Vivid green `#2DFF6A`, glow |
| 10 | `gem_topaz_raw.svg` | Yellow | Raw | Dark amber `#8B6914` |
| 11 | `gem_topaz_cut.svg` | Yellow | Cut | Gold `#E8B83F`, facets |
| 12 | `gem_topaz_perfect.svg` | Yellow | Perfect | Bright gold `#FFD52D`, glow |
| 13 | `gem_amethyst_raw.svg` | Purple | Raw | Deep plum `#5B1B8B` |
| 14 | `gem_amethyst_cut.svg` | Purple | Cut | Violet `#9B3FE8`, facets |
| 15 | `gem_amethyst_perfect.svg` | Purple | Perfect | Bright purple `#C02DFF`, glow |

---

## Potions (16x16) — `assets/potions/`

Consumable items. Each has a distinct bottle shape and liquid color.

| # | File | Type | Palette Notes |
|---|------|------|---------------|
| 1 | `potion_health.svg` | Health | Red liquid `#E83F5B`, round flask, heart bubble |
| 2 | `potion_mana.svg` | Mana | Blue liquid `#3F6AE8`, tall flask, star bubble |
| 3 | `potion_speed.svg` | Speed | Yellow liquid `#E8D83F`, slim flask, wind lines |
| 4 | `potion_strength.svg` | Strength | Orange liquid `#E8753F`, wide flask, fist icon |
| 5 | `potion_shield.svg` | Shield | Silver liquid `#A8B8C8`, square flask, shield icon |
| 6 | `potion_poison.svg` | Poison | Green liquid `#3FE85B`, skull flask, drip effect |
| 7 | `potion_fire.svg` | Fire | Flame orange `#FF6B2D`, tapered flask, flame top |
| 8 | `potion_ice.svg` | Ice | Cyan liquid `#2DD4FF`, frosted flask, snowflake |
| 9 | `potion_luck.svg` | Luck | Gold liquid `#FFD52D`, clover flask, sparkle |
| 10 | `potion_invisibility.svg` | Invisibility | Translucent white `#E0E8F0`, ghost flask, fade |
| 11 | `potion_rage.svg` | Rage | Dark red `#9B1B30`, horned flask, cracks |
| 12 | `potion_wisdom.svg` | Wisdom | Purple liquid `#9B3FE8`, scroll flask, eye icon |

---

## Spells (32x32) — `assets/spells/`

Larger to show particle/glow effects clearly.

| # | File | Type | Palette Notes |
|---|------|------|---------------|
| 1 | `spell_fireball.svg` | Fire | Orange-red core `#FF6B2D`, yellow edge `#FFD52D` |
| 2 | `spell_ice_shard.svg` | Ice | Cyan `#2DD4FF`, white highlights, frost particles |
| 3 | `spell_lightning.svg` | Lightning | Yellow bolt `#FFD52D`, white flash `#FFFFFF` |
| 4 | `spell_heal.svg` | Heal | Green glow `#2DFF6A`, cross/heart shape, particles |
| 5 | `spell_arcane.svg` | Arcane | Purple swirl `#C02DFF`, rune particles |
| 6 | `spell_earth.svg` | Earth | Brown `#8B6914`, rock shards, dust |
| 7 | `spell_wind.svg` | Wind | White/cyan `#A8E8E0`, swirl lines, leaf particles |
| 8 | `spell_dark.svg` | Dark | Deep purple `#2D1B4A`, shadow tendrils, red eye |

---

## Upgrades (16x16) — `assets/upgrades/`

Badge-style icons with consistent frame/border treatment.

| # | File | Type | Palette Notes |
|---|------|------|---------------|
| 1 | `upgrade_damage.svg` | Damage Up | Red sword icon on dark badge `#9B1B30` |
| 2 | `upgrade_speed.svg` | Speed Boost | Yellow lightning on blue badge `#1B3A9B` |
| 3 | `upgrade_shield.svg` | Defense | Silver shield on green badge `#1B6B3A` |
| 4 | `upgrade_multi_merge.svg` | Multi-Merge | Gold arrows on purple badge `#5B1B8B` |
| 5 | `upgrade_magnet.svg` | Gem Magnet | Cyan magnet on dark badge `#1B2B3B` |
| 6 | `upgrade_luck.svg` | Lucky Drops | Gold clover on green badge `#1B6B3A` |
| 7 | `upgrade_xp_boost.svg` | XP Boost | White star on blue badge `#1B3A9B` |
| 8 | `upgrade_chain.svg` | Chain Combo | Orange chain on red badge `#9B1B30` |

---

## UI Elements (various sizes) — `assets/ui/`

| # | File | Size | Description | Palette Notes |
|---|------|------|-------------|---------------|
| 1 | `btn_normal.svg` | 48x16 | Default button | Dark stone `#3A3A4A`, light bevel |
| 2 | `btn_hover.svg` | 48x16 | Hovered button | Lighter stone `#5A5A6A`, highlight edge |
| 3 | `btn_pressed.svg` | 48x16 | Pressed button | Darker `#2A2A3A`, inset shadow |
| 4 | `panel_border.svg` | 9-slice | Panel/window frame | Stone grey `#4A4A5A`, gold trim `#E8B83F` |
| 5 | `bar_health.svg` | 32x6 | Health bar | Red fill `#E83F5B`, dark track `#2A2A3A` |
| 6 | `bar_mana.svg` | 32x6 | Mana bar | Blue fill `#3F6AE8`, dark track `#2A2A3A` |
| 7 | `frame_score.svg` | 48x16 | Score display frame | Gold border `#E8B83F`, dark fill |
| 8 | `slot_inventory.svg` | 18x18 | Inventory slot | Dark inset `#1A1A2A`, subtle border `#4A4A5A` |
| 9 | `tooltip_bg.svg` | 9-slice | Tooltip background | Semi-dark `#2A2A3A`, thin gold edge `#E8B83F` |

---

## Totals

| Category | Count | Size |
|----------|-------|------|
| Gems | 15 | 16x16 |
| Potions | 12 | 16x16 |
| Spells | 8 | 32x32 |
| Upgrades | 8 | 16x16 |
| UI | 9 | various |
| **Total** | **52** | |
