<script lang="ts">
  import type { CharacterDefinition, Rarity, Role } from '../game/types';
  import type { GachaConfig } from './adminTypes';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    characters: CharacterDefinition[];
    gachaConfig?: GachaConfig;
    onSave: (config: GachaConfig) => void;
  }

  let { characters, gachaConfig, onSave }: Props = $props();

  const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'text-gray-300',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  const DEFAULT_CONFIG: GachaConfig = {
    characterPool: [],
    rates: { common: 0.74, rare: 0.20, epic: 0.05, legendary: 0.01 },
    ascensionCosts: [1, 2, 3, 4, 5, 6],
  };

  let config: GachaConfig = $state(
    gachaConfig
      ? { ...gachaConfig, characterPool: [...gachaConfig.characterPool], rates: { ...gachaConfig.rates }, ascensionCosts: [...gachaConfig.ascensionCosts] }
      : { ...DEFAULT_CONFIG, characterPool: [], rates: { ...DEFAULT_CONFIG.rates }, ascensionCosts: [...DEFAULT_CONFIG.ascensionCosts] }
  );

  function isInPool(charId: string): boolean {
    return config.characterPool.includes(charId);
  }

  function toggleCharacter(charId: string) {
    if (isInPool(charId)) {
      config = { ...config, characterPool: config.characterPool.filter((id) => id !== charId) };
    } else {
      config = { ...config, characterPool: [...config.characterPool, charId] };
    }
  }

  function addAllCharacters() {
    config = { ...config, characterPool: characters.map((c) => c.id) };
  }

  function clearPool() {
    config = { ...config, characterPool: [] };
  }

  function updateRate(rarity: Rarity, value: number) {
    config = { ...config, rates: { ...config.rates, [rarity]: value } };
  }

  let rateSum = $derived(
    RARITIES.reduce((sum, r) => sum + (config.rates[r] ?? 0), 0)
  );

  function updateAscensionCost(index: number, value: number) {
    const costs = [...config.ascensionCosts];
    costs[index] = value;
    config = { ...config, ascensionCosts: costs };
  }

  function addAscensionLevel() {
    config = { ...config, ascensionCosts: [...config.ascensionCosts, config.ascensionCosts.length + 1] };
  }

  function removeLastAscensionLevel() {
    if (config.ascensionCosts.length <= 1) return;
    config = { ...config, ascensionCosts: config.ascensionCosts.slice(0, -1) };
  }

  function handleSave() {
    onSave(config);
  }

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'bg-blue-900', warrior: 'bg-orange-900', archer: 'bg-green-900',
    mage: 'bg-purple-900', assassin: 'bg-gray-800', healer: 'bg-emerald-900',
    summoner: 'bg-teal-900',
  };

  function getCharsByRarity(rarity: Rarity): CharacterDefinition[] {
    return characters.filter((c) => c.rarity === rarity);
  }
</script>

<div class="space-y-6">
  <!-- Gacha Rates -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-yellow-400">Gacha Pull Rates</h3>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {#each RARITIES as rarity}
        <div>
          <span class="block text-xs mb-1 capitalize {RARITY_COLORS[rarity]}">{rarity}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={config.rates[rarity]}
            oninput={(e) => updateRate(rarity, parseFloat(e.currentTarget.value) || 0)}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      {/each}
    </div>
    <div class="mt-2 text-xs {Math.abs(rateSum - 1) < 0.001 ? 'text-green-400' : 'text-red-400'}">
      Total: {rateSum.toFixed(4)} {Math.abs(rateSum - 1) < 0.001 ? '(valid)' : '(must equal 1.0)'}
    </div>
  </div>

  <!-- Ascension Costs -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-cyan-400">Ascension Costs (duplicates needed)</h3>
    <div class="flex gap-2 flex-wrap mb-3">
      {#each config.ascensionCosts as cost, i}
        <div class="text-center">
          <span class="block text-[10px] text-gray-500 mb-0.5">Asc {i}→{i + 1}</span>
          <input
            type="number"
            min="1"
            max="99"
            value={cost}
            oninput={(e) => updateAscensionCost(i, parseInt(e.currentTarget.value) || 1)}
            class="w-14 px-2 py-1 bg-slate-700 rounded text-sm text-center"
          />
        </div>
      {/each}
    </div>
    <div class="flex gap-2">
      <button
        onclick={addAscensionLevel}
        class="px-3 py-1 bg-cyan-800 hover:bg-cyan-700 rounded text-xs"
      >
        + Level
      </button>
      <button
        onclick={removeLastAscensionLevel}
        disabled={config.ascensionCosts.length <= 1}
        class="px-3 py-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 rounded text-xs"
      >
        - Level
      </button>
    </div>
  </div>

  <!-- Character Pool -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-green-400">
      Gacha Character Pool ({config.characterPool.length}/{characters.length})
    </h3>
    <div class="flex gap-2 mb-3">
      <button onclick={addAllCharacters} class="px-3 py-1 bg-green-800 hover:bg-green-700 rounded text-xs">
        Add All
      </button>
      <button onclick={clearPool} class="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs">
        Clear All
      </button>
    </div>

    {#each RARITIES as rarity}
      {@const chars = getCharsByRarity(rarity)}
      {#if chars.length > 0}
        <div class="mb-3">
          <span class="text-xs font-bold capitalize {RARITY_COLORS[rarity]}">{rarity}</span>
          <div class="flex gap-2 flex-wrap mt-1">
            {#each chars as char}
              <button
                onclick={() => toggleCharacter(char.id)}
                class="w-16 h-20 rounded-lg border-2 flex flex-col items-center overflow-hidden transition-all
                  {isInPool(char.id)
                    ? 'border-green-400 ring-1 ring-green-400'
                    : 'border-slate-600 hover:border-slate-400 opacity-50'}
                  {ROLE_COLORS[char.role]}"
              >
                <SpritePreview sprites={char.sprites} fallback={ROLE_ICONS[char.role]} class="w-12 h-12 mt-0.5" />
                <span class="text-[8px] font-medium truncate w-full text-center px-0.5">{char.name}</span>
                <span class="text-[7px] capitalize text-gray-400">{char.role}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Save Button -->
  <button
    onclick={handleSave}
    disabled={Math.abs(rateSum - 1) >= 0.001}
    class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-bold"
  >
    Save Gacha Config
  </button>
</div>
