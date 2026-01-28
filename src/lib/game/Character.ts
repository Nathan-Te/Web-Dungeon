import {
  type CharacterDefinition,
  type CombatState,
  type Position,
  type Role,
  type Rarity,
  ROLE_BASE_STATS,
  ROLE_PREFERRED_ROW,
  COMBAT_CONSTANTS,
} from './types';

/**
 * Character class representing a unit in combat
 * Handles stat calculations based on level and ascension
 */
export class Character {
  readonly definition: CharacterDefinition;
  readonly level: number;
  readonly ascension: number;

  constructor(
    definition: CharacterDefinition,
    level: number = 1,
    ascension: number = 0
  ) {
    this.definition = definition;
    this.level = Math.max(1, Math.min(100, level));
    this.ascension = Math.max(0, Math.min(COMBAT_CONSTANTS.MAX_ASCENSION, ascension));
  }

  get id(): string {
    return this.definition.id;
  }

  get name(): string {
    return this.definition.name;
  }

  get role(): Role {
    return this.definition.role;
  }

  get rarity(): Rarity {
    return this.definition.rarity;
  }

  get preferredRow(): 0 | 1 | 2 {
    return ROLE_PREFERRED_ROW[this.role];
  }

  /** Base stats for this character's role */
  private get baseStats() {
    return ROLE_BASE_STATS[this.role];
  }

  /**
   * Calculate stat with level and ascension scaling
   * Formula: baseStat * (1 + (level-1) * 0.1) * (1 + ascension * 0.15)
   */
  private calculateStat(baseStat: number): number {
    const levelMultiplier = 1 + (this.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascensionMultiplier = 1 + this.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    return Math.floor(baseStat * levelMultiplier * ascensionMultiplier);
  }

  /** Calculated HP (scales with level and ascension) */
  get hp(): number {
    return this.calculateStat(this.baseStats.hp);
  }

  /** Calculated ATK (scales with level and ascension) */
  get atk(): number {
    return this.calculateStat(this.baseStats.atk);
  }

  /** Calculated DEF (scales with level and ascension) */
  get def(): number {
    return this.calculateStat(this.baseStats.def);
  }

  /** SPD does not scale - remains constant */
  get spd(): number {
    return this.baseStats.spd;
  }

  /**
   * Create combat state for battle simulation
   */
  createCombatState(team: 'player' | 'enemy', position: Position): CombatState {
    return {
      characterId: this.id,
      currentHp: this.hp,
      maxHp: this.hp,
      atk: this.atk,
      def: this.def,
      spd: this.spd,
      position,
      team,
      isAlive: true,
      level: this.level,
      ascension: this.ascension,
    };
  }

  /**
   * Get display string for debugging
   */
  toString(): string {
    return `${this.name} (${this.role}, Lv${this.level}, A${this.ascension}) - HP:${this.hp} ATK:${this.atk} DEF:${this.def} SPD:${this.spd}`;
  }
}

/**
 * Factory function to create a character from definition
 */
export function createCharacter(
  definition: CharacterDefinition,
  level: number = 1,
  ascension: number = 0
): Character {
  return new Character(definition, level, ascension);
}
