/**
 * Game module exports
 */

// RNG
export { mulberry32, SeededRNG } from './rng';

// Types and constants
export * from './types';

// Character
export { Character, createCharacter } from './Character';

// Battle simulation
export { AutoBattleSimulation, type SummonTemplate } from './AutoBattleSimulation';

// Character data
export {
  CHARACTER_DEFINITIONS,
  getCharacterById,
  getCharactersByRarity,
  getCharactersByRole,
} from './characters';

// Abilities
export {
  DEFAULT_ABILITIES,
  getAbilityById,
  getAbilitiesForRole,
  type AbilityDefinition,
  type AbilityTargeting,
} from './abilities';
