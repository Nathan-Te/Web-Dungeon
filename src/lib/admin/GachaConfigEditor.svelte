<script lang="ts">
  import type { CharacterDefinition, Rarity, Role } from '../game/types';
  import type { GachaConfig, PityRule } from './adminTypes';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    characters: CharacterDefinition[];
    gachaConfig?: GachaConfig;
    levelThresholds?: number[];
    rarityMultipliers?: Record<Rarity, number>;
    onSave: (config: GachaConfig) => void;
    onSaveLevelThresholds: (thresholds: number[]) => void;
    onSaveRarityMultipliers: (multipliers: Record<Rarity, number>) => void;
  }

  let { characters, gachaConfig, levelThresholds, rarityMultipliers, onSave, onSaveLevelThresholds, onSaveRarityMultipliers }: Props = $props();

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

  // Pity rules
  let pityRules: PityRule[] = $state(
    config.pityRules ? config.pityRules.map(r => ({ ...r })) : []
  );

  function addPityRule() {
    pityRules = [...pityRules, { rarity: 'legendary', pullsRequired: 90 }];
  }

  function removePityRule(index: number) {
    pityRules = pityRules.filter((_, i) => i !== index);
  }

  function updatePityRarity(index: number, rarity: Rarity) {
    pityRules = pityRules.map((r, i) => i === index ? { ...r, rarity } : r);
  }

  function updatePityPulls(index: number, pulls: number) {
    pityRules = pityRules.map((r, i) => i === index ? { ...r, pullsRequired: pulls } : r);
  }

  // Daily / Initial pulls
  let dailyPulls: number = $state(config.dailyPulls ?? 1);
  let initialBonusPulls: number = $state(config.initialBonusPulls ?? 3);

  function handleSave() {
    onSave({
      ...config,
      pityRules: pityRules.length > 0 ? pityRules : undefined,
      dailyPulls,
      initialBonusPulls,
    });
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

  // Level thresholds — simplified: define max level, base XP, XP increment
  function reverseEngineer(arr: number[]): { maxLevel: number; baseXp: number; xpIncrement: number } {
    if (arr.length < 2) return { maxLevel: arr.length + 1, baseXp: arr[0] ?? 10, xpIncrement: 0 };
    return { maxLevel: arr.length + 1, baseXp: arr[0], xpIncrement: arr[1] - arr[0] };
  }

  const DEFAULT_BASE_XP = 10;
  const DEFAULT_XP_INCREMENT = 15;
  const DEFAULT_MAX_LEVEL = 21;

  let initParams = levelThresholds && levelThresholds.length > 0
    ? reverseEngineer(levelThresholds)
    : { maxLevel: DEFAULT_MAX_LEVEL, baseXp: DEFAULT_BASE_XP, xpIncrement: DEFAULT_XP_INCREMENT };

  let maxLevel: number = $state(initParams.maxLevel);
  let baseXp: number = $state(initParams.baseXp);
  let xpIncrement: number = $state(initParams.xpIncrement);

  let generatedThresholds = $derived(
    Array.from({ length: maxLevel - 1 }, (_, i) => baseXp + i * xpIncrement)
  );

  function handleSaveThresholds() {
    onSaveLevelThresholds(generatedThresholds);
  }

  // Rarity stat multipliers
  const DEFAULT_RARITY_MULTS: Record<Rarity, number> = { common: 1.0, rare: 1.15, epic: 1.3, legendary: 1.5 };
  let rarityMults: Record<Rarity, number> = $state(
    rarityMultipliers ? { ...rarityMultipliers } : { ...DEFAULT_RARITY_MULTS }
  );

  function updateRarityMult(rarity: Rarity, value: number) {
    rarityMults = { ...rarityMults, [rarity]: value };
  }

  function handleSaveRarityMults() {
    onSaveRarityMultipliers(rarityMults);
  }

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

  <!-- Daily & Initial Pulls -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-green-400">Tirages Gacha</h3>
    <div class="grid grid-cols-2 gap-4">
      <div>
        <span class="block text-xs text-gray-400 mb-1">Tirages par jour</span>
        <input
          type="number"
          min="1"
          max="99"
          bind:value={dailyPulls}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
      <div>
        <span class="block text-xs text-gray-400 mb-1">Tirages bonus (nouveau joueur)</span>
        <input
          type="number"
          min="0"
          max="99"
          bind:value={initialBonusPulls}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
    </div>
    <p class="text-xs text-gray-500 mt-2">
      Nouveau joueur = {dailyPulls} + {initialBonusPulls} = {dailyPulls + initialBonusPulls} tirages au premier jour.
      Ensuite {dailyPulls} tirage{dailyPulls > 1 ? 's' : ''} par jour.
    </p>
  </div>

  <!-- Pity Rules -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-orange-400">Pity (garanties)</h3>
    <p class="text-xs text-gray-500 mb-3">
      Apres X tirages sans obtenir une rarete, le prochain tirage la garantit.
    </p>

    {#if pityRules.length > 0}
      <div class="space-y-2 mb-3">
        {#each pityRules as rule, i}
          <div class="flex gap-2 items-center">
            <select
              value={rule.rarity}
              onchange={(e) => updatePityRarity(i, e.currentTarget.value as Rarity)}
              class="px-2 py-1 bg-slate-700 rounded text-sm"
            >
              <option value="rare">Rare</option>
              <option value="epic">Epic</option>
              <option value="legendary">Legendary</option>
            </select>
            <span class="text-xs text-gray-400">garanti apres</span>
            <input
              type="number"
              min="1"
              max="999"
              value={rule.pullsRequired}
              oninput={(e) => updatePityPulls(i, parseInt(e.currentTarget.value) || 1)}
              class="w-20 px-2 py-1 bg-slate-700 rounded text-sm text-center"
            />
            <span class="text-xs text-gray-400">tirages sans</span>
            <button
              onclick={() => removePityRule(i)}
              class="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs"
            >
              X
            </button>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-gray-500 mb-3 italic">Aucune regle de pity configuree.</p>
    {/if}

    <button
      onclick={addPityRule}
      class="px-3 py-1 bg-orange-800 hover:bg-orange-700 rounded text-xs"
    >
      + Ajouter une regle
    </button>
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

  <!-- Level Thresholds -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-cyan-400">Level XP Thresholds</h3>
    <p class="text-xs text-gray-500 mb-3">Define max level, base XP to reach level 2, and how much extra XP each subsequent level requires.</p>

    <div class="grid grid-cols-3 gap-4 mb-4">
      <div>
        <span class="block text-xs text-gray-400 mb-1">Max Level</span>
        <input
          type="number"
          min="2"
          max="100"
          bind:value={maxLevel}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
      <div>
        <span class="block text-xs text-gray-400 mb-1">Base XP (Lv1→2)</span>
        <input
          type="number"
          min="1"
          bind:value={baseXp}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
      <div>
        <span class="block text-xs text-gray-400 mb-1">XP Increment / Level</span>
        <input
          type="number"
          min="0"
          bind:value={xpIncrement}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
    </div>

    <!-- Preview -->
    <div class="mb-4">
      <span class="text-xs text-gray-500 font-medium">Preview ({generatedThresholds.length} levels):</span>
      <div class="flex gap-1.5 flex-wrap mt-1">
        {#each generatedThresholds as xp, i}
          <span class="text-[10px] bg-slate-700 rounded px-1.5 py-0.5 text-gray-300">
            Lv{i + 1}→{i + 2}: {xp}
          </span>
        {/each}
      </div>
    </div>

    <button
      onclick={handleSaveThresholds}
      class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold"
    >
      Save Level Thresholds
    </button>
  </div>

  <!-- Rarity Stat Multipliers -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-amber-400">Rarity Stat Multipliers</h3>
    <p class="text-xs text-gray-500 mb-3">Multiplier applied to all base stats depending on character rarity. A value of 1.0 means no change.</p>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {#each RARITIES as rarity}
        <div>
          <span class="block text-xs mb-1 capitalize {RARITY_COLORS[rarity]}">{rarity}</span>
          <input
            type="number"
            step="0.05"
            min="0.1"
            value={rarityMults[rarity]}
            oninput={(e) => updateRarityMult(rarity, parseFloat(e.currentTarget.value) || 1)}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      {/each}
    </div>
    <button
      onclick={handleSaveRarityMults}
      class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded font-bold"
    >
      Save Rarity Multipliers
    </button>
  </div>
</div>
