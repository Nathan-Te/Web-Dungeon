<script lang="ts">
  import {
    type ExpeditionConfig,
    type ExpeditionDuration,
    createDefaultExpeditionConfig,
  } from './adminTypes';

  interface Props {
    expeditionConfig?: ExpeditionConfig;
    onSave: (config: ExpeditionConfig) => void;
  }

  let { expeditionConfig, onSave }: Props = $props();

  let config: ExpeditionConfig = $state(
    expeditionConfig ? structuredClone(expeditionConfig) : createDefaultExpeditionConfig()
  );

  const durations: ExpeditionDuration[] = [4, 8, 12, 24];

  function handleSave() {
    onSave(structuredClone(config));
  }

  function handleReset() {
    config = createDefaultExpeditionConfig();
    onSave(structuredClone(config));
  }

  // Sync when prop changes
  $effect(() => {
    if (expeditionConfig) {
      config = structuredClone(expeditionConfig);
    }
  });
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold">Expedition Config</h2>
    <div class="flex gap-2">
      <button
        onclick={handleReset}
        class="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300"
      >
        Reset Defaults
      </button>
      <button
        onclick={handleSave}
        class="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-bold"
      >
        Save
      </button>
    </div>
  </div>

  <!-- General Settings -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3">General</h3>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <label class="block">
        <span class="text-xs text-gray-400">Max Team Size</span>
        <input
          type="number"
          min="1"
          max="5"
          bind:value={config.maxTeamSize}
          class="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-400">Base XP / Wave</span>
        <input
          type="number"
          min="1"
          bind:value={config.baseXpPerWave}
          class="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-400">Base Gacha Chance</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          bind:value={config.baseGachaChance}
          class="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-400">Max Gacha Chance</span>
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          bind:value={config.maxGachaChance}
          class="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
        />
      </label>
      <label class="block">
        <span class="text-xs text-gray-400">Power Ratio Bonus</span>
        <input
          type="number"
          min="0"
          step="0.1"
          bind:value={config.powerRatioGachaBonus}
          class="mt-1 w-full px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
        />
      </label>
    </div>
  </div>

  <!-- Duration Tiers -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3">Duration Tiers</h3>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-gray-400 text-xs">
            <th class="text-left px-2 py-1">Duration</th>
            <th class="text-left px-2 py-1">Waves</th>
            <th class="text-left px-2 py-1">Enemy Power Mult</th>
            <th class="text-left px-2 py-1">XP Multiplier</th>
            <th class="text-left px-2 py-1">Required Power</th>
            <th class="text-left px-2 py-1">Gacha Chance Mult</th>
          </tr>
        </thead>
        <tbody>
          {#each durations as dur}
            <tr class="border-t border-slate-700">
              <td class="px-2 py-2 font-bold text-amber-400">{dur}h</td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  min="1"
                  bind:value={config.durationTiers[dur].totalWaves}
                  class="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  bind:value={config.durationTiers[dur].enemyPowerMult}
                  class="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  bind:value={config.durationTiers[dur].xpMultiplier}
                  class="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  min="1"
                  bind:value={config.durationTiers[dur].requiredPower}
                  class="w-24 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </td>
              <td class="px-2 py-2">
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  bind:value={config.gachaChanceMultiplier[dur]}
                  class="w-20 px-2 py-1 bg-slate-900 border border-slate-600 rounded text-sm"
                />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>

  <!-- Formula explanation -->
  <div class="bg-slate-800 rounded-lg p-4 text-sm text-gray-400">
    <h3 class="font-bold mb-2 text-gray-300">Formulas</h3>
    <ul class="space-y-1 list-disc list-inside">
      <li><strong class="text-gray-300">Team Power</strong> = sum(hp + atk*4 + def*2 + spd) per unit</li>
      <li><strong class="text-gray-300">Wave Pass Chance</strong> = min(0.99, (powerRatio / waveDifficulty) * 0.9)</li>
      <li><strong class="text-gray-300">Wave Difficulty</strong> = 1.0 to 1.5 (scales over expedition)</li>
      <li><strong class="text-gray-300">XP</strong> = baseXpPerWave * xpMult * wavesCleared</li>
      <li><strong class="text-gray-300">Gacha %</strong> = baseChance * durationMult + powerBonus + clearBonus (capped at maxGachaChance)</li>
    </ul>
  </div>
</div>
