/**
 * Expedition simulation logic
 * Resolves an expedition into rewards based on team power vs required power.
 * Uses seeded RNG for deterministic results.
 */

import type { ExpeditionConfig, ExpeditionDuration } from '../admin/adminTypes';
import type { ActiveExpedition, ExpeditionResult } from '../player/playerStore';
import { SeededRNG } from './rng';

/**
 * Calculate team power from character stats.
 * Power = sum of (hp + atk*4 + def*2 + spd) for each unit.
 */
export function calculateTeamPower(
  stats: { hp: number; atk: number; def: number; spd: number }[]
): number {
  return stats.reduce((sum, s) => sum + s.hp + s.atk * 4 + s.def * 2 + s.spd, 0);
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
