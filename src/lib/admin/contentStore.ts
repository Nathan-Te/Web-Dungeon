/**
 * Content store with localStorage persistence and JSON import/export
 */

import type { CharacterDefinition } from '../game/types';
import { CHARACTER_DEFINITIONS } from '../game/characters';
import {
  type GameContent,
  type EnemyTemplate,
  type DungeonRoom,
  CURRENT_CONTENT_VERSION,
  createEmptyContent,
} from './adminTypes';

const STORAGE_KEY = 'dungeon-gacha-content';

/** Load content from localStorage, falling back to defaults */
export function loadContent(): GameContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameContent;
      if (parsed.version === CURRENT_CONTENT_VERSION) {
        return parsed;
      }
    }
  } catch {
    // Ignore parse errors
  }

  // Default: load built-in character definitions
  return {
    version: CURRENT_CONTENT_VERSION,
    characters: [...CHARACTER_DEFINITIONS],
    enemies: [],
    dungeonRooms: [],
  };
}

/** Save content to localStorage */
export function saveContent(content: GameContent): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
}

/** Export content as downloadable JSON file */
export function exportContentAsJson(content: GameContent): void {
  const json = JSON.stringify(content, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `dungeon-gacha-content-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Import content from JSON file. Returns parsed content or error message. */
export function parseImportedJson(jsonString: string): GameContent | string {
  try {
    const parsed = JSON.parse(jsonString);

    if (!parsed.version || !Array.isArray(parsed.characters)) {
      return 'Invalid content format: missing version or characters array';
    }

    // Validate characters
    for (const char of parsed.characters) {
      if (!char.id || !char.name || !char.role || !char.rarity) {
        return `Invalid character: ${JSON.stringify(char).slice(0, 80)}`;
      }
    }

    return parsed as GameContent;
  } catch (e) {
    return `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Reset content to built-in defaults */
export function resetToDefaults(): GameContent {
  const content: GameContent = {
    version: CURRENT_CONTENT_VERSION,
    characters: [...CHARACTER_DEFINITIONS],
    enemies: [],
    dungeonRooms: [],
  };
  saveContent(content);
  return content;
}

// --- CRUD helpers ---

export function upsertCharacter(
  content: GameContent,
  character: CharacterDefinition
): GameContent {
  const idx = content.characters.findIndex((c) => c.id === character.id);
  const characters =
    idx >= 0
      ? content.characters.map((c, i) => (i === idx ? character : c))
      : [...content.characters, character];
  return { ...content, characters };
}

export function deleteCharacter(content: GameContent, id: string): GameContent {
  return {
    ...content,
    characters: content.characters.filter((c) => c.id !== id),
  };
}

export function upsertEnemy(
  content: GameContent,
  enemy: EnemyTemplate
): GameContent {
  const idx = content.enemies.findIndex((e) => e.id === enemy.id);
  const enemies =
    idx >= 0
      ? content.enemies.map((e, i) => (i === idx ? enemy : e))
      : [...content.enemies, enemy];
  return { ...content, enemies };
}

export function deleteEnemy(content: GameContent, id: string): GameContent {
  return {
    ...content,
    enemies: content.enemies.filter((e) => e.id !== id),
    // Also remove from dungeon rooms
    dungeonRooms: content.dungeonRooms.map((room) => ({
      ...room,
      enemies: room.enemies.filter((e) => e.enemyTemplateId !== id),
    })),
  };
}

export function upsertRoom(
  content: GameContent,
  room: DungeonRoom
): GameContent {
  const idx = content.dungeonRooms.findIndex((r) => r.id === room.id);
  const dungeonRooms =
    idx >= 0
      ? content.dungeonRooms.map((r, i) => (i === idx ? room : r))
      : [...content.dungeonRooms, room];
  return { ...content, dungeonRooms };
}

export function deleteRoom(content: GameContent, id: string): GameContent {
  return {
    ...content,
    dungeonRooms: content.dungeonRooms.filter((r) => r.id !== id),
  };
}
