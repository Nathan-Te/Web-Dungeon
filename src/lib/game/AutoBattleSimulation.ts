import { Character } from './Character';
import { SeededRNG } from './rng';
import type { AbilityDefinition } from './abilities';
import {
  type CombatState,
  type CombatAction,
  type BattleResult,
  type Position,
  type Role,
  type SpriteSet,
  COMBAT_CONSTANTS,
  ROLE_BASE_STATS,
  ROLE_PREFERRED_ROW,
} from './types';

/** Summon template data passed into the simulation */
export interface SummonTemplate {
  id: string;
  name: string;
  role: Role;
  level: number;
  ascension: number;
  sprites?: SpriteSet;
  statOverrides?: {
    hpMult?: number;
    atkMult?: number;
    defMult?: number;
    spdMult?: number;
  };
}

/**
 * Auto-chess battle simulation engine
 * Deterministic combat using seeded RNG for reproducibility
 */
export class AutoBattleSimulation {
  private readonly rng: SeededRNG;
  private readonly seed: number;
  private playerUnits: Map<string, CombatState> = new Map();
  private enemyUnits: Map<string, CombatState> = new Map();
  private characterNames: Map<string, string> = new Map();
  private characterRoles: Map<string, Role> = new Map();
  private characterSprites: Map<string, SpriteSet | undefined> = new Map();
  private actionLog: CombatAction[] = [];
  private currentTurn: number = 0;

  /** Boss ability lists: characterId -> ability role keys */
  private bossAbilityRoles: Map<string, Role[]> = new Map();

  /** Summoner data: characterId -> { summonTemplates, maxSummons, activeSummonIds } */
  private summonerData: Map<string, {
    templates: SummonTemplate[];
    maxSummons: number;
    activeSummonIds: Set<string>;
  }> = new Map();

  /** Custom role base stats (overrides ROLE_BASE_STATS) */
  private customRoleStats?: Partial<Record<Role, { hp: number; atk: number; def: number; spd: number }>>;

  /** Ability definitions for cooldown lookup */
  private abilityDefs: AbilityDefinition[] = [];

  /** Cooldown tracker: characterId -> turns remaining until ability is available (0 = ready) */
  private cooldownTracker: Map<string, number> = new Map();

  /** Character ability ID mapping: characterId -> abilityId(s) */
  private characterAbilityIds: Map<string, string[]> = new Map();

  constructor(
    playerTeam: Character[],
    enemyTeam: Character[],
    seed: number,
    options?: {
      /** Boss ability role lists: characterId -> array of Role keys for ability selection */
      bossAbilities?: Map<string, Role[]>;
      /** Summoner configs: characterId -> { templates, maxSummons } */
      summonerConfigs?: Map<string, { templates: SummonTemplate[]; maxSummons: number }>;
      /** Custom role base stats */
      customRoleStats?: Partial<Record<Role, { hp: number; atk: number; def: number; spd: number }>>;
      /** Ability definitions (for cooldown lookup) */
      abilityDefs?: AbilityDefinition[];
      /** Character ability ID mapping: characterId -> abilityId(s) */
      characterAbilityIds?: Map<string, string[]>;
      /** HP overrides for player units (carry-over from previous rooms) */
      playerHpOverrides?: Map<string, { currentHp: number; maxHp: number }>;
    }
  ) {
    this.seed = seed;
    this.rng = new SeededRNG(seed);
    this.customRoleStats = options?.customRoleStats;
    this.abilityDefs = options?.abilityDefs ?? [];
    this.initializeTeams(playerTeam, enemyTeam);

    // Apply HP overrides for player units (dungeon carry-over)
    if (options?.playerHpOverrides) {
      for (const [charId, hp] of options.playerHpOverrides) {
        const unit = this.playerUnits.get(charId);
        if (unit) {
          unit.currentHp = hp.currentHp;
          unit.maxHp = hp.maxHp;
        }
      }
    }

    if (options?.bossAbilities) {
      this.bossAbilityRoles = options.bossAbilities;
    }
    if (options?.summonerConfigs) {
      for (const [id, cfg] of options.summonerConfigs) {
        this.summonerData.set(id, {
          templates: cfg.templates,
          maxSummons: cfg.maxSummons,
          activeSummonIds: new Set(),
        });
      }
    }
    if (options?.characterAbilityIds) {
      this.characterAbilityIds = options.characterAbilityIds;
    }
  }

  /** Check if a unit's ability is off cooldown */
  private isAbilityReady(characterId: string): boolean {
    const cd = this.cooldownTracker.get(characterId);
    return cd === undefined || cd <= 0;
  }

  /** Set cooldown after ability use, based on the character's ability definition */
  private setAbilityCooldown(characterId: string): void {
    const abilityIds = this.characterAbilityIds.get(characterId);
    if (!abilityIds || abilityIds.length === 0) return;
    // Use the max cooldown from any of the character's abilities
    let maxCd = 0;
    for (const aid of abilityIds) {
      const def = this.abilityDefs.find((a) => a.id === aid);
      if (def?.cooldown && def.cooldown > maxCd) maxCd = def.cooldown;
    }
    if (maxCd > 0) {
      this.cooldownTracker.set(characterId, maxCd);
    }
  }

  /** Attach ability sprites to the last action log entry for a character */
  private attachAbilitySprites(characterId: string): void {
    const last = this.actionLog[this.actionLog.length - 1];
    if (!last || !last.abilityUsed) return;

    // First try by explicit characterAbilityIds mapping
    const abilityIds = this.characterAbilityIds.get(characterId);
    if (abilityIds && abilityIds.length > 0) {
      for (const aid of abilityIds) {
        const def = this.abilityDefs.find((a) => a.id === aid);
        if (def && (def.casterSprite || def.targetSprite)) {
          if (def.casterSprite) last.abilityCasterSprite = def.casterSprite;
          if (def.targetSprite) last.abilityTargetSprite = def.targetSprite;
          return;
        }
      }
    }

    // Fallback: match by ability name (for built-in abilities like Taunt, Cleave, etc.)
    const abilityName = last.abilityUsed.toLowerCase();
    const def = this.abilityDefs.find((a) => a.name.toLowerCase() === abilityName);
    if (def) {
      if (def.casterSprite) last.abilityCasterSprite = def.casterSprite;
      if (def.targetSprite) last.abilityTargetSprite = def.targetSprite;
    }
  }

  /** Get base stats for a role (custom or default) */
  private getRoleBaseStats(role: Role) {
    return this.customRoleStats?.[role] ?? ROLE_BASE_STATS[role];
  }

  /**
   * Initialize combat states for both teams
   * Assigns positions based on role preferences
   */
  private initializeTeams(playerTeam: Character[], enemyTeam: Character[]): void {
    const assignPositions = (
      team: Character[],
      teamType: 'player' | 'enemy'
    ): void => {
      // Sort by preferred row for better positioning
      const sorted = [...team].sort(
        (a, b) => ROLE_PREFERRED_ROW[a.role] - ROLE_PREFERRED_ROW[b.role]
      );

      const usedPositions = new Set<string>();

      sorted.forEach((char, index) => {
        const preferredRow = char.preferredRow;
        let position: Position | null = null;

        // Try to place in preferred row first
        for (let col = 0; col <= 2 && !position; col++) {
          const posKey = `${preferredRow},${col}`;
          if (!usedPositions.has(posKey)) {
            position = { row: preferredRow, col: col as 0 | 1 | 2 };
            usedPositions.add(posKey);
          }
        }

        // If preferred row is full, find any available position
        if (!position) {
          for (let row = 0; row <= 2 && !position; row++) {
            for (let col = 0; col <= 2 && !position; col++) {
              const posKey = `${row},${col}`;
              if (!usedPositions.has(posKey)) {
                position = { row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 };
                usedPositions.add(posKey);
              }
            }
          }
        }

        if (position) {
          const state = char.createCombatState(teamType, position);
          const units = teamType === 'player' ? this.playerUnits : this.enemyUnits;
          units.set(char.id, state);
          this.characterNames.set(char.id, char.name);
          this.characterRoles.set(char.id, char.role);
          this.characterSprites.set(char.id, char.definition.sprites);
        }
      });
    };

    assignPositions(playerTeam, 'player');
    assignPositions(enemyTeam, 'enemy');
  }

  /**
   * Run the complete battle simulation
   */
  simulate(): BattleResult {
    while (this.currentTurn < COMBAT_CONSTANTS.MAX_TURNS) {
      this.currentTurn++;

      const battleContinues = this.executeTurn();
      if (!battleContinues) {
        break;
      }
    }

    return this.generateResult();
  }

  /**
   * Execute a single turn of combat
   * @returns false if battle should end
   */
  private executeTurn(): boolean {
    // Decrement cooldowns for all units at the start of each turn
    for (const [id, cd] of this.cooldownTracker) {
      if (cd > 0) this.cooldownTracker.set(id, cd - 1);
    }

    // Get all alive units sorted by SPD (initiative)
    const allUnits = this.getAllAliveUnits();

    if (allUnits.length === 0) return false;

    // Sort by SPD descending (faster units act first)
    // Tie-breaker: player units go first
    allUnits.sort((a, b) => {
      if (b.spd !== a.spd) return b.spd - a.spd;
      if (a.team !== b.team) return a.team === 'player' ? -1 : 1;
      return 0;
    });

    for (const unit of allUnits) {
      // Skip if unit died this turn
      if (!unit.isAlive) continue;

      // Check if battle is over
      if (this.isBattleOver()) return false;

      this.executeAction(unit);
    }

    return !this.isBattleOver();
  }

  /**
   * Execute action for a single unit
   */
  private executeAction(actor: CombatState): void {
    const role = this.characterRoles.get(actor.characterId)!;
    const actorName = this.characterNames.get(actor.characterId)!;

    const abilityReady = this.isAbilityReady(actor.characterId);

    // Summoners try to summon first
    if (role === 'summoner' && abilityReady) {
      const sumData = this.summonerData.get(actor.characterId);
      if (sumData && sumData.templates.length > 0) {
        // Remove dead summons from active set
        for (const sid of sumData.activeSummonIds) {
          const sUnit = this.playerUnits.get(sid) ?? this.enemyUnits.get(sid);
          if (!sUnit || !sUnit.isAlive) sumData.activeSummonIds.delete(sid);
        }
        if (sumData.activeSummonIds.size < sumData.maxSummons &&
            this.rng.chance(COMBAT_CONSTANTS.ABILITY_TRIGGER_CHANCE)) {
          this.executeSummon(actor, sumData, actorName);
          this.attachAbilitySprites(actor.characterId);
          this.setAbilityCooldown(actor.characterId);
          return;
        }
      }
    }

    // Healers try to heal first
    if (role === 'healer' && abilityReady) {
      const healTarget = this.findHealTarget(actor);
      if (healTarget && this.rng.chance(COMBAT_CONSTANTS.ABILITY_TRIGGER_CHANCE)) {
        this.executeHeal(actor, healTarget, actorName);
        this.attachAbilitySprites(actor.characterId);
        this.setAbilityCooldown(actor.characterId);
        return;
      }
    }

    // Find target based on role targeting rules
    const target = this.findTarget(actor, role);
    if (!target) return;

    // Check for ability trigger (only if not on cooldown)
    const useAbility = abilityReady && this.rng.chance(COMBAT_CONSTANTS.ABILITY_TRIGGER_CHANCE);

    if (useAbility) {
      // Boss: pick a random ability role from their list
      const bossRoles = this.bossAbilityRoles.get(actor.characterId);
      if (bossRoles && bossRoles.length > 0) {
        const abilityRole = bossRoles[this.rng.randomInt(0, bossRoles.length - 1)];
        this.executeAbility(actor, target, abilityRole, actorName);
      } else {
        this.executeAbility(actor, target, role, actorName);
      }
      this.setAbilityCooldown(actor.characterId);
    } else {
      this.executeBasicAttack(actor, target, actorName);
    }
  }

  /**
   * Execute a basic attack
   */
  private executeBasicAttack(
    actor: CombatState,
    target: CombatState,
    actorName: string
  ): void {
    const targetName = this.characterNames.get(target.characterId)!;
    const { damage, isCritical } = this.calculateDamage(actor.atk, target.def);

    target.currentHp = Math.max(0, target.currentHp - damage);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'attack',
      targetId: target.characterId,
      targetName,
      damage,
      isCritical,
      message: isCritical
        ? `${actorName} CRITICALLY hits ${targetName} for ${damage} damage!`
        : `${actorName} attacks ${targetName} for ${damage} damage`,
    });

    this.checkDeath(target);
  }

  /**
   * Execute a role-specific ability
   */
  private executeAbility(
    actor: CombatState,
    target: CombatState,
    role: Role,
    actorName: string
  ): void {
    const targetName = this.characterNames.get(target.characterId)!;

    switch (role) {
      case 'tank':
        this.executeTauntAttack(actor, target, actorName, targetName);
        break;
      case 'warrior':
        this.executeCleave(actor, actorName);
        break;
      case 'archer':
        this.executeMultishot(actor, actorName);
        break;
      case 'mage':
        this.executeFireball(actor, target, actorName, targetName);
        break;
      case 'assassin':
        this.executeBackstab(actor, target, actorName, targetName);
        break;
      case 'summoner':
      default:
        this.executeBasicAttack(actor, target, actorName);
    }
    this.attachAbilitySprites(actor.characterId);
  }

  private executeTauntAttack(
    actor: CombatState,
    target: CombatState,
    actorName: string,
    targetName: string
  ): void {
    const { damage, isCritical } = this.calculateDamage(actor.atk * 0.7, target.def);
    target.currentHp = Math.max(0, target.currentHp - damage);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'ability',
      targetId: target.characterId,
      targetName,
      damage,
      isCritical,
      abilityUsed: 'Taunt',
      message: `${actorName} uses Taunt on ${targetName} for ${damage} damage and draws attention!`,
    });

    this.checkDeath(target);
  }

  private executeCleave(actor: CombatState, actorName: string): void {
    const enemies = this.getEnemyUnits(actor.team);
    const targets = enemies.slice(0, 3); // Hit up to 3 enemies

    let totalDamage = 0;
    const hitTargets: string[] = [];
    const aoeTargets: { id: string; damage: number }[] = [];

    for (const target of targets) {
      const { damage } = this.calculateDamage(actor.atk * 0.6, target.def);
      target.currentHp = Math.max(0, target.currentHp - damage);
      totalDamage += damage;
      hitTargets.push(this.characterNames.get(target.characterId)!);
      aoeTargets.push({ id: target.characterId, damage });
      this.checkDeath(target);
    }

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'ability',
      damage: totalDamage,
      abilityUsed: 'Cleave',
      aoeTargets,
      message: `${actorName} uses Cleave hitting ${hitTargets.join(', ')} for ${totalDamage} total damage!`,
    });
  }

  private executeMultishot(actor: CombatState, actorName: string): void {
    const enemies = this.getEnemyUnits(actor.team);
    const targets = this.rng.shuffle([...enemies]).slice(0, 2); // Hit 2 random enemies

    let totalDamage = 0;
    const hitTargets: string[] = [];
    const aoeTargets: { id: string; damage: number }[] = [];

    for (const target of targets) {
      const { damage } = this.calculateDamage(actor.atk * 0.7, target.def);
      target.currentHp = Math.max(0, target.currentHp - damage);
      totalDamage += damage;
      hitTargets.push(this.characterNames.get(target.characterId)!);
      aoeTargets.push({ id: target.characterId, damage });
      this.checkDeath(target);
    }

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'ability',
      damage: totalDamage,
      abilityUsed: 'Multi-shot',
      aoeTargets,
      message: `${actorName} uses Multi-shot hitting ${hitTargets.join(', ')} for ${totalDamage} total damage!`,
    });
  }

  private executeFireball(
    actor: CombatState,
    target: CombatState,
    actorName: string,
    targetName: string
  ): void {
    // Fireball does 1.5x damage
    const { damage, isCritical } = this.calculateDamage(actor.atk * 1.5, target.def);
    target.currentHp = Math.max(0, target.currentHp - damage);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'ability',
      targetId: target.characterId,
      targetName,
      damage,
      isCritical,
      abilityUsed: 'Fireball',
      message: `${actorName} hurls a Fireball at ${targetName} for ${damage} damage!`,
    });

    this.checkDeath(target);
  }

  private executeBackstab(
    actor: CombatState,
    target: CombatState,
    actorName: string,
    targetName: string
  ): void {
    // Backstab ignores defense (def = 0)
    const { damage, isCritical } = this.calculateDamage(actor.atk, 0);
    target.currentHp = Math.max(0, target.currentHp - damage);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'ability',
      targetId: target.characterId,
      targetName,
      damage,
      isCritical,
      abilityUsed: 'Backstab',
      message: `${actorName} Backstabs ${targetName} for ${damage} damage, ignoring armor!`,
    });

    this.checkDeath(target);
  }

  /**
   * Execute heal ability
   */
  private executeHeal(
    actor: CombatState,
    target: CombatState,
    actorName: string
  ): void {
    const targetName = this.characterNames.get(target.characterId)!;
    // Heal amount is based on healer's ATK stat
    const baseHeal = actor.atk * 2;
    const variance = this.rng.randomFloat(0.9, 1.1);
    const healAmount = Math.floor(baseHeal * variance);

    const actualHeal = Math.min(healAmount, target.maxHp - target.currentHp);
    target.currentHp = Math.min(target.maxHp, target.currentHp + healAmount);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'heal',
      targetId: target.characterId,
      targetName,
      healing: actualHeal,
      abilityUsed: 'Heal',
      message: `${actorName} heals ${targetName} for ${actualHeal} HP`,
    });
  }

  /**
   * Execute summon ability — creates a new unit on the battlefield
   */
  private executeSummon(
    actor: CombatState,
    sumData: { templates: SummonTemplate[]; maxSummons: number; activeSummonIds: Set<string> },
    actorName: string
  ): void {
    const template = sumData.templates[this.rng.randomInt(0, sumData.templates.length - 1)];
    const summonId = `${template.id}_s${Date.now().toString(36)}_${this.rng.randomInt(0, 9999)}`;

    // Find an empty position on the summoner's side
    const position = this.findEmptyPosition(actor.team);
    if (!position) return; // No space to summon

    // Calculate stats from template
    const calcStat = (base: number, mult: number = 1) => {
      const levelMult = 1 + (template.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
      const ascMult = 1 + template.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
      return Math.floor(base * levelMult * ascMult * mult);
    };
    const baseStats = this.getRoleBaseStats(template.role);
    const ov = template.statOverrides;
    const hp = calcStat(baseStats.hp, ov?.hpMult);
    const atk = calcStat(baseStats.atk, ov?.atkMult);
    const def = calcStat(baseStats.def, ov?.defMult);
    const spd = Math.floor(baseStats.spd * (ov?.spdMult ?? 1));

    const state: CombatState = {
      characterId: summonId,
      currentHp: hp,
      maxHp: hp,
      atk,
      def,
      spd,
      position,
      team: actor.team,
      isAlive: true,
      level: template.level,
      ascension: template.ascension,
      isSummoned: true,
    };

    const units = actor.team === 'player' ? this.playerUnits : this.enemyUnits;
    units.set(summonId, state);
    this.characterNames.set(summonId, template.name);
    this.characterRoles.set(summonId, template.role);
    this.characterSprites.set(summonId, template.sprites);
    sumData.activeSummonIds.add(summonId);

    this.actionLog.push({
      turn: this.currentTurn,
      actorId: actor.characterId,
      actorName,
      actionType: 'summon',
      abilityUsed: 'Summon',
      message: `${actorName} summons ${template.name}!`,
      summonedUnit: {
        id: summonId,
        name: template.name,
        role: template.role,
        hp,
        atk,
        def,
        spd,
        position,
        team: actor.team,
        sprites: template.sprites,
      },
    });
  }

  /**
   * Find an empty position on a team's side of the battlefield
   */
  private findEmptyPosition(team: 'player' | 'enemy'): Position | null {
    const units = team === 'player' ? this.playerUnits : this.enemyUnits;
    const occupied = new Set<string>();
    for (const u of units.values()) {
      if (u.isAlive) occupied.add(`${u.position.row},${u.position.col}`);
    }
    // Try rows 0-3, cols 0-2
    for (let row = 0; row <= 3; row++) {
      for (let col = 0; col <= 2; col++) {
        if (!occupied.has(`${row},${col}`)) {
          return { row: row as 0 | 1 | 2 | 3, col: col as 0 | 1 | 2 };
        }
      }
    }
    return null;
  }

  /**
   * Calculate damage with formula: ATK * (1 - DEF/(DEF+100)) with ±10% variance
   */
  private calculateDamage(
    atk: number,
    def: number
  ): { damage: number; isCritical: boolean } {
    // Defense reduction formula
    const defReduction = def / (def + 100);
    const baseDamage = atk * (1 - defReduction);

    // Apply variance ±10%
    const variance = this.rng.randomFloat(
      1 - COMBAT_CONSTANTS.DAMAGE_VARIANCE,
      1 + COMBAT_CONSTANTS.DAMAGE_VARIANCE
    );

    let damage = Math.floor(baseDamage * variance);

    // Check for critical hit
    const isCritical = this.rng.chance(COMBAT_CONSTANTS.CRIT_CHANCE);
    if (isCritical) {
      damage = Math.floor(damage * COMBAT_CONSTANTS.CRIT_MULTIPLIER);
    }

    return { damage: Math.max(1, damage), isCritical };
  }

  /**
   * Find target based on role targeting rules
   */
  private findTarget(actor: CombatState, role: Role): CombatState | null {
    const enemies = this.getEnemyUnits(actor.team);
    if (enemies.length === 0) return null;

    switch (role) {
      case 'tank':
      case 'warrior':
        // Target closest enemy (front row first)
        return this.findClosestEnemy(enemies);
      case 'assassin':
        // Target back row (squishy targets)
        return this.findBackRowEnemy(enemies);
      case 'archer':
      case 'mage':
        // Target lowest HP enemy
        return this.findLowestHpEnemy(enemies);
      case 'healer':
      case 'summoner':
        // Healers/summoners target enemies if not using ability
        return this.findLowestHpEnemy(enemies);
      default:
        return enemies[0];
    }
  }

  private findClosestEnemy(enemies: CombatState[]): CombatState {
    // Sort by row (front first), then by HP (focus damaged)
    return enemies.sort((a, b) => {
      if (a.position.row !== b.position.row) {
        return a.position.row - b.position.row;
      }
      return a.currentHp - b.currentHp;
    })[0];
  }

  private findBackRowEnemy(enemies: CombatState[]): CombatState {
    // Sort by row descending (back first), then by HP (focus low HP)
    return enemies.sort((a, b) => {
      if (a.position.row !== b.position.row) {
        return b.position.row - a.position.row;
      }
      return a.currentHp - b.currentHp;
    })[0];
  }

  private findLowestHpEnemy(enemies: CombatState[]): CombatState {
    return enemies.sort((a, b) => a.currentHp - b.currentHp)[0];
  }

  /**
   * Find ally that needs healing (below 70% HP)
   */
  private findHealTarget(actor: CombatState): CombatState | null {
    const allies = this.getAllyUnits(actor.team).filter(
      (u) => u.currentHp < u.maxHp * 0.7
    );
    if (allies.length === 0) return null;
    // Heal lowest HP ally
    return allies.sort((a, b) => a.currentHp / a.maxHp - b.currentHp / b.maxHp)[0];
  }

  private getEnemyUnits(myTeam: 'player' | 'enemy'): CombatState[] {
    const units = myTeam === 'player' ? this.enemyUnits : this.playerUnits;
    return Array.from(units.values()).filter((u) => u.isAlive);
  }

  private getAllyUnits(myTeam: 'player' | 'enemy'): CombatState[] {
    const units = myTeam === 'player' ? this.playerUnits : this.enemyUnits;
    return Array.from(units.values()).filter((u) => u.isAlive);
  }

  private getAllAliveUnits(): CombatState[] {
    return [
      ...Array.from(this.playerUnits.values()),
      ...Array.from(this.enemyUnits.values()),
    ].filter((u) => u.isAlive);
  }

  /**
   * Check if unit died and log death
   */
  private checkDeath(unit: CombatState): void {
    if (unit.currentHp <= 0 && unit.isAlive) {
      unit.isAlive = false;
      const name = this.characterNames.get(unit.characterId)!;

      this.actionLog.push({
        turn: this.currentTurn,
        actorId: unit.characterId,
        actorName: name,
        actionType: 'death',
        message: `${name} has been defeated!`,
      });
    }
  }

  /**
   * Check if battle should end
   */
  private isBattleOver(): boolean {
    const playerAlive = Array.from(this.playerUnits.values()).some(
      (u) => u.isAlive
    );
    const enemyAlive = Array.from(this.enemyUnits.values()).some(
      (u) => u.isAlive
    );
    return !playerAlive || !enemyAlive;
  }

  /**
   * Generate final battle result
   */
  private generateResult(): BattleResult {
    const playerSurvivors = Array.from(this.playerUnits.values())
      .filter((u) => u.isAlive)
      .map((u) => this.characterNames.get(u.characterId)!);

    const enemySurvivors = Array.from(this.enemyUnits.values())
      .filter((u) => u.isAlive)
      .map((u) => this.characterNames.get(u.characterId)!);

    let winner: 'player' | 'enemy' | 'draw';
    if (playerSurvivors.length > 0 && enemySurvivors.length === 0) {
      winner = 'player';
    } else if (enemySurvivors.length > 0 && playerSurvivors.length === 0) {
      winner = 'enemy';
    } else {
      winner = 'draw';
    }

    return {
      winner,
      turns: this.currentTurn,
      actionLog: this.actionLog,
      playerSurvivors,
      enemySurvivors,
      seed: this.seed,
    };
  }
}
