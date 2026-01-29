/**
 * Core game type definitions
 */

/** Character roles with specific combat behaviors */
export type Role = 'tank' | 'warrior' | 'archer' | 'mage' | 'assassin' | 'healer' | 'summoner';

/** Character rarity tiers */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

/** Grid position in battlefield (row 0 = front; row 3 = extra row for boss fights) */
export interface Position {
  row: 0 | 1 | 2 | 3;
  col: 0 | 1 | 2;
}

/** Base character stats (level 1, ascension 0) */
export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  spd: number;
}

/** Role-specific base stats from game design doc */
export const ROLE_BASE_STATS: Record<Role, BaseStats> = {
  tank: { hp: 1000, atk: 80, def: 150, spd: 50 },
  warrior: { hp: 700, atk: 120, def: 80, spd: 70 },
  archer: { hp: 500, atk: 150, def: 40, spd: 90 },
  mage: { hp: 450, atk: 180, def: 30, spd: 60 },
  assassin: { hp: 550, atk: 140, def: 50, spd: 120 },
  healer: { hp: 600, atk: 60, def: 60, spd: 80 },
  summoner: { hp: 550, atk: 100, def: 50, spd: 65 },
};

/** Preferred row positions by role */
export const ROLE_PREFERRED_ROW: Record<Role, 0 | 1 | 2> = {
  tank: 0, // Front
  warrior: 0, // Front
  archer: 2, // Back
  mage: 2, // Back
  assassin: 1, // Mid
  healer: 2, // Back
  summoner: 2, // Back
};

/** Animation state for sprites */
export type AnimState = 'idle' | 'attack' | 'castAbility' | 'death';

/** Visual hit effect on the target of an action */
export type HitEffect = 'damage' | 'heal';

/** Sprite sheet configuration for frame-based animation */
export interface SpriteSheetConfig {
  /** URL or base64 data URI of the sprite sheet image */
  src: string;
  /** Width of a single frame in px */
  frameWidth: number;
  /** Height of a single frame in px */
  frameHeight: number;
  /** Total number of frames in the sheet */
  frameCount: number;
  /** Number of frames per row in the sheet */
  framesPerRow: number;
}

/** A sprite source: either a static image URL or a sprite sheet config */
export type SpriteSource = string | SpriteSheetConfig;

/** Sprite set with animation states — each slot is a static image or a sprite sheet */
export interface SpriteSet {
  idle?: SpriteSource;
  attack?: SpriteSource;
  castAbility?: SpriteSource;
  death?: SpriteSource;
  /** Global animation speed in ms per frame (default 150) */
  frameDuration?: number;
  /** Display scale multiplier for sprites (default 1.0) */
  spriteScale?: number;
}

/** Character definition (static data) */
export interface CharacterDefinition {
  id: string;
  name: string;
  role: Role;
  rarity: Rarity;
  abilityName: string;
  abilityDescription: string;
  /** Sprite images per animation state */
  sprites?: SpriteSet;
  /** @deprecated Use sprites.idle instead — kept for migration */
  sprite?: string;
  /** For summoner role: IDs of characters this summoner can summon */
  summonIds?: string[];
  /** Max active summons (1-3, default 1) */
  maxSummons?: number;
}

/** Combat state for a character during battle */
export interface CombatState {
  characterId: string;
  currentHp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  position: Position;
  team: 'player' | 'enemy';
  isAlive: boolean;
  level: number;
  ascension: number;
  /** Whether this unit is a boss (occupies 3x3) */
  isBoss?: boolean;
  /** Whether this unit was summoned mid-battle */
  isSummoned?: boolean;
}

/** Types of combat actions */
export type ActionType = 'attack' | 'ability' | 'heal' | 'death' | 'summon';

/** Single combat action log entry */
export interface CombatAction {
  turn: number;
  actorId: string;
  actorName: string;
  actionType: ActionType;
  targetId?: string;
  targetName?: string;
  damage?: number;
  healing?: number;
  isCritical?: boolean;
  abilityUsed?: string;
  message: string;
  /** For AOE abilities: per-target damage data */
  aoeTargets?: { id: string; damage: number }[];
  /** For summon actions: the summoned unit data */
  summonedUnit?: {
    id: string;
    name: string;
    role: Role;
    hp: number;
    atk: number;
    def: number;
    spd: number;
    position: Position;
    team: 'player' | 'enemy';
    sprites?: SpriteSet;
  };
}

/** Battle result */
export interface BattleResult {
  winner: 'player' | 'enemy' | 'draw';
  turns: number;
  actionLog: CombatAction[];
  playerSurvivors: string[];
  enemySurvivors: string[];
  seed: number;
}

/** Gacha rates by rarity */
export const GACHA_RATES: Record<Rarity, number> = {
  common: 0.74,
  rare: 0.20,
  epic: 0.05,
  legendary: 0.01,
};

/** Starlight conversion values for max-ascension dupes */
export const STARLIGHT_VALUES: Record<Rarity, number> = {
  common: 10,
  rare: 50,
  epic: 200,
  legendary: 1000,
};

/** Combat constants */
export const COMBAT_CONSTANTS = {
  MAX_TURNS: 30,
  CRIT_CHANCE: 0.05,
  CRIT_MULTIPLIER: 2.0,
  DAMAGE_VARIANCE: 0.1, // ±10%
  ABILITY_TRIGGER_CHANCE: 0.25, // 25% chance to trigger ability
  MAX_ASCENSION: 6,
  ASCENSION_STAT_BONUS: 0.15, // +15% per ascension
  LEVEL_STAT_BONUS: 0.1, // +10% per level above 1
};
