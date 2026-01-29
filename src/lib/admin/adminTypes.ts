/**
 * Admin content types
 * Extends core game types with editor-specific data
 */

import type { CharacterDefinition, Role, Rarity } from '../game/types';

/** Enemy template for dungeon encounters */
export interface EnemyTemplate {
  id: string;
  name: string;
  role: Role;
  rarity: Rarity;
  level: number;
  ascension: number;
  abilityName: string;
  abilityDescription: string;
  /** Optional stat overrides (multipliers applied to role base stats) */
  statOverrides?: {
    hpMult?: number;
    atkMult?: number;
    defMult?: number;
    spdMult?: number;
  };
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
}

/** Enemy placement in a dungeon room */
export interface DungeonRoomEnemy {
  enemyTemplateId: string;
  /** Override position on 3x3 grid (optional, auto-assigned if not set) */
  position?: { row: 0 | 1 | 2; col: 0 | 1 | 2 };
}

/** Complete game content bundle (for export/import) */
export interface GameContent {
  version: number;
  characters: CharacterDefinition[];
  enemies: EnemyTemplate[];
  dungeonRooms: DungeonRoom[];
}

export const CURRENT_CONTENT_VERSION = 1;

/** Default empty content */
export function createEmptyContent(): GameContent {
  return {
    version: CURRENT_CONTENT_VERSION,
    characters: [],
    enemies: [],
    dungeonRooms: [],
  };
}

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
    abilityName: '',
    abilityDescription: '',
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
  };
}
