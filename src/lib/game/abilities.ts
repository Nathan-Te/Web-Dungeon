/**
 * Ability definitions - data-driven spell system
 * All hardcoded ability values are extracted here for admin editing
 */

import type { Role, SpriteSource } from './types';

/** Ability targeting modes */
export type AbilityTargeting =
  | 'single_closest'    // Tank/Warrior default: nearest enemy
  | 'single_lowest_hp'  // Mage/Archer default: weakest enemy
  | 'single_back_row'   // Assassin default: back row enemy
  | 'aoe_first_n'       // Cleave: hits first N enemies
  | 'aoe_random_n'      // Multi-shot: hits N random enemies
  | 'heal_lowest_ally'  // Healer: heals weakest ally under threshold
  | 'summon_unit';      // Summoner: summons a unit onto the battlefield

/** Full ability definition */
export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  /** Which roles can use this ability */
  allowedRoles: Role[];
  /** Damage/heal multiplier relative to ATK */
  powerMultiplier: number;
  /** Targeting mode */
  targeting: AbilityTargeting;
  /** Number of targets for AoE abilities */
  targetCount: number;
  /** Whether this ability ignores DEF */
  ignoreDefense: boolean;
  /** For healer: HP threshold (0-1) below which allies are eligible */
  healThreshold: number;
  /** Cooldown in turns (0 = no cooldown, usable every turn if triggered) */
  cooldown?: number;
  /** Sprite/spritesheet displayed on the caster when using this ability */
  casterSprite?: SpriteSource;
  /** Sprite/spritesheet displayed on each target hit by this ability */
  targetSprite?: SpriteSource;
}

/** Built-in ability definitions */
export const DEFAULT_ABILITIES: AbilityDefinition[] = [
  {
    id: 'ability_taunt',
    name: 'Taunt',
    description: 'Reduced damage attack that draws enemy aggro. Deals 70% ATK.',
    allowedRoles: ['tank'],
    powerMultiplier: 0.7,
    targeting: 'single_closest',
    targetCount: 1,
    ignoreDefense: false,
    healThreshold: 0,
  },
  {
    id: 'ability_cleave',
    name: 'Cleave',
    description: 'Sweeping strike hitting up to 3 enemies for 60% ATK each.',
    allowedRoles: ['warrior'],
    powerMultiplier: 0.6,
    targeting: 'aoe_first_n',
    targetCount: 3,
    ignoreDefense: false,
    healThreshold: 0,
  },
  {
    id: 'ability_multishot',
    name: 'Multi-shot',
    description: 'Fires arrows at 2 random enemies for 70% ATK each.',
    allowedRoles: ['archer'],
    powerMultiplier: 0.7,
    targeting: 'aoe_random_n',
    targetCount: 2,
    ignoreDefense: false,
    healThreshold: 0,
  },
  {
    id: 'ability_fireball',
    name: 'Fireball',
    description: 'High burst damage single-target spell. Deals 150% ATK.',
    allowedRoles: ['mage'],
    powerMultiplier: 1.5,
    targeting: 'single_lowest_hp',
    targetCount: 1,
    ignoreDefense: false,
    healThreshold: 0,
  },
  {
    id: 'ability_backstab',
    name: 'Backstab',
    description: 'Strike from the shadows ignoring all armor. Deals 100% ATK, bypasses DEF.',
    allowedRoles: ['assassin'],
    powerMultiplier: 1.0,
    targeting: 'single_back_row',
    targetCount: 1,
    ignoreDefense: true,
    healThreshold: 0,
  },
  {
    id: 'ability_heal',
    name: 'Heal',
    description: 'Restores HP to the most wounded ally (below 70% HP). Heals for 200% ATK.',
    allowedRoles: ['healer'],
    powerMultiplier: 2.0,
    targeting: 'heal_lowest_ally',
    targetCount: 1,
    ignoreDefense: false,
    healThreshold: 0.7,
  },
  {
    id: 'ability_summon',
    name: 'Summon',
    description: 'Summons an ally unit onto the battlefield. Max summons depends on the summoner.',
    allowedRoles: ['summoner'],
    powerMultiplier: 0,
    targeting: 'summon_unit',
    targetCount: 1,
    ignoreDefense: false,
    healThreshold: 0,
  },
];

/** Get ability definition by ID */
export function getAbilityById(abilities: AbilityDefinition[], id: string): AbilityDefinition | undefined {
  return abilities.find((a) => a.id === id);
}

/** Get abilities available for a given role */
export function getAbilitiesForRole(abilities: AbilityDefinition[], role: Role): AbilityDefinition[] {
  return abilities.filter((a) => a.allowedRoles.includes(role));
}
