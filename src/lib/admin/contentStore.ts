/**
 * Content store with localStorage persistence and JSON import/export
 */

import type { CharacterDefinition } from '../game/types';
import { CHARACTER_DEFINITIONS } from '../game/characters';
import { DEFAULT_ABILITIES, type AbilityDefinition } from '../game/abilities';
import {
  type GameContent,
  type EnemyTemplate,
  type DungeonRoom,
  type Dungeon,
  type Tower,
  CURRENT_CONTENT_VERSION,
} from './adminTypes';

const STORAGE_KEY = 'dungeon-gacha-content';

/** Create default content with built-in data */
function createDefaultContent(): GameContent {
  return {
    version: CURRENT_CONTENT_VERSION,
    characters: [...CHARACTER_DEFINITIONS],
    enemies: [],
    dungeons: [],
    abilities: [...DEFAULT_ABILITIES],
  };
}

/** Migrate older content to current version */
function migrateContent(parsed: Record<string, unknown>): GameContent {
  const content = parsed as Partial<GameContent> & { dungeonRooms?: DungeonRoom[] };

  // Migrate standalone dungeonRooms (v2) into a single dungeon (v3)
  let dungeons: Dungeon[] = [];
  if (Array.isArray(content.dungeons) && content.dungeons.length > 0) {
    dungeons = content.dungeons;
  } else if (Array.isArray(content.dungeonRooms) && content.dungeonRooms.length > 0) {
    // Wrap old standalone rooms into one dungeon
    dungeons = [{
      id: 'dungeon_migrated',
      name: 'Migrated Dungeon',
      description: 'Auto-migrated from standalone rooms',
      rooms: content.dungeonRooms,
    }];
  }

  return {
    version: CURRENT_CONTENT_VERSION,
    characters: Array.isArray(content.characters) ? content.characters : [...CHARACTER_DEFINITIONS],
    enemies: Array.isArray(content.enemies) ? content.enemies : [],
    dungeons,
    abilities: Array.isArray(content.abilities) ? content.abilities : [...DEFAULT_ABILITIES],
  };
}

/** Load content from localStorage, falling back to defaults */
export function loadContent(): GameContent {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.version === CURRENT_CONTENT_VERSION && Array.isArray(parsed.dungeons)) {
        // Ensure abilities array exists
        if (!Array.isArray(parsed.abilities)) {
          parsed.abilities = [...DEFAULT_ABILITIES];
        }
        return parsed as GameContent;
      }
      // Migrate older versions
      const migrated = migrateContent(parsed);
      saveContent(migrated);
      return migrated;
    }
  } catch {
    // Ignore parse errors
  }

  return createDefaultContent();
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

    for (const char of parsed.characters) {
      if (!char.id || !char.name || !char.role || !char.rarity) {
        return `Invalid character: ${JSON.stringify(char).slice(0, 80)}`;
      }
    }

    // Migrate if needed
    return migrateContent(parsed);
  } catch (e) {
    return `JSON parse error: ${e instanceof Error ? e.message : String(e)}`;
  }
}

/** Reset content to built-in defaults */
export function resetToDefaults(): GameContent {
  const content = createDefaultContent();
  saveContent(content);
  return content;
}

// --- Online publish via GitHub API ---

const GITHUB_REPO = 'Nathan-Te/Web-Dungeon';
const CONTENT_PATH = 'public/data/content.json';
const GITHUB_TOKEN_KEY = 'dungeon-admin-github-token';

/**
 * Simple XOR obfuscation key — not encryption, but prevents the token
 * from being stored as plain text visible in DevTools sessionStorage.
 */
const OBFUSCATION_KEY = 'dGcha-0bfu5k';

function xorObfuscate(input: string, key: string): string {
  let result = '';
  for (let i = 0; i < input.length; i++) {
    result += String.fromCharCode(input.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/** Store GitHub token in sessionStorage (XOR-obfuscated) */
export function setGitHubToken(token: string): void {
  const obfuscated = btoa(xorObfuscate(token, OBFUSCATION_KEY));
  sessionStorage.setItem(GITHUB_TOKEN_KEY, obfuscated);
}

/** Retrieve stored GitHub token (de-obfuscated) */
export function getGitHubToken(): string | null {
  const stored = sessionStorage.getItem(GITHUB_TOKEN_KEY);
  if (!stored) return null;
  try {
    return xorObfuscate(atob(stored), OBFUSCATION_KEY);
  } catch {
    return null;
  }
}

/** Clear the stored GitHub token */
export function clearGitHubToken(): void {
  sessionStorage.removeItem(GITHUB_TOKEN_KEY);
}

/** Publish content to GitHub repo as a static JSON file */
export async function publishContentOnline(
  content: GameContent,
  token: string,
): Promise<{ success: true; publishedAt: number } | { success: false; error: string }> {
  try {
    const publishedAt = Date.now();
    const published = { ...content, publishedAt };
    const jsonStr = JSON.stringify(published, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

    // Get current file SHA (required for updates)
    const getRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONTENT_PATH}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.v3+json' } },
    );

    let sha: string | undefined;
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      return { success: false, error: `GitHub GET error: ${getRes.status}` };
    }

    // Create or update the file
    const putBody: Record<string, string> = {
      message: `publish: update game content (${new Date(publishedAt).toISOString()})`,
      content: base64Content,
    };
    if (sha) putBody.sha = sha;

    const putRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${CONTENT_PATH}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(putBody),
      },
    );

    if (!putRes.ok) {
      const err = await putRes.text();
      return { success: false, error: `GitHub PUT error ${putRes.status}: ${err}` };
    }

    return { success: true, publishedAt };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// --- Fetch published content (player side) ---

const PUBLISHED_CONTENT_URL = import.meta.env.BASE_URL + 'data/content.json';

/** Fetch the latest published content from the static file */
export async function fetchPublishedContent(): Promise<GameContent | null> {
  try {
    const res = await fetch(PUBLISHED_CONTENT_URL, { cache: 'no-cache' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.version || !Array.isArray(data.characters)) return null;
    return data as GameContent;
  } catch {
    return null;
  }
}

/**
 * Load content with online sync: fetch published content and use it
 * if it's newer than what's in localStorage.
 */
export async function loadContentWithSync(): Promise<GameContent> {
  const local = loadContent();
  const remote = await fetchPublishedContent();

  if (!remote || !remote.publishedAt) return local;

  const localPublishedAt = local.publishedAt ?? 0;
  if (remote.publishedAt > localPublishedAt) {
    // Remote is newer — migrate if needed and save locally
    const migrated = remote.version === CURRENT_CONTENT_VERSION && Array.isArray(remote.dungeons)
      ? remote
      : migrateContent(remote as unknown as Record<string, unknown>);
    saveContent(migrated);
    return migrated;
  }

  return local;
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
    dungeons: content.dungeons.map((d) => ({
      ...d,
      rooms: d.rooms.map((room) => ({
        ...room,
        enemies: room.enemies.filter((e) => e.enemyTemplateId !== id),
      })),
    })),
  };
}

export function upsertDungeon(
  content: GameContent,
  dungeon: Dungeon
): GameContent {
  const idx = content.dungeons.findIndex((d) => d.id === dungeon.id);
  const dungeons =
    idx >= 0
      ? content.dungeons.map((d, i) => (i === idx ? dungeon : d))
      : [...content.dungeons, dungeon];
  return { ...content, dungeons };
}

export function deleteDungeon(content: GameContent, id: string): GameContent {
  return {
    ...content,
    dungeons: content.dungeons.filter((d) => d.id !== id),
  };
}

export function upsertAbility(
  content: GameContent,
  ability: AbilityDefinition
): GameContent {
  const idx = content.abilities.findIndex((a) => a.id === ability.id);
  const abilities =
    idx >= 0
      ? content.abilities.map((a, i) => (i === idx ? ability : a))
      : [...content.abilities, ability];
  return { ...content, abilities };
}

export function deleteAbility(content: GameContent, id: string): GameContent {
  return {
    ...content,
    abilities: content.abilities.filter((a) => a.id !== id),
  };
}

export function upsertTower(
  content: GameContent,
  tower: Tower
): GameContent {
  const towers = content.towers ?? [];
  const idx = towers.findIndex((t) => t.id === tower.id);
  const updated =
    idx >= 0
      ? towers.map((t, i) => (i === idx ? tower : t))
      : [...towers, tower];
  return { ...content, towers: updated };
}

export function deleteTower(content: GameContent, id: string): GameContent {
  return {
    ...content,
    towers: (content.towers ?? []).filter((t) => t.id !== id),
  };
}
