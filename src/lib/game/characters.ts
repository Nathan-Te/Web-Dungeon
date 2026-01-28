import type { CharacterDefinition } from './types';

/**
 * All character definitions for the game
 * 20 characters total: 5 Common, 5 Rare, 5 Epic, 5 Legendary
 * Each rarity has approximately 1 character per role
 */
export const CHARACTER_DEFINITIONS: CharacterDefinition[] = [
  // ============== COMMON (1 star) ==============
  {
    id: 'char_001',
    name: 'Bruno',
    role: 'tank',
    rarity: 'common',
    abilityName: 'Taunt',
    abilityDescription: 'Draws enemy attention and reduces incoming damage',
  },
  {
    id: 'char_002',
    name: 'Aria',
    role: 'warrior',
    rarity: 'common',
    abilityName: 'Cleave',
    abilityDescription: 'Sweeps weapon hitting up to 3 enemies',
  },
  {
    id: 'char_003',
    name: 'Flynn',
    role: 'archer',
    rarity: 'common',
    abilityName: 'Multi-shot',
    abilityDescription: 'Fires arrows at 2 random targets',
  },
  {
    id: 'char_004',
    name: 'Mira',
    role: 'mage',
    rarity: 'common',
    abilityName: 'Fireball',
    abilityDescription: 'Hurls a ball of fire for high burst damage',
  },
  {
    id: 'char_005',
    name: 'Shade',
    role: 'assassin',
    rarity: 'common',
    abilityName: 'Backstab',
    abilityDescription: 'Strikes from behind, ignoring armor',
  },

  // ============== RARE (2 stars) ==============
  {
    id: 'char_006',
    name: 'Gideon',
    role: 'tank',
    rarity: 'rare',
    abilityName: 'Taunt',
    abilityDescription: 'Draws enemy attention with a mighty shout',
  },
  {
    id: 'char_007',
    name: 'Kira',
    role: 'warrior',
    rarity: 'rare',
    abilityName: 'Cleave',
    abilityDescription: 'Powerful sweeping strike hitting multiple foes',
  },
  {
    id: 'char_008',
    name: 'Elara',
    role: 'healer',
    rarity: 'rare',
    abilityName: 'Heal',
    abilityDescription: 'Restores HP to the most wounded ally',
  },
  {
    id: 'char_009',
    name: 'Raven',
    role: 'assassin',
    rarity: 'rare',
    abilityName: 'Backstab',
    abilityDescription: 'Silent strike that bypasses defenses',
  },
  {
    id: 'char_010',
    name: 'Zephyr',
    role: 'mage',
    rarity: 'rare',
    abilityName: 'Fireball',
    abilityDescription: 'Channels wind-fueled flames for devastating damage',
  },

  // ============== EPIC (3 stars) ==============
  {
    id: 'char_011',
    name: 'Thorin',
    role: 'tank',
    rarity: 'epic',
    abilityName: 'Taunt',
    abilityDescription: 'Iron-willed taunt that forces enemy focus',
  },
  {
    id: 'char_012',
    name: 'Seraphina',
    role: 'healer',
    rarity: 'epic',
    abilityName: 'Heal',
    abilityDescription: 'Divine light that mends the gravely wounded',
  },
  {
    id: 'char_013',
    name: 'Hawk',
    role: 'archer',
    rarity: 'epic',
    abilityName: 'Multi-shot',
    abilityDescription: 'Legendary accuracy hitting multiple marks',
  },
  {
    id: 'char_014',
    name: 'Vex',
    role: 'assassin',
    rarity: 'epic',
    abilityName: 'Backstab',
    abilityDescription: 'Phantom blade that pierces all armor',
  },
  {
    id: 'char_015',
    name: 'Magnus',
    role: 'warrior',
    rarity: 'epic',
    abilityName: 'Cleave',
    abilityDescription: 'Crushing blow that devastates enemy lines',
  },

  // ============== LEGENDARY (4 stars) ==============
  {
    id: 'char_016',
    name: 'Drakkon',
    role: 'tank',
    rarity: 'legendary',
    abilityName: 'Taunt',
    abilityDescription: 'Dragon-blooded warrior whose presence dominates the battlefield',
  },
  {
    id: 'char_017',
    name: 'Celestia',
    role: 'healer',
    rarity: 'legendary',
    abilityName: 'Heal',
    abilityDescription: 'Angelic blessing that restores allies to full vigor',
  },
  {
    id: 'char_018',
    name: 'Azrael',
    role: 'mage',
    rarity: 'legendary',
    abilityName: 'Fireball',
    abilityDescription: 'Arcane inferno that incinerates everything in its path',
  },
  {
    id: 'char_019',
    name: 'Nyx',
    role: 'assassin',
    rarity: 'legendary',
    abilityName: 'Backstab',
    abilityDescription: 'Shadow empress whose blade is death itself',
  },
  {
    id: 'char_020',
    name: 'Artemis',
    role: 'archer',
    rarity: 'legendary',
    abilityName: 'Multi-shot',
    abilityDescription: 'Divine huntress whose arrows never miss',
  },
];

/**
 * Get character definition by ID
 */
export function getCharacterById(id: string): CharacterDefinition | undefined {
  return CHARACTER_DEFINITIONS.find((c) => c.id === id);
}

/**
 * Get all characters of a specific rarity
 */
export function getCharactersByRarity(rarity: CharacterDefinition['rarity']): CharacterDefinition[] {
  return CHARACTER_DEFINITIONS.filter((c) => c.rarity === rarity);
}

/**
 * Get all characters of a specific role
 */
export function getCharactersByRole(role: CharacterDefinition['role']): CharacterDefinition[] {
  return CHARACTER_DEFINITIONS.filter((c) => c.role === role);
}
