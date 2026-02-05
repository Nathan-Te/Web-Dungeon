# Web-Dungeon (Dungeon Gacha Run)

## Project Overview

A gacha-style RPG web game built with **Svelte 5** (runes), **Vite**, **TypeScript**, and **Tailwind CSS 4**. Players collect characters through gacha pulls, build teams, and send them into daily dungeons and expeditions.

### Tech Stack
- **Svelte 5.43.x** — Uses runes (`$state`, `$derived`, `$props`, `$effect`) exclusively. No legacy `$:` syntax.
- **Vite 7.x** — Build tool & dev server
- **TypeScript 5.9.x** — Strict types throughout
- **Tailwind CSS 4.x** — Utility-first styling via `@tailwindcss/vite`

### Running the project
```bash
npm install
npm run dev      # Dev server on localhost:5173
npm run build    # Production build to dist/
```

---

## Architecture

```
src/
├── App.svelte                  # Router: player | admin | demo | dungeon-test
├── main.ts                     # Entry point
├── lib/
│   ├── game/                   # Core game logic (no UI)
│   │   ├── types.ts            # All core types, constants, stat tables
│   │   ├── Character.ts        # Character class with stat scaling
│   │   ├── characters.ts       # 20 built-in CharacterDefinition data
│   │   ├── abilities.ts        # Ability system (7 defaults + custom)
│   │   ├── AutoBattleSimulation.ts  # Turn-based combat engine
│   │   ├── expeditionSimulation.ts  # Expedition wave/reward resolution
│   │   ├── rng.ts              # Seeded PRNG (mulberry32)
│   │   └── index.ts            # Barrel export
│   ├── player/                 # Player-facing UI & state
│   │   ├── PlayerHome.svelte   # Main hub — tabs for all sections
│   │   ├── playerStore.ts      # Player save data model & persistence
│   │   ├── CollectionSection.svelte
│   │   ├── GachaSection.svelte
│   │   ├── DailyDungeonSection.svelte
│   │   ├── ExpeditionSection.svelte
│   │   ├── TeamSection.svelte  # Team preset management (3 presets of 6)
│   │   └── SaveSync.svelte     # Import/export sync codes
│   ├── components/             # Reusable UI components
│   │   ├── CharacterCard.svelte   # Animated character sprite with HP bar
│   │   ├── BattleGrid.svelte      # 3x3 battlefield layout
│   │   ├── BattleLog.svelte       # Action log display
│   │   ├── SpritePreview.svelte   # Static sprite preview (idle frame)
│   │   ├── BattleDemo.svelte      # Single battle demo page
│   │   └── DungeonRunner.svelte   # Multi-room dungeon test page
│   └── admin/                  # Admin panel (content editing)
│       ├── AdminPage.svelte
│       ├── AdminGate.svelte    # Auth gate (sessionStorage)
│       ├── adminTypes.ts       # GameContent, configs, editor types
│       └── contentStore.ts     # localStorage + GitHub sync
```

---

## Core Data Model

### Character System

**CharacterDefinition** (static, admin-defined):
- `id`, `name`, `role` (7 roles), `rarity` (4 tiers)
- `abilityName`, `abilityDescription`
- `sprites?: SpriteSet` — animation sprites per state
- `displaySize?: DisplaySize` — battle rendering size

**OwnedCharacter** (player instance):
- `characterId` → references `CharacterDefinition.id`
- `level` (1–max), `ascension` (0–6), `duplicates`, `xp`

**Stat calculation formula:**
```
stat = baseStat * rarityMultiplier * (1 + (level - 1) * 0.1) * (1 + ascension * 0.15)
```
Note: SPD does NOT scale — it's constant per role.

### 7 Roles & Base Stats

| Role     | HP   | ATK | DEF | SPD | Position |
|----------|------|-----|-----|-----|----------|
| Tank     | 1000 | 80  | 150 | 50  | Front    |
| Warrior  | 700  | 120 | 80  | 70  | Front    |
| Archer   | 500  | 150 | 40  | 90  | Back     |
| Mage     | 450  | 180 | 30  | 60  | Back     |
| Assassin | 550  | 140 | 50  | 120 | Mid      |
| Healer   | 600  | 60  | 60  | 80  | Back     |
| Summoner | 550  | 100 | 50  | 65  | Back     |

### 4 Rarities
`common` → `rare` → `epic` → `legendary` (each has a multiplier on base stats)

---

## Sprite System Rules

### Data Structures

```typescript
// A sprite can be a static image URL or an animated sprite sheet
type SpriteSource = string | SpriteSheetConfig;

interface SpriteSheetConfig {
  src: string;          // Image URL or base64 data URI
  frameWidth: number;   // Single frame width in px
  frameHeight: number;  // Single frame height in px
  frameCount: number;   // Total frames in the sheet
  framesPerRow: number; // Frames per row in the grid
}

interface SpriteSet {
  idle?: SpriteSource;        // Default standing state
  attack?: SpriteSource;      // Attack animation
  castAbility?: SpriteSource; // Spell/ability cast animation
  death?: SpriteSource;       // Death animation
  frameDuration?: number;     // ms per frame (default: 150)
  spriteScale?: number;       // Zoom multiplier (default: 1.0)
}
```

### Display Rules

1. **Fallback chain**: `requestedAnimState` → `idle` → role icon letter (T/W/A/M/X/H/S)
2. **Sheet vs static**: Detected by `typeof source === 'object' && 'src' in source`
3. **Frame calculation**: `col = frame % framesPerRow`, `row = floor(frame / framesPerRow)`
4. **Centering**: Frame centered in cell via `offset = (cellSize - frameSize * scale) / 2`
5. **Death animation**: Plays once and holds on last frame (all others loop continuously)
6. **spriteScale**: Applied to ALL sprite renders (sheets and static images)
7. **Ability overlays**: Rendered at z-20 on top of the character sprite, with independent animation

### Display Sizes

| Size   | Pixels | Usage                        |
|--------|--------|------------------------------|
| small  | 64px   | Crowded scenes               |
| medium | 88px   | Default for all units        |
| large  | 140px  | Prominent characters         |
| xlarge | 200px  | Bosses (auto-set if `isBoss`) |

### Where Sprites Appear

- **SpritePreview** (`SpritePreview.svelte`): Shows first idle frame only. Used in collection, team management, expedition cards, and selection grids.
- **CharacterCard** (`CharacterCard.svelte`): Full animated sprite with state transitions, HP bar, hit effects, and ability overlays. Used in BattleGrid during combat.
- **BattleGrid** (`BattleGrid.svelte`): Renders player team on left, enemies on right, with row-based vertical offsets and horizontal jitter for a non-grid feel.

### Character Display Standard

Everywhere a character is shown in a list/selection (Collection, Teams, Dungeon selection, Expedition selection), display:
- **Sprite** (via SpritePreview — idle frame)
- **Name** (truncated if long)
- **Role** (colored text label)
- **Level** with ascension stars: `★★Lv15`
- **Rarity** (border color: gray/blue/purple/yellow)

---

## Combat System

### AutoBattleSimulation
- **Turn-based**: Units sorted by SPD (descending), player wins ties
- **Max 30 turns** per battle
- **Seeded RNG** via `SeededRNG(seed)` — deterministic replay
- **Damage formula**: `ATK * variance(±10%) - DEF * 0.5` (min 1), with 5% crit (2x)
- **Ability trigger**: 25% chance per attack turn, subject to cooldown
- **Targeting by role**: Tank → closest, Mage → lowest HP, Assassin → back row, etc.

### Position System (3x3 grid)
- Rows: 0 (front), 1 (mid), 2 (back), 3 (extra/summon row for boss fights)
- Columns: 0, 1, 2
- Bosses: Occupy position (0,0) and visually fill 3x3

### Expedition Power Calculation
Role-aware weighted formula — each role's stats are weighted differently:
```
characterPower = hp * hpWeight + atk * atkWeight + def * defWeight + spd * spdWeight
```
Weights are tuned per role so all roles contribute roughly equally at the same level. See `ROLE_POWER_WEIGHTS` in `expeditionSimulation.ts`.

---

## Player Data Persistence

**localStorage keys:**
- `dungeon-gacha-player` — Full PlayerSave (JSON)
- `dungeon-gacha-pending` — Pending gacha reward (anti-refresh exploit)
- `dungeon-gacha-content` — Admin game content

**PlayerSave structure:**
```typescript
{
  version: number;
  collection: OwnedCharacter[];      // All owned characters
  daily: DailyState;                 // Resets at midnight
  expeditions?: ActiveExpedition[];  // In-progress expeditions
  pityCounters?: Record<string, number>;
  teams?: TeamPreset[];              // Up to 3 team presets of 6 characters
}
```

**Daily state** resets automatically when `date !== today`. Includes gacha pulls, dungeon attempts (3/day), dungeon clear status, and XP award tracking per room.

### Team Presets
- Max **3 presets**, each holding up to **6 character IDs**
- Available as quick-load buttons in Dungeon and Expedition team selection
- Persisted in `PlayerSave.teams`

---

## Game Modes

### Gacha
- Daily pulls (configurable) + bonus pulls from dungeon/expeditions
- Pity system for epic/legendary
- Pull animation with pending reward protection

### Daily Dungeon
- Multi-room progression (typically 3-6 rooms + boss)
- Team selection → auto-battle per room → XP to survivors
- HP carries over between rooms; dead characters can't continue
- 3 attempts per day; clearing grants +1 gacha pull

### Expeditions
- Send a team for 4/8/12/24 hours (auto-resolved)
- Power-based wave clearing with progressive difficulty
- Rewards: XP (shared among team) + chance for gacha pull
- Max 3 concurrent expeditions
- Characters on expedition are unavailable elsewhere

---

## Admin System

Access: Triple-click on "Dungeon Gacha Run" title → password gate.

Editors for: characters, enemies, dungeons, abilities, gacha config, expedition config, daily dungeon schedule. Content saved to localStorage and can be published to GitHub via API.

---

## Development Conventions

- **Svelte 5 runes only**: `$state()`, `$derived()`, `$props()`, `$effect()`. No `$:` reactive declarations.
- **Immutable state updates**: Player save modified via `{ ...save, field: newValue }` pattern, then `savePlayerSave()`.
- **French locale**: Some user-facing text is in French (the game is FR-oriented).
- **Role-colored UI**: Each role has consistent colors across the app (border, text, background).
- **SpritePreview for lists**: Always use `SpritePreview.svelte` for non-battle character displays.
- **CharacterCard for combat**: Only use `CharacterCard.svelte` inside `BattleGrid` during active battles.
