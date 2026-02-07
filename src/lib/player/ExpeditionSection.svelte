<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CharacterDefinition, Role, Rarity, BaseStats } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { ExpeditionConfig, ExpeditionDuration } from '../admin/adminTypes';
  import type { PlayerSave, OwnedCharacter, ActiveExpedition, ExpeditionResult, TeamPreset } from './playerStore';
  import { isCharacterOnExpedition, getXpForLevel } from './playerStore';
  import { calculateTeamPower, resolveExpedition, previewExpedition } from '../game/expeditionSimulation';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    expeditionConfig: ExpeditionConfig;
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    levelThresholds?: number[];
    isAdmin?: boolean;
    teamPresets?: TeamPreset[];
    onStartExpedition: (teamCharacterIds: string[], duration: ExpeditionDuration, teamPower: number) => void;
    onCollectExpedition: (expedition: ActiveExpedition, result: ExpeditionResult) => void;
    onCancelExpedition: (expeditionId: string) => void;
    onForceCompleteExpedition?: (expeditionId: string) => void;
  }

  let {
    playerSave,
    characters,
    expeditionConfig,
    roleStats,
    rarityMultipliers,
    levelThresholds,
    isAdmin = false,
    teamPresets,
    onStartExpedition,
    onCollectExpedition,
    onCancelExpedition,
    onForceCompleteExpedition,
  }: Props = $props();

  const RARITY_BORDER: Record<Rarity, string> = {
    common: 'border-gray-500',
    rare: 'border-blue-500',
    epic: 'border-purple-500',
    legendary: 'border-yellow-500',
  };

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_LABELS: Record<Role, string> = {
    tank: 'Tank', warrior: 'Warrior', archer: 'Archer', mage: 'Mage',
    assassin: 'Assassin', healer: 'Healer', summoner: 'Summoner',
  };

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'text-blue-400', warrior: 'text-orange-400', archer: 'text-green-400', mage: 'text-purple-400',
    assassin: 'text-red-400', healer: 'text-pink-400', summoner: 'text-teal-400',
  };

  type ViewState = 'list' | 'setup' | 'result';
  let viewState: ViewState = $state('list');

  // Setup state
  let selectedTeam: string[] = $state([]);
  let selectedDuration: ExpeditionDuration = $state(4);

  // Result state
  let lastResult: ExpeditionResult | null = $state(null);
  let lastExpedition: ActiveExpedition | null = $state(null);

  interface XpGainEntry {
    characterId: string;
    name: string;
    role: Role;
    rarity: Rarity;
    sprites?: import('../game/types').SpriteSet;
    prevLevel: number;
    prevXp: number;
    newLevel: number;
    newXp: number;
    xpGained: number;
  }
  let xpGains: XpGainEntry[] = $state([]);

  // Cancel confirmation
  let cancelConfirmId: string | null = $state(null);

  function handleCancelExpedition(expeditionId: string) {
    if (cancelConfirmId === expeditionId) {
      onCancelExpedition(expeditionId);
      cancelConfirmId = null;
    } else {
      cancelConfirmId = expeditionId;
    }
  }

  // Timer for countdown updates
  let now = $state(Date.now());
  let timerInterval: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    timerInterval = setInterval(() => { now = Date.now(); }, 1000);
  });

  onDestroy(() => {
    if (timerInterval) clearInterval(timerInterval);
  });

  let activeExpeditions = $derived(playerSave.expeditions ?? []);

  // Characters available for expedition (owned + not on expedition)
  let availableCharacters = $derived(
    playerSave.collection
      .filter(owned => !isCharacterOnExpedition(playerSave, owned.characterId))
      .map(owned => {
        const def = characters.find(c => c.id === owned.characterId);
        return def ? { owned, def } : null;
      })
      .filter((x): x is { owned: OwnedCharacter; def: CharacterDefinition } => x !== null)
  );

  let maxConcurrent = $derived(expeditionConfig.maxConcurrentExpeditions ?? 3);
  let canStartNew = $derived(activeExpeditions.length < maxConcurrent && availableCharacters.length > 0);

  // Valid team presets (non-empty, with at least some characters available)
  let availableCharIds = $derived(new Set(availableCharacters.map(c => c.owned.characterId)));
  let validPresets = $derived(
    (teamPresets ?? [])
      .map((preset, index) => ({ preset, index }))
      .filter(({ preset }) => preset.characterIds.length > 0 && preset.characterIds.some(id => availableCharIds.has(id)))
  );

  function loadPreset(preset: TeamPreset) {
    const validIds = preset.characterIds.filter(id => availableCharIds.has(id));
    selectedTeam = validIds.slice(0, expeditionConfig.maxTeamSize);
  }

  function getStats(owned: OwnedCharacter, def: CharacterDefinition) {
    const base = roleStats?.[def.role] ?? ROLE_BASE_STATS[def.role];
    const rarityMult = rarityMultipliers?.[def.rarity] ?? 1;
    const levelMult = 1 + (owned.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascMult = 1 + owned.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    return {
      hp: Math.round(base.hp * rarityMult * levelMult * ascMult),
      atk: Math.round(base.atk * rarityMult * levelMult * ascMult),
      def: Math.round(base.def * rarityMult * levelMult * ascMult),
      spd: Math.round(base.spd * rarityMult * levelMult * ascMult),
    };
  }

  function getTeamStats() {
    return selectedTeam.map(id => {
      const owned = playerSave.collection.find(c => c.characterId === id);
      const def = characters.find(c => c.id === id);
      if (!owned || !def) return { hp: 0, atk: 0, def: 0, spd: 0, role: 'warrior' as const };
      return { ...getStats(owned, def), role: def.role };
    });
  }

  let teamPower = $derived(calculateTeamPower(getTeamStats()));

  let preview = $derived(
    selectedTeam.length > 0
      ? previewExpedition(teamPower, selectedDuration, expeditionConfig)
      : null
  );

  function toggleCharacter(charId: string) {
    if (selectedTeam.includes(charId)) {
      selectedTeam = selectedTeam.filter(id => id !== charId);
    } else if (selectedTeam.length < expeditionConfig.maxTeamSize) {
      selectedTeam = [...selectedTeam, charId];
    }
  }

  function handleStartExpedition() {
    if (selectedTeam.length === 0) return;
    onStartExpedition(selectedTeam, selectedDuration, teamPower);
    selectedTeam = [];
    viewState = 'list';
  }

  function handleCollect(expedition: ActiveExpedition) {
    const result = resolveExpedition(expedition, expeditionConfig);

    // Snapshot levels before XP is awarded
    const xpEach = result.xpEarned > 0
      ? Math.floor(result.xpEarned / expedition.teamCharacterIds.length)
      : 0;
    xpGains = expedition.teamCharacterIds.map(charId => {
      const owned = playerSave.collection.find(c => c.characterId === charId);
      const def = characters.find(c => c.id === charId);
      if (!owned || !def) return null;
      // Simulate level-up for display
      let newXp = (owned.xp ?? 0) + xpEach;
      let newLevel = owned.level;
      while (true) {
        const needed = getXpForLevel(newLevel, levelThresholds);
        if (needed === null || newXp < needed) break;
        newXp -= needed;
        newLevel++;
      }
      return {
        characterId: charId,
        name: def.name,
        role: def.role,
        rarity: def.rarity,
        sprites: def.sprites,
        prevLevel: owned.level,
        prevXp: owned.xp ?? 0,
        newLevel,
        newXp,
        xpGained: xpEach,
      };
    }).filter((e): e is XpGainEntry => e !== null);

    lastResult = result;
    lastExpedition = expedition;
    onCollectExpedition(expedition, result);
    viewState = 'result';
  }

  function isExpeditionComplete(exp: ActiveExpedition): boolean {
    return now >= exp.completesAt;
  }

  function formatTimeRemaining(completesAt: number): string {
    const diff = Math.max(0, completesAt - now);
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function getCharName(charId: string): string {
    return characters.find(c => c.id === charId)?.name ?? charId;
  }

  function getCharDef(charId: string): CharacterDefinition | undefined {
    return characters.find(c => c.id === charId);
  }

  const durations: ExpeditionDuration[] = [4, 8, 12, 24];

  function getDurationLabel(d: ExpeditionDuration): string {
    return `${d}h`;
  }

  function getDifficultyLabel(d: ExpeditionDuration): string {
    const tier = expeditionConfig.durationTiers[d];
    if (tier.enemyPowerMult <= 1.0) return 'Easy';
    if (tier.enemyPowerMult <= 1.5) return 'Normal';
    if (tier.enemyPowerMult <= 2.0) return 'Hard';
    return 'Extreme';
  }

  function getDifficultyColor(d: ExpeditionDuration): string {
    const tier = expeditionConfig.durationTiers[d];
    if (tier.enemyPowerMult <= 1.0) return 'text-green-400';
    if (tier.enemyPowerMult <= 1.5) return 'text-yellow-400';
    if (tier.enemyPowerMult <= 2.0) return 'text-orange-400';
    return 'text-red-400';
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-emerald-400 text-center">Expeditions</h2>

  {#if viewState === 'result' && lastResult && lastExpedition}
    <!-- Result Screen -->
    <div class="bg-slate-800 rounded-lg p-6 max-w-lg mx-auto border border-emerald-700">
      <h3 class="text-lg font-bold text-center mb-4
        {lastResult.fullClear ? 'text-emerald-400' : 'text-amber-400'}">
        {lastResult.fullClear ? 'Expedition Complete!' : 'Expedition Failed'}
      </h3>

      <!-- Progress -->
      <div class="text-center mb-4">
        <div class="text-sm text-gray-400">Waves Cleared</div>
        <div class="text-2xl font-bold {lastResult.fullClear ? 'text-emerald-400' : 'text-amber-400'}">
          {lastResult.wavesCleared} / {lastResult.totalWaves}
        </div>
        <div class="w-full bg-slate-700 rounded-full h-2 mt-2">
          <div
            class="h-2 rounded-full transition-all {lastResult.fullClear ? 'bg-emerald-500' : 'bg-amber-500'}"
            style="width: {(lastResult.wavesCleared / lastResult.totalWaves) * 100}%"
          ></div>
        </div>
      </div>

      <!-- XP Gains per character -->
      {#if xpGains.length > 0}
        <div class="mb-4">
          <h4 class="text-center font-bold text-cyan-400 mb-3">XP Gained!</h4>
          <div class="space-y-3">
            {#each xpGains as entry}
              {@const xpNeeded = getXpForLevel(entry.newLevel, levelThresholds)}
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 flex-shrink-0 rounded border {RARITY_BORDER[entry.rarity]} bg-slate-900 overflow-hidden">
                  <SpritePreview sprites={entry.sprites} fallback={ROLE_ICONS[entry.role]} class="w-10 h-10" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between text-sm">
                    <span class="font-medium truncate">{entry.name}</span>
                    <span class="text-cyan-400 text-xs font-bold flex-shrink-0">+{entry.xpGained} XP</span>
                  </div>
                  {#if entry.newLevel > entry.prevLevel}
                    <div class="text-xs text-yellow-400 font-bold">Level Up! Lv{entry.prevLevel} → Lv{entry.newLevel}</div>
                  {/if}
                  {#if xpNeeded !== null}
                    <div class="w-full bg-slate-700 rounded-full h-2 mt-1">
                      <div
                        class="bg-cyan-500 h-2 rounded-full transition-all"
                        style="width: {Math.min(100, (entry.newXp / xpNeeded) * 100)}%"
                      ></div>
                    </div>
                    <div class="text-[10px] text-gray-500 mt-0.5">
                      Lv{entry.newLevel} — {entry.newXp}/{xpNeeded} XP
                    </div>
                  {:else}
                    <div class="text-[10px] text-cyan-400 font-bold mt-0.5">Max Level</div>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Rewards summary -->
      <div class="space-y-3">
        <div class="flex items-center justify-between bg-slate-900 rounded p-3">
          <span class="text-gray-400">Total XP</span>
          <span class="text-cyan-400 font-bold">+{lastResult.xpEarned} XP</span>
        </div>

        <div class="flex items-center justify-between bg-slate-900 rounded p-3">
          <span class="text-gray-400">Gold</span>
          <span class="text-yellow-500 font-bold">+{lastResult.goldEarned} Gold</span>
        </div>

        <div class="flex items-center justify-between bg-slate-900 rounded p-3">
          <span class="text-gray-400">Gacha Pull</span>
          {#if lastResult.gachaPullWon}
            <span class="text-yellow-400 font-bold">+1 Pull Won!</span>
          {:else}
            <span class="text-gray-500">No luck ({(lastResult.gachaChance * 100).toFixed(1)}% chance)</span>
          {/if}
        </div>
      </div>

      <button
        onclick={() => { viewState = 'list'; lastResult = null; lastExpedition = null; xpGains = []; }}
        class="mt-4 w-full px-4 py-2 bg-emerald-700 hover:bg-emerald-600 rounded font-bold text-sm"
      >
        Back to Expeditions
      </button>
    </div>

  {:else if viewState === 'setup'}
    <!-- Setup Screen -->
    <div class="space-y-4">
      <!-- Duration Selection -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3 text-gray-300">Duration</h3>
        <div class="grid grid-cols-4 gap-2">
          {#each durations as dur}
            <button
              onclick={() => selectedDuration = dur}
              class="px-3 py-3 rounded text-center transition-all
                {selectedDuration === dur
                  ? 'bg-emerald-700 ring-2 ring-emerald-400 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}"
            >
              <div class="text-lg font-bold">{getDurationLabel(dur)}</div>
              <div class="text-[10px] {getDifficultyColor(dur)}">{getDifficultyLabel(dur)}</div>
              <div class="text-[10px] text-gray-500">{expeditionConfig.durationTiers[dur].totalWaves} waves</div>
            </button>
          {/each}
        </div>
      </div>

      <!-- Team Selection -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3 text-gray-300">
          Team ({selectedTeam.length}/{expeditionConfig.maxTeamSize})
        </h3>

        <!-- Team Presets -->
        {#if validPresets.length > 0}
          <div class="flex gap-2 flex-wrap mb-3">
            <span class="text-xs text-gray-500 self-center">Load team:</span>
            {#each validPresets as { preset, index }}
              <button
                onclick={() => loadPreset(preset)}
                class="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 border border-indigo-600 rounded text-xs font-medium text-indigo-300"
              >
                {preset.name || `Team ${index + 1}`}
              </button>
            {/each}
          </div>
        {/if}

        {#if availableCharacters.length === 0}
          <div class="text-center text-gray-500 py-4 text-sm">
            No characters available. They may all be on expeditions.
          </div>
        {:else}
          <div class="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9 gap-2">
            {#each availableCharacters as { owned, def }}
              {@const isSelected = selectedTeam.includes(owned.characterId)}
              <button
                onclick={() => toggleCharacter(owned.characterId)}
                disabled={!isSelected && selectedTeam.length >= expeditionConfig.maxTeamSize}
                class="relative aspect-[5/7] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all overflow-hidden
                  {RARITY_BORDER[def.rarity]}
                  {isSelected ? 'ring-2 ring-emerald-400 scale-105 bg-slate-700' : 'bg-slate-800 hover:brightness-125'}
                  {!isSelected && selectedTeam.length >= expeditionConfig.maxTeamSize ? 'opacity-40 cursor-not-allowed' : ''}"
              >
                {#if isSelected}
                  <span class="absolute top-0.5 right-0.5 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center text-[8px] font-bold text-black z-10">
                    {selectedTeam.indexOf(owned.characterId) + 1}
                  </span>
                {/if}
                <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-12 h-12 sm:w-14 sm:h-14" />
                <span class="text-[9px] font-medium truncate w-full text-center px-0.5">{def.name}</span>
                <span class="text-[8px] {ROLE_COLORS[def.role]}">{ROLE_LABELS[def.role]}</span>
                <span class="text-[8px] text-yellow-400">Lv{owned.level}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Preview -->
      {#if preview && selectedTeam.length > 0}
        <div class="bg-slate-800 rounded-lg p-4">
          <h3 class="font-bold mb-3 text-gray-300">Preview</h3>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
            <div class="bg-slate-900 rounded p-2">
              <div class="text-[10px] text-gray-500">Team Power</div>
              <div class="text-sm font-bold text-emerald-400">{teamPower}</div>
            </div>
            <div class="bg-slate-900 rounded p-2">
              <div class="text-[10px] text-gray-500">Est. Waves</div>
              <div class="text-sm font-bold text-blue-400">{preview.estimatedWaves}/{preview.totalWaves}</div>
            </div>
            <div class="bg-slate-900 rounded p-2">
              <div class="text-[10px] text-gray-500">Est. XP</div>
              <div class="text-sm font-bold text-cyan-400">~{preview.estimatedXp}</div>
            </div>
            <div class="bg-slate-900 rounded p-2">
              <div class="text-[10px] text-gray-500">Est. Gold</div>
              <div class="text-sm font-bold text-yellow-500">~{preview.estimatedGold}</div>
            </div>
            <div class="bg-slate-900 rounded p-2">
              <div class="text-[10px] text-gray-500">Gacha Chance</div>
              <div class="text-sm font-bold text-yellow-400">{(preview.gachaChance * 100).toFixed(1)}%</div>
            </div>
          </div>

          {#if preview.clearChance < 0.3}
            <div class="mt-3 text-xs text-red-400 text-center">
              Your team may be too weak for this duration. Consider a shorter expedition.
            </div>
          {:else if preview.clearChance > 0.8}
            <div class="mt-3 text-xs text-emerald-400 text-center">
              High chance of full clear!
            </div>
          {/if}
        </div>
      {/if}

      <!-- Warning: characters unavailable during expedition -->
      {#if selectedTeam.length > 0}
        <div class="bg-amber-900/30 border border-amber-600/50 rounded-lg px-4 py-3 text-center">
          <p class="text-xs text-amber-400">
            Les personnages envoyés en expédition ne seront plus disponibles pour le Donjon Quotidien ni pour d'autres expéditions jusqu'à leur retour.
          </p>
        </div>
      {/if}

      <!-- Actions -->
      <div class="flex gap-3">
        <button
          onclick={() => { viewState = 'list'; selectedTeam = []; }}
          class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium"
        >
          Cancel
        </button>
        <button
          onclick={handleStartExpedition}
          disabled={selectedTeam.length === 0}
          class="flex-1 px-4 py-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-bold"
        >
          Send Expedition ({selectedDuration}h)
        </button>
      </div>
    </div>

  {:else}
    <!-- List View -->
    <div class="space-y-4">
      <!-- Active Expeditions -->
      {#if activeExpeditions.length > 0}
        <div class="text-xs text-gray-500 text-center mb-1">
          {activeExpeditions.length}/{maxConcurrent} expedition slots used
        </div>
        <div class="space-y-4">
          {#each activeExpeditions as exp}
            {@const complete = isExpeditionComplete(exp)}
            <div class="bg-slate-800 rounded-lg p-5 border {complete ? 'border-emerald-600' : 'border-slate-700'}">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-3">
                  <span class="text-base font-bold text-emerald-400">{exp.duration}h Expedition</span>
                  <span class="text-xs text-gray-500">Power: {exp.teamPower}</span>
                </div>
                {#if complete}
                  <span class="text-xs font-bold text-emerald-400 bg-emerald-900/50 px-2 py-0.5 rounded">COMPLETE</span>
                {:else}
                  <span class="text-sm font-mono text-amber-400">{formatTimeRemaining(exp.completesAt)}</span>
                {/if}
              </div>

              <!-- Team members with names + roles -->
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
                {#each exp.teamCharacterIds as charId}
                  {@const def = getCharDef(charId)}
                  {@const owned = playerSave.collection.find(c => c.characterId === charId)}
                  {#if def}
                    <div class="flex items-center gap-2 bg-slate-900 rounded-lg px-2 sm:px-3 py-2 border {RARITY_BORDER[def.rarity]} min-w-0">
                      <div class="w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden flex-shrink-0">
                        <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-8 h-8 sm:w-10 sm:h-10" />
                      </div>
                      <div class="min-w-0">
                        <div class="text-xs sm:text-sm font-medium truncate">{def.name}</div>
                        <div class="flex items-center gap-1.5 text-[10px]">
                          <span class="{ROLE_COLORS[def.role]}">{ROLE_LABELS[def.role]}</span>
                          {#if owned}
                            <span class="text-yellow-400">Lv{owned.level}</span>
                          {/if}
                        </div>
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>

              <!-- Progress bar + actions -->
              {#if !complete}
                {@const elapsed = now - exp.startedAt}
                {@const total = exp.completesAt - exp.startedAt}
                <div class="w-full bg-slate-700 rounded-full h-2">
                  <div
                    class="bg-emerald-500 h-2 rounded-full transition-all"
                    style="width: {Math.min(100, (elapsed / total) * 100)}%"
                  ></div>
                </div>
                <div class="flex items-center gap-2 mt-2">
                  <button
                    onclick={() => handleCancelExpedition(exp.id)}
                    class="px-3 py-1.5 rounded text-xs font-medium transition-all
                      {cancelConfirmId === exp.id
                        ? 'bg-red-700 hover:bg-red-600 text-white border border-red-500'
                        : 'bg-slate-700 hover:bg-slate-600 text-gray-300 border border-slate-600'}"
                  >
                    {cancelConfirmId === exp.id ? 'Confirmer l\'annulation' : 'Annuler'}
                  </button>
                  {#if cancelConfirmId === exp.id}
                    <button
                      onclick={() => cancelConfirmId = null}
                      class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-xs text-gray-400"
                    >
                      Non
                    </button>
                    <span class="text-[10px] text-red-400">Les personnages reviendront sans récompenses</span>
                  {/if}
                  {#if isAdmin && onForceCompleteExpedition}
                    <button
                      onclick={() => onForceCompleteExpedition!(exp.id)}
                      class="px-3 py-1 bg-amber-900 hover:bg-amber-800 border border-amber-600 rounded text-xs text-amber-300"
                    >
                      [Admin] Force (10s)
                    </button>
                  {/if}
                </div>
              {:else}
                <button
                  onclick={() => handleCollect(exp)}
                  class="w-full px-4 py-2.5 bg-emerald-700 hover:bg-emerald-600 rounded font-bold text-sm"
                >
                  Collect Rewards
                </button>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <div class="text-center text-gray-500 py-4 text-sm">
          No active expeditions.
        </div>
      {/if}

      <!-- New Expedition Button -->
      <button
        onclick={() => { viewState = 'setup'; selectedTeam = []; }}
        disabled={!canStartNew}
        class="w-full px-4 py-3 bg-emerald-800 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-bold border border-emerald-600"
      >
        {#if activeExpeditions.length >= maxConcurrent}
          Max Expeditions Reached ({maxConcurrent}/{maxConcurrent})
        {:else if availableCharacters.length === 0}
          No Characters Available
        {:else}
          New Expedition ({activeExpeditions.length}/{maxConcurrent})
        {/if}
      </button>

      {#if playerSave.collection.length === 0}
        <div class="text-center text-gray-500 text-sm">
          You need characters first! Pull some from the Gacha.
        </div>
      {/if}
    </div>
  {/if}
</div>
