/**
 * Expedition simulation logic
 * Resolves an expedition into rewards based on team power vs required power.
 * Uses seeded RNG for deterministic results.
 */

import type { Role } from './types';
import type { ExpeditionConfig, ExpeditionDuration } from '../admin/adminTypes';
import type { ActiveExpedition, ExpeditionResult } from '../player/playerStore';
import { SeededRNG } from './rng';

/**
 * Role-specific stat weights for power calculation.
 *
 * Each role contributes to team power differently based on its combat function:
 * - Tanks: valued for survivability (HP, DEF) — they absorb damage for the team
 * - Warriors: balanced front-liners — good ATK and solid DEF
 * - Archers: ranged damage dealers — high ATK value, fast
 * - Mages: burst casters — highest ATK weight, glass cannon
 * - Assassins: speed-burst killers — fast strikes, high SPD value
 * - Healers: sustain providers — their ATK scales healing, team lifeline
 * - Summoners: force multipliers — ATK scales summons, add extra bodies
 *
 * Weights are tuned so that all roles at level 1 produce ~similar power (~1000-1150).
 */
const ROLE_POWER_WEIGHTS: Record<Role, { hp: number; atk: number; def: number; spd: number }> = {
  tank:     { hp: 0.5, atk: 2.0, def: 2.5, spd: 2.0 },
  warrior:  { hp: 0.8, atk: 3.0, def: 1.5, spd: 1.5 },
  archer:   { hp: 0.5, atk: 3.5, def: 1.0, spd: 2.5 },
  mage:     { hp: 0.5, atk: 3.5, def: 1.0, spd: 2.0 },
  assassin: { hp: 0.5, atk: 3.0, def: 1.0, spd: 2.5 },
  healer:   { hp: 1.0, atk: 4.0, def: 1.5, spd: 2.0 },
  summoner: { hp: 0.8, atk: 3.5, def: 1.0, spd: 2.5 },
};

/** Default weights used when no role is provided (backward-compatible) */
const DEFAULT_POWER_WEIGHTS = { hp: 0.6, atk: 3.0, def: 1.5, spd: 2.0 };

/**
 * Calculate power contribution of a single character based on its role.
 */
export function calculateCharacterPower(
  stats: { hp: number; atk: number; def: number; spd: number },
  role?: Role,
): number {
  const w = role ? ROLE_POWER_WEIGHTS[role] : DEFAULT_POWER_WEIGHTS;
  return Math.round(stats.hp * w.hp + stats.atk * w.atk + stats.def * w.def + stats.spd * w.spd);
}

/**
 * Calculate team power from character stats.
 * Uses role-aware weights when role is provided, otherwise falls back to default weights.
 */
export function calculateTeamPower(
  stats: { hp: number; atk: number; def: number; spd: number; role?: Role }[]
): number {
  return stats.reduce((sum, s) => sum + calculateCharacterPower(s, s.role), 0);
}

/**
 * Resolve an expedition that has completed.
 * Determines waves cleared, XP earned, and gacha chance.
 */
export function resolveExpedition(
  expedition: ActiveExpedition,
  config: ExpeditionConfig,
): ExpeditionResult {
  const tier = config.durationTiers[expedition.duration];
  const rng = new SeededRNG(expedition.startedAt);

  // Power ratio determines how many waves the team clears
  const powerRatio = expedition.teamPower / Math.max(1, tier.requiredPower);

  // Wave clearing: each wave has a pass chance based on power ratio
  // At ratio 1.0 → ~90% per wave, ratio 0.5 → ~50%, ratio 2.0 → ~99%
  let wavesCleared = 0;
  for (let w = 0; w < tier.totalWaves; w++) {
    // Progressive difficulty: later waves are harder
    const waveProgress = (w + 1) / tier.totalWaves;
    const waveDifficulty = 1 + waveProgress * 0.5; // 1.0 → 1.5 over the expedition
    const adjustedRatio = powerRatio / waveDifficulty;
    const passChance = Math.min(0.99, adjustedRatio * 0.9);

    if (rng.chance(passChance)) {
      wavesCleared++;
    } else {
      // Team failed — stop here (keeps accumulated rewards)
      break;
    }
  }

  const fullClear = wavesCleared === tier.totalWaves;

  // XP: baseXpPerWave * xpMultiplier * wavesCleared
  const xpEarned = Math.floor(
    config.baseXpPerWave * tier.xpMultiplier * wavesCleared
  );

  // Gacha chance calculation
  const durationMult = config.gachaChanceMultiplier[expedition.duration];
  const powerBonus = Math.min(powerRatio, 2.0) * config.powerRatioGachaBonus;
  const clearBonus = fullClear ? 0.1 : (wavesCleared / tier.totalWaves) * 0.05;
  let gachaChance = config.baseGachaChance * durationMult + powerBonus * config.baseGachaChance + clearBonus;
  gachaChance = Math.min(gachaChance, config.maxGachaChance);
  gachaChance = Math.max(0, gachaChance);

  const gachaPullWon = rng.chance(gachaChance);

  return {
    wavesCleared,
    totalWaves: tier.totalWaves,
    fullClear,
    xpEarned,
    gachaPullWon,
    gachaChance,
  };
}

/**
 * Preview expected rewards for an expedition (before starting).
 * Returns estimated values without RNG.
 */
export function previewExpedition(
  teamPower: number,
  duration: ExpeditionDuration,
  config: ExpeditionConfig,
): { estimatedWaves: number; totalWaves: number; estimatedXp: number; gachaChance: number; clearChance: number } {
  const tier = config.durationTiers[duration];
  const powerRatio = teamPower / Math.max(1, tier.requiredPower);

  // Estimate average waves cleared
  let expectedWaves = 0;
  let survivalProb = 1.0;
  for (let w = 0; w < tier.totalWaves; w++) {
    const waveProgress = (w + 1) / tier.totalWaves;
    const waveDifficulty = 1 + waveProgress * 0.5;
    const adjustedRatio = powerRatio / waveDifficulty;
    const passChance = Math.min(0.99, adjustedRatio * 0.9);
    survivalProb *= passChance;
    expectedWaves += survivalProb;
  }

  const estimatedWaves = Math.round(expectedWaves);
  const clearChance = survivalProb;
  const estimatedXp = Math.floor(config.baseXpPerWave * tier.xpMultiplier * estimatedWaves);

  // Gacha chance (same formula as resolveExpedition, using expected clear rate)
  const durationMult = config.gachaChanceMultiplier[duration];
  const powerBonus = Math.min(powerRatio, 2.0) * config.powerRatioGachaBonus;
  const clearBonus = clearChance > 0.5 ? 0.1 : (estimatedWaves / tier.totalWaves) * 0.05;
  let gachaChance = config.baseGachaChance * durationMult + powerBonus * config.baseGachaChance + clearBonus;
  gachaChance = Math.min(gachaChance, config.maxGachaChance);
  gachaChance = Math.max(0, gachaChance);

  return { estimatedWaves, totalWaves: tier.totalWaves, estimatedXp, gachaChance, clearChance };
}
