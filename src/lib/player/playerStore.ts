/**
 * Player state persistence
 * Manages the player's saved game data (collection, daily tracking, etc.)
 */

import type { Rarity, Role } from '../game/types';

/** A character owned by the player */
export interface OwnedCharacter {
  /** Reference to CharacterDefinition.id */
  characterId: string;
  /** Current level */
  level: number;
  /** Current ascension tier */
  ascension: number;
  /** Number of duplicate copies held (used for ascension) */
  duplicates: number;
}

/** Daily tracking state */
export interface DailyState {
  /** Date string (YYYY-MM-DD) for the current day */
  date: string;
  /** Whether the player has used their daily gacha pull */
  gachaPulled: boolean;
  /** Number of dungeon attempts remaining (starts at 3) */
  dungeonAttemptsLeft: number;
  /** Whether the daily dungeon has been cleared */
  dungeonCleared: boolean;
}

/** Complete player save data */
export interface PlayerSave {
  version: number;
  /** All owned characters */
  collection: OwnedCharacter[];
  /** Daily tracking */
  daily: DailyState;
}

const PLAYER_SAVE_KEY = 'dungeon-gacha-player';
const CURRENT_PLAYER_VERSION = 1;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function createFreshDaily(): DailyState {
  return {
    date: getTodayString(),
    gachaPulled: false,
    dungeonAttemptsLeft: 3,
    dungeonCleared: false,
  };
}

function createDefaultSave(): PlayerSave {
  return {
    version: CURRENT_PLAYER_VERSION,
    collection: [],
    daily: createFreshDaily(),
  };
}

/** Load player save from localStorage */
export function loadPlayerSave(): PlayerSave {
  try {
    const raw = localStorage.getItem(PLAYER_SAVE_KEY);
    if (!raw) return createDefaultSave();
    const save: PlayerSave = JSON.parse(raw);

    // Reset daily if it's a new day
    if (save.daily.date !== getTodayString()) {
      save.daily = createFreshDaily();
    }

    return save;
  } catch {
    return createDefaultSave();
  }
}

/** Save player data to localStorage */
export function savePlayerSave(save: PlayerSave): void {
  localStorage.setItem(PLAYER_SAVE_KEY, JSON.stringify(save));
}

/** Add a character to the collection (or increment duplicates if already owned) */
export function addCharacterToCollection(
  save: PlayerSave,
  characterId: string
): PlayerSave {
  const existing = save.collection.find((c) => c.characterId === characterId);
  if (existing) {
    return {
      ...save,
      collection: save.collection.map((c) =>
        c.characterId === characterId
          ? { ...c, duplicates: c.duplicates + 1 }
          : c
      ),
    };
  }
  return {
    ...save,
    collection: [
      ...save.collection,
      { characterId, level: 1, ascension: 0, duplicates: 0 },
    ],
  };
}

/** Try to ascend a character. Returns updated save or null if not enough dupes. */
export function ascendCharacter(
  save: PlayerSave,
  characterId: string,
  ascensionCosts: number[]
): PlayerSave | null {
  const owned = save.collection.find((c) => c.characterId === characterId);
  if (!owned) return null;

  const costIndex = owned.ascension; // cost to go from current to next
  if (costIndex >= ascensionCosts.length) return null; // max ascension reached
  const cost = ascensionCosts[costIndex];
  if (owned.duplicates < cost) return null; // not enough dupes

  return {
    ...save,
    collection: save.collection.map((c) =>
      c.characterId === characterId
        ? {
            ...c,
            ascension: c.ascension + 1,
            duplicates: c.duplicates - cost,
          }
        : c
    ),
  };
}

/** Mark daily gacha as used */
export function markGachaPulled(save: PlayerSave): PlayerSave {
  return { ...save, daily: { ...save.daily, gachaPulled: true } };
}

/** Use a dungeon attempt */
export function useDungeonAttempt(save: PlayerSave): PlayerSave {
  return {
    ...save,
    daily: {
      ...save.daily,
      dungeonAttemptsLeft: Math.max(0, save.daily.dungeonAttemptsLeft - 1),
    },
  };
}

/** Mark daily dungeon as cleared */
export function markDungeonCleared(save: PlayerSave): PlayerSave {
  return { ...save, daily: { ...save.daily, dungeonCleared: true } };
}

/** Reset player save completely */
export function resetPlayerSave(): PlayerSave {
  const fresh = createDefaultSave();
  savePlayerSave(fresh);
  return fresh;
}
