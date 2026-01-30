/**
 * Player state persistence
 * Manages the player's saved game data (collection, daily tracking, etc.)
 */

import type { Rarity, Role } from '../game/types';
import type { ExpeditionDuration } from '../admin/adminTypes';

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
  /** Current experience points */
  xp: number;
}

/** Daily tracking state */
export interface DailyState {
  /** Date string (YYYY-MM-DD) for the current day */
  date: string;
  /** Number of gacha pulls remaining for today */
  gachaPullsRemaining: number;
  /** Number of dungeon attempts remaining (starts at 3) */
  dungeonAttemptsLeft: number;
  /** Whether the daily dungeon has been cleared */
  dungeonCleared: boolean;
  /** Room indices that have already awarded XP today (prevents replay exploit) */
  xpAwardedRoomIndices?: number[];
}

/** An active expedition in progress */
export interface ActiveExpedition {
  /** Unique expedition ID */
  id: string;
  /** Character IDs sent on this expedition */
  teamCharacterIds: string[];
  /** Duration in hours */
  duration: ExpeditionDuration;
  /** Timestamp (ms) when the expedition started */
  startedAt: number;
  /** Timestamp (ms) when the expedition completes */
  completesAt: number;
  /** Team power at time of departure (for reward calculation) */
  teamPower: number;
}

/** Result of a completed expedition */
export interface ExpeditionResult {
  /** How many waves the team cleared */
  wavesCleared: number;
  /** Total waves attempted */
  totalWaves: number;
  /** Whether the team cleared all waves */
  fullClear: boolean;
  /** XP earned (shared among team) */
  xpEarned: number;
  /** Whether the gacha pull was won */
  gachaPullWon: boolean;
  /** The gacha chance that was rolled against */
  gachaChance: number;
}

/** Complete player save data */
export interface PlayerSave {
  version: number;
  /** All owned characters */
  collection: OwnedCharacter[];
  /** Daily tracking */
  daily: DailyState;
  /** Currently active expeditions */
  expeditions?: ActiveExpedition[];
}

const PLAYER_SAVE_KEY = 'dungeon-gacha-player';
const PENDING_GACHA_KEY = 'dungeon-gacha-pending';
const CURRENT_PLAYER_VERSION = 1;

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function createFreshDaily(): DailyState {
  return {
    date: getTodayString(),
    gachaPullsRemaining: 1,
    dungeonAttemptsLeft: 3,
    dungeonCleared: false,
  };
}

function createDefaultSave(): PlayerSave {
  const save: PlayerSave = {
    version: CURRENT_PLAYER_VERSION,
    collection: [],
    daily: createFreshDaily(),
  };
  // New players get 3 bonus gacha pulls on top of the daily pull
  save.daily.gachaPullsRemaining = 1 + 3;
  return save;
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

    // Migrate old boolean gachaPulled to gachaPullsRemaining
    if (typeof (save.daily as any).gachaPulled === 'boolean') {
      save.daily.gachaPullsRemaining = (save.daily as any).gachaPulled ? 0 : 1;
      delete (save.daily as any).gachaPulled;
    }
    // Ensure gachaPullsRemaining is a valid number
    if (typeof save.daily.gachaPullsRemaining !== 'number') {
      save.daily.gachaPullsRemaining = 1;
    }

    // Migrate characters missing xp field
    for (const c of save.collection) {
      if (typeof c.xp !== 'number') c.xp = 0;
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
      { characterId, level: 1, ascension: 0, duplicates: 0, xp: 0 },
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

/** Consume one gacha pull */
export function markGachaPulled(save: PlayerSave): PlayerSave {
  return {
    ...save,
    daily: {
      ...save.daily,
      gachaPullsRemaining: Math.max(0, save.daily.gachaPullsRemaining - 1),
    },
  };
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

/** Mark daily dungeon as cleared and grant a bonus gacha pull */
export function markDungeonCleared(save: PlayerSave): PlayerSave {
  return {
    ...save,
    daily: {
      ...save.daily,
      dungeonCleared: true,
      gachaPullsRemaining: save.daily.gachaPullsRemaining + 1,
    },
  };
}

/** Default level thresholds if none configured */
const DEFAULT_LEVEL_THRESHOLDS = [
  10, 25, 50, 80, 120, 170, 230, 300, 400, 500,
  620, 760, 920, 1100, 1300, 1520, 1760, 2020, 2300, 2600,
];

/** Get XP needed for the next level (0-indexed: level 1 needs thresholds[0] to reach level 2) */
export function getXpForLevel(level: number, thresholds?: number[]): number | null {
  const t = thresholds && thresholds.length > 0 ? thresholds : DEFAULT_LEVEL_THRESHOLDS;
  const idx = level - 1; // level 1 → index 0
  if (idx < 0 || idx >= t.length) return null; // max level reached
  return t[idx];
}

/** Award XP to specific characters, auto-leveling when thresholds are met */
export function awardXp(
  save: PlayerSave,
  characterIds: string[],
  totalXp: number,
  levelThresholds?: number[]
): PlayerSave {
  if (characterIds.length === 0 || totalXp <= 0) return save;
  const xpEach = Math.floor(totalXp / characterIds.length);
  if (xpEach <= 0) return save;

  const idSet = new Set(characterIds);
  return {
    ...save,
    collection: save.collection.map((c) => {
      if (!idSet.has(c.characterId)) return c;
      let xp = (c.xp ?? 0) + xpEach;
      let level = c.level;
      const t = levelThresholds && levelThresholds.length > 0 ? levelThresholds : DEFAULT_LEVEL_THRESHOLDS;
      // Auto level-up
      while (true) {
        const needed = t[level - 1];
        if (needed === undefined) break; // max level
        if (xp < needed) break;
        xp -= needed;
        level++;
      }
      return { ...c, xp, level };
    }),
  };
}

/** Reset player save completely */
export function resetPlayerSave(): PlayerSave {
  const fresh = createDefaultSave();
  savePlayerSave(fresh);
  clearPendingGachaReward();
  return fresh;
}

/** Store a pending gacha reward (protects against refresh during animation) */
export function setPendingGachaReward(characterId: string): void {
  localStorage.setItem(PENDING_GACHA_KEY, characterId);
}

/** Clear the pending gacha reward after it's been collected */
export function clearPendingGachaReward(): void {
  localStorage.removeItem(PENDING_GACHA_KEY);
}

/** Claim any pending gacha reward that wasn't collected (e.g. page was refreshed mid-animation) */
export function claimPendingGachaReward(save: PlayerSave): PlayerSave {
  const pendingId = localStorage.getItem(PENDING_GACHA_KEY);
  if (!pendingId) return save;
  clearPendingGachaReward();
  return addCharacterToCollection(save, pendingId);
}

// --- Dungeon XP tracking ---

/** Mark a dungeon room index as having awarded XP (persisted in daily state) */
export function markRoomXpAwarded(save: PlayerSave, roomIndex: number): PlayerSave {
  const existing = save.daily.xpAwardedRoomIndices ?? [];
  if (existing.includes(roomIndex)) return save;
  return {
    ...save,
    daily: {
      ...save.daily,
      xpAwardedRoomIndices: [...existing, roomIndex],
    },
  };
}

/** Check if a room index has already awarded XP today */
export function hasRoomAwardedXp(save: PlayerSave, roomIndex: number): boolean {
  return (save.daily.xpAwardedRoomIndices ?? []).includes(roomIndex);
}

// --- Expedition helpers ---

/** Start a new expedition */
export function startExpedition(
  save: PlayerSave,
  teamCharacterIds: string[],
  duration: ExpeditionDuration,
  teamPower: number,
): PlayerSave {
  const now = Date.now();
  const expedition: ActiveExpedition = {
    id: `exp_${now.toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    teamCharacterIds,
    duration,
    startedAt: now,
    completesAt: now + duration * 3600 * 1000,
    teamPower,
  };
  return {
    ...save,
    expeditions: [...(save.expeditions ?? []), expedition],
  };
}

/** Remove a completed expedition from the active list */
export function removeExpedition(save: PlayerSave, expeditionId: string): PlayerSave {
  return {
    ...save,
    expeditions: (save.expeditions ?? []).filter(e => e.id !== expeditionId),
  };
}

/** Check if a character is currently on an expedition */
export function isCharacterOnExpedition(save: PlayerSave, characterId: string): boolean {
  return (save.expeditions ?? []).some(exp => exp.teamCharacterIds.includes(characterId));
}

// --- Cross-device sync ---

/** Export the current save as a base64 sync code */
export function exportSyncCode(save: PlayerSave): string {
  const json = JSON.stringify(save);
  // Use encodeURIComponent to handle Unicode, then base64-encode
  return btoa(unescape(encodeURIComponent(json)));
}

/** Import a save from a base64 sync code. Returns the parsed save or an error message. */
export function importSyncCode(code: string): PlayerSave | string {
  try {
    const trimmed = code.trim();
    if (!trimmed) return 'Code vide';
    const json = decodeURIComponent(escape(atob(trimmed)));
    const parsed = JSON.parse(json);
    // Validate basic structure
    if (typeof parsed.version !== 'number' || !Array.isArray(parsed.collection) || !parsed.daily) {
      return 'Format de sauvegarde invalide';
    }
    // Validate collection entries
    for (const c of parsed.collection) {
      if (!c.characterId || typeof c.level !== 'number') {
        return 'Donnees de collection corrompues';
      }
    }
    return parsed as PlayerSave;
  } catch {
    return 'Code de synchronisation invalide';
  }
}
