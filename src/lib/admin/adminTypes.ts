/**
 * Admin content types
 * Extends core game types with editor-specific data
 */

import type { CharacterDefinition, Role, Rarity, SpriteSet, BaseStats } from '../game/types';
import type { AbilityDefinition } from '../game/abilities';

/** Gacha configuration set by admin */
export interface GachaConfig {
  /** IDs of characters available in the gacha pool */
  characterPool: string[];
  /** Pull rates per rarity (must sum to 1.0) */
  rates: Record<Rarity, number>;
  /** Number of duplicates required for each ascension level (index 0 = asc 0→1, etc.) */
  ascensionCosts: number[];
}

/** Enemy template for dungeon encounters */
export interface EnemyTemplate {
  id: string;
  name: string;
  role: Role;
  rarity: Rarity;
  level: number;
  ascension: number;
  /** Reference to ability ID from the abilities list */
  abilityId: string;
  /** Whether this enemy is a boss (occupies 3x3, can have multiple abilities) */
  isBoss?: boolean;
  /** Multiple ability IDs for bosses (used instead of abilityId when isBoss) */
  abilityIds?: string[];
  /** Sprite images per animation state */
  sprites?: SpriteSet;
  /** @deprecated Use sprites.idle instead — kept for migration */
  sprite?: string;
  /** Optional stat overrides (multipliers applied to role base stats) */
  statOverrides?: {
    hpMult?: number;
    atkMult?: number;
    defMult?: number;
    spdMult?: number;
  };
  /** For summoner role: IDs of enemy templates this summoner can summon */
  summonIds?: string[];
  /** Max active summons (1-3, default 1) */
  maxSummons?: number;
}

/** A dungeon room with enemy composition */
export interface DungeonRoom {
  id: string;
  name: string;
  roomNumber: number; // 1-5 for normal, 6 for boss
  isBoss: boolean;
  enemies: DungeonRoomEnemy[];
  /** Difficulty multiplier applied to enemy stats */
  difficultyMult: number;
  /** XP reward shared among surviving characters when room is cleared */
  xpReward: number;
}

/** Enemy placement in a dungeon room */
export interface DungeonRoomEnemy {
  enemyTemplateId: string;
  /** Override position on 3x3 grid (optional, auto-assigned if not set) */
  position?: { row: 0 | 1 | 2; col: 0 | 1 | 2 };
}

/** Extended character definition with ability ID reference */
export interface CharacterWithAbility extends CharacterDefinition {
  /** Reference to ability ID */
  abilityId: string;
}

/** A dungeon is a sequence of rooms the player progresses through */
export interface Dungeon {
  id: string;
  name: string;
  description: string;
  rooms: DungeonRoom[];
  /** Maximum team size for this dungeon (default 5) */
  maxTeamSize?: number;
}

/** Expedition duration options in hours */
export type ExpeditionDuration = 4 | 8 | 12 | 24;

/** Admin-configurable expedition settings */
export interface ExpeditionConfig {
  /** Max units per expedition team (1-5) */
  maxTeamSize: number;
  /** Difficulty settings per duration tier */
  durationTiers: Record<ExpeditionDuration, ExpeditionDurationTier>;
  /** Base XP reward per wave cleared */
  baseXpPerWave: number;
  /** Base gacha pull chance (0-1) for a 4h expedition at power ratio 1.0 */
  baseGachaChance: number;
  /** Gacha chance multiplier per duration tier (applied to baseGachaChance) */
  gachaChanceMultiplier: Record<ExpeditionDuration, number>;
  /** Power ratio thresholds: ratio = teamPower / requiredPower */
  powerRatioGachaBonus: number;
  /** Max gacha chance cap (0-1) */
  maxGachaChance: number;
}

/** Per-duration expedition tier settings */
export interface ExpeditionDurationTier {
  /** Number of waves the team attempts */
  totalWaves: number;
  /** Enemy power level (multiplier on base enemy stats) */
  enemyPowerMult: number;
  /** XP multiplier applied to baseXpPerWave */
  xpMultiplier: number;
  /** Required team power to clear all waves (approximate) */
  requiredPower: number;
}

/** Complete game content bundle (for export/import) */
export interface GameContent {
  version: number;
  characters: CharacterDefinition[];
  enemies: EnemyTemplate[];
  /** @deprecated Use dungeons instead. Kept for migration only. */
  dungeonRooms?: DungeonRoom[];
  dungeons: Dungeon[];
  abilities: AbilityDefinition[];
  /** Custom base stats per role (overrides defaults from ROLE_BASE_STATS) */
  roleStats?: Partial<Record<Role, BaseStats>>;
  /** Gacha system configuration */
  gachaConfig?: GachaConfig;
  /** Expedition system configuration */
  expeditionConfig?: ExpeditionConfig;
  /** ID of the dungeon used as today's daily dungeon (admin picks) */
  dailyDungeonId?: string;
  /** Calendar schedule: date (YYYY-MM-DD) → dungeon ID */
  dailyDungeonSchedule?: Record<string, string>;
  /** Max team size for dungeon (default 6) */
  maxDungeonTeamSize?: number;
  /** Timestamp of last online publish (ms since epoch) */
  publishedAt?: number;
  /** XP thresholds for each level: index 0 = XP needed for level 1→2, etc. */
  levelThresholds?: number[];
  /** Stat multiplier per rarity tier (applied to base stats before level/ascension scaling) */
  rarityMultipliers?: Record<Rarity, number>;
}

export const CURRENT_CONTENT_VERSION = 3;

/** Generate a unique ID */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Create a blank character definition */
export function createBlankCharacter(): CharacterDefinition {
  return {
    id: generateId('char'),
    name: '',
    role: 'warrior',
    rarity: 'common',
    abilityName: '',
    abilityDescription: '',
  };
}

/** Create a blank enemy template */
export function createBlankEnemy(): EnemyTemplate {
  return {
    id: generateId('enemy'),
    name: '',
    role: 'warrior',
    rarity: 'common',
    level: 1,
    ascension: 0,
    abilityId: 'ability_cleave',
  };
}

/** Create a blank dungeon room */
export function createBlankRoom(roomNumber: number): DungeonRoom {
  return {
    id: generateId('room'),
    name: `Room ${roomNumber}`,
    roomNumber,
    isBoss: roomNumber === 6,
    enemies: [],
    difficultyMult: 1 + (roomNumber - 1) * 0.1,
    xpReward: roomNumber * 10,
  };
}

/** Create a blank dungeon */
export function createBlankDungeon(): Dungeon {
  return {
    id: generateId('dungeon'),
    name: '',
    description: '',
    rooms: [],
  };
}

/** Create a blank ability definition */
export function createBlankAbility(): AbilityDefinition {
  return {
    id: generateId('ability'),
    name: '',
    description: '',
    allowedRoles: ['warrior'],
    powerMultiplier: 1.0,
    targeting: 'single_closest',
    targetCount: 1,
    ignoreDefense: false,
    healThreshold: 0,
  };
}

/** Create default expedition config */
export function createDefaultExpeditionConfig(): ExpeditionConfig {
  return {
    maxTeamSize: 5,
    baseXpPerWave: 15,
    baseGachaChance: 0.05,
    gachaChanceMultiplier: { 4: 1.0, 8: 1.8, 12: 2.5, 24: 4.0 },
    powerRatioGachaBonus: 0.5,
    maxGachaChance: 0.60,
    durationTiers: {
      4: { totalWaves: 8, enemyPowerMult: 1.0, xpMultiplier: 1.0, requiredPower: 500 },
      8: { totalWaves: 16, enemyPowerMult: 1.5, xpMultiplier: 1.5, requiredPower: 1000 },
      12: { totalWaves: 24, enemyPowerMult: 2.0, xpMultiplier: 2.0, requiredPower: 2000 },
      24: { totalWaves: 40, enemyPowerMult: 3.0, xpMultiplier: 3.0, requiredPower: 4000 },
    },
  };
}
