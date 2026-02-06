<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CharacterDefinition, Role, BaseStats } from '../game/types';
  import type { GameContent, GachaConfig, Dungeon, EnemyTemplate } from '../admin/adminTypes';
  import type { AbilityDefinition } from '../game/abilities';
  import { loadContent, loadContentWithSync } from '../admin/contentStore';
  import {
    loadPlayerSave,
    savePlayerSave,
    applyGachaConfig,
    addCharacterToCollection,
    ascendCharacter,
    markGachaPulled,
    updatePityCounters,
    useDungeonAttempt,
    markDungeonCleared,
    resetPlayerSave,
    setPendingGachaReward,
    clearPendingGachaReward,
    claimPendingGachaReward,
    awardXp,
    awardGold,
    startExpedition,
    removeExpedition,
    markRoomXpAwarded,
    saveTeamPreset,
    deleteTeamPreset,
    type PlayerSave,
    type ActiveExpedition,
    type ExpeditionResult,
  } from './playerStore';
  import type { ExpeditionDuration } from '../admin/adminTypes';
  import GachaSection from './GachaSection.svelte';
  import CollectionSection from './CollectionSection.svelte';
  import DailyDungeonSection from './DailyDungeonSection.svelte';
  import ExpeditionSection from './ExpeditionSection.svelte';
  import TeamSection from './TeamSection.svelte';
  import SaveSync from './SaveSync.svelte';

  interface Props {
    onNavigate: (page: string) => void;
  }

  let { onNavigate }: Props = $props();

  type Section = 'gacha' | 'dungeon' | 'collection' | 'expedition' | 'teams' | 'save';
  let activeSection: Section = $state('collection');
  let gachaAnimating = $state(false);

  // Game content (admin-defined)
  let content: GameContent = $state({ version: 3, characters: [], enemies: [], dungeons: [], abilities: [] });

  // Player save
  let playerSave: PlayerSave = $state(loadPlayerSave());

  let gachaConfig = $derived(content.gachaConfig);
  let todayStr = $derived(new Date().toISOString().slice(0, 10));
  let dailyDungeonId = $derived(
    content.dailyDungeonSchedule?.[todayStr] ?? content.dailyDungeonId ?? null
  );
  let dailyDungeon = $derived(
    dailyDungeonId
      ? content.dungeons.find((d) => d.id === dailyDungeonId) ?? null
      : null
  );
  let maxTeamSize = $derived(dailyDungeon?.maxTeamSize ?? 5);

  onMount(async () => {
    // Load local content immediately, then sync with online version
    content = loadContent();
    playerSave = loadPlayerSave();
    // Apply gacha config (daily pulls, initial bonus)
    const gc = content.gachaConfig;
    const configured = applyGachaConfig(playerSave, gc?.dailyPulls, gc?.initialBonusPulls);
    if (configured !== playerSave) {
      playerSave = configured;
      savePlayerSave(playerSave);
    }
    // Claim any pending gacha reward from a previous interrupted animation
    const claimed = claimPendingGachaReward(playerSave);
    if (claimed !== playerSave) {
      playerSave = claimed;
      savePlayerSave(playerSave);
    }
    // Async: fetch remote content and update if newer
    const synced = await loadContentWithSync();
    content = synced;
  });

  function handleGachaPullStart(characterId: string, rarity: string) {
    // Immediately consume the pull and store the pending reward — prevents refresh exploit
    playerSave = markGachaPulled(playerSave);
    playerSave = updatePityCounters(playerSave, rarity);
    setPendingGachaReward(characterId);
    savePlayerSave(playerSave);
  }

  function handleGachaPull(characterId: string) {
    // Animation completed: add character to collection and clear the pending reward
    clearPendingGachaReward();
    playerSave = addCharacterToCollection(playerSave, characterId);
    savePlayerSave(playerSave);
  }

  function handleAscend(characterId: string) {
    const costs = gachaConfig?.ascensionCosts ?? [1, 2, 3, 4, 5, 6];
    const result = ascendCharacter(playerSave, characterId, costs);
    if (result) {
      playerSave = result;
      savePlayerSave(playerSave);
    }
  }

  function handleDungeonAttemptUsed() {
    playerSave = useDungeonAttempt(playerSave);
    savePlayerSave(playerSave);
  }

  function handleDungeonCleared() {
    playerSave = markDungeonCleared(playerSave);
    savePlayerSave(playerSave);
  }

  function handleXpAwarded(survivorIds: string[], xp: number) {
    playerSave = awardXp(playerSave, survivorIds, xp, content.levelThresholds);
    savePlayerSave(playerSave);
  }

  function handleRoomXpAwarded(roomIndex: number) {
    playerSave = markRoomXpAwarded(playerSave, roomIndex);
    savePlayerSave(playerSave);
  }

  function handleGoldAwarded(amount: number) {
    playerSave = awardGold(playerSave, amount);
    savePlayerSave(playerSave);
  }

  function handleStartExpedition(teamCharacterIds: string[], duration: ExpeditionDuration, teamPower: number) {
    playerSave = startExpedition(playerSave, teamCharacterIds, duration, teamPower);
    savePlayerSave(playerSave);
  }

  function handleForceCompleteExpedition(expeditionId: string) {
    const expeditions = (playerSave.expeditions ?? []).map(exp =>
      exp.id === expeditionId
        ? { ...exp, completesAt: Date.now() + 10_000 }
        : exp
    );
    playerSave = { ...playerSave, expeditions };
    savePlayerSave(playerSave);
  }

  function handleCollectExpedition(expedition: ActiveExpedition, result: ExpeditionResult) {
    // Remove the expedition
    playerSave = removeExpedition(playerSave, expedition.id);
    // Award XP to the team
    if (result.xpEarned > 0) {
      playerSave = awardXp(playerSave, expedition.teamCharacterIds, result.xpEarned, content.levelThresholds);
    }
    // Award gold
    if (result.goldEarned > 0) {
      playerSave = awardGold(playerSave, result.goldEarned);
    }
    // Grant gacha pull if won
    if (result.gachaPullWon) {
      playerSave = {
        ...playerSave,
        daily: {
          ...playerSave.daily,
          gachaPullsRemaining: playerSave.daily.gachaPullsRemaining + 1,
        },
      };
    }
    savePlayerSave(playerSave);
  }

  function handleResetSave() {
    if (confirm('Reset all your progress? This cannot be undone.')) {
      playerSave = resetPlayerSave();
    }
  }

  function handleSyncImport(imported: import('./playerStore').PlayerSave) {
    playerSave = imported;
  }

  // Hidden admin access: triple-click on the title
  let titleClickCount = $state(0);
  let titleClickTimer: ReturnType<typeof setTimeout> | null = null;

  function handleTitleClick() {
    titleClickCount++;
    if (titleClickTimer) clearTimeout(titleClickTimer);
    if (titleClickCount >= 3) {
      titleClickCount = 0;
      onNavigate('admin');
    } else {
      titleClickTimer = setTimeout(() => {
        titleClickCount = 0;
      }, 600);
    }
  }

  let expeditionConfig = $derived(content.expeditionConfig);
  let activeExpeditionCount = $derived((playerSave.expeditions ?? []).length);
  let isAdmin = $derived(sessionStorage.getItem('dungeon-admin-auth') === 'true');

  function handleSaveTeam(slotIndex: number, name: string, characterIds: string[]) {
    playerSave = saveTeamPreset(playerSave, slotIndex, name, characterIds);
    savePlayerSave(playerSave);
  }

  function handleDeleteTeam(slotIndex: number) {
    playerSave = deleteTeamPreset(playerSave, slotIndex);
    savePlayerSave(playerSave);
  }

  const sections: { key: Section; label: string; shortLabel: string; icon: string }[] = [
    { key: 'collection', label: 'Collection', shortLabel: 'Collec.', icon: '\u{1F4E6}' },
    { key: 'teams', label: 'Teams', shortLabel: 'Teams', icon: '\u{1F465}' },
    { key: 'gacha', label: 'Gacha', shortLabel: 'Gacha', icon: '\u{2728}' },
    { key: 'dungeon', label: 'Dungeon', shortLabel: 'Donjon', icon: '\u{2694}\u{FE0F}' },
    { key: 'expedition', label: 'Expedition', shortLabel: 'Exped.', icon: '\u{1F5FA}\u{FE0F}' },
    { key: 'save', label: 'Sauvegarde', shortLabel: 'Save', icon: '\u{1F4BE}' },
  ];

  // Daily reset countdown timer
  let resetCountdown = $state('');
  let countdownInterval: ReturnType<typeof setInterval> | null = null;

  function updateCountdown() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0);
    const diff = tomorrow.getTime() - now.getTime();
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    resetCountdown = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  onMount(() => {
    updateCountdown();
    countdownInterval = setInterval(updateCountdown, 1000);
  });

  onDestroy(() => {
    if (countdownInterval) clearInterval(countdownInterval);
  });
</script>

<div class="max-w-4xl xl:max-w-7xl mx-auto px-2 sm:px-4 pt-2 sm:pt-4 pb-20 sm:pb-4">
  <!-- Header — compact on mobile -->
  <div class="flex items-center justify-between mb-2 sm:mb-4">
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <h1
      class="text-lg sm:text-2xl font-bold text-amber-400 select-none cursor-default"
      onclick={handleTitleClick}
    >
      Dungeon Gacha Run
    </h1>
    <span class="text-amber-400 font-mono text-xs font-bold sm:hidden">{resetCountdown}</span>
  </div>

  <!-- Daily Reset Timer — hidden on mobile (shown inline in header) -->
  <div class="hidden sm:block bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 mb-4 text-center text-sm">
    <span class="text-gray-400">Daily reset in </span>
    <span class="text-amber-400 font-mono font-bold">{resetCountdown}</span>
  </div>

  <!-- Summary bar — grid on mobile for better layout -->
  <div class="bg-slate-800 rounded-lg px-3 sm:px-4 py-2 mb-3 sm:mb-4 grid grid-cols-3 sm:flex sm:gap-6 gap-x-2 gap-y-1 text-xs sm:text-sm">
    <span class="text-blue-400">
      {playerSave.collection.length} Characters
    </span>
    <span class="text-yellow-500 font-medium">
      {playerSave.gold ?? 0} Gold
    </span>
    <span class="{playerSave.daily.gachaPullsRemaining <= 0 ? 'text-gray-500' : 'text-yellow-400'}">
      {playerSave.daily.gachaPullsRemaining <= 0 ? 'No pulls' : `${playerSave.daily.gachaPullsRemaining} pull${playerSave.daily.gachaPullsRemaining > 1 ? 's' : ''}`}
    </span>
    <span class="{playerSave.daily.dungeonCleared ? 'text-green-400' : playerSave.daily.dungeonAttemptsLeft > 0 ? 'text-amber-400' : 'text-red-400'}">
      {playerSave.daily.dungeonCleared ? 'Cleared' : `Dungeon ${playerSave.daily.dungeonAttemptsLeft}/3`}
    </span>
    <span class="{activeExpeditionCount > 0 ? 'text-emerald-400' : 'text-gray-500'}">
      Exped. {activeExpeditionCount} active
    </span>
  </div>

  <!-- Desktop Section tabs — hidden on mobile -->
  <div class="hidden sm:flex gap-1 mb-6 border-b border-slate-700 pb-1">
    {#each sections as section}
      <button
        onclick={() => { if (!gachaAnimating) activeSection = section.key; }}
        disabled={gachaAnimating && section.key !== 'gacha'}
        class="px-4 py-2 rounded-t text-sm font-medium transition-colors
          {activeSection === section.key
            ? 'bg-slate-700 text-white'
            : gachaAnimating && section.key !== 'gacha'
              ? 'text-gray-600 cursor-not-allowed'
              : 'text-gray-400 hover:text-gray-300 hover:bg-slate-800'}"
      >
        {section.icon} {section.label}
      </button>
    {/each}
  </div>

  <!-- Section Content -->
  {#if activeSection === 'gacha'}
    {#if gachaConfig}
      <GachaSection
        {playerSave}
        characters={content.characters}
        {gachaConfig}
        abilities={content.abilities}
        onPullStart={handleGachaPullStart}
        onPull={handleGachaPull}
        onAnimatingChange={(v) => gachaAnimating = v}
      />
    {:else}
      <div class="text-center text-gray-500 py-8">
        Gacha is not configured yet. An admin needs to set it up.
      </div>
    {/if}

  {:else if activeSection === 'dungeon'}
    {#if dailyDungeon}
      {#if playerSave.daily.dungeonCleared}
        <div class="text-center py-8">
          <div class="text-2xl font-bold text-green-400 mb-2">Daily Dungeon Cleared!</div>
          <div class="text-gray-400">Come back tomorrow for a new challenge.</div>
          {#if playerSave.daily.gachaPullsRemaining > 0}
            <div class="text-yellow-400 mt-2 font-medium">You earned a bonus Gacha pull!</div>
          {/if}
        </div>
      {:else}
        <DailyDungeonSection
          {playerSave}
          characters={content.characters}
          dungeon={dailyDungeon}
          enemies={content.enemies}
          abilities={content.abilities}
          roleStats={content.roleStats}
          rarityMultipliers={content.rarityMultipliers}
          levelThresholds={content.levelThresholds}
          {maxTeamSize}
          teamPresets={playerSave.teams}
          onAttemptUsed={handleDungeonAttemptUsed}
          onDungeonCleared={handleDungeonCleared}
          onXpAwarded={handleXpAwarded}
          onRoomXpAwarded={handleRoomXpAwarded}
          onGoldAwarded={handleGoldAwarded}
        />
      {/if}
    {:else}
      <div class="text-center text-gray-500 py-8">
        No daily dungeon is set. An admin needs to configure one.
      </div>
    {/if}

  {:else if activeSection === 'expedition'}
    {#if expeditionConfig}
      <ExpeditionSection
        {playerSave}
        characters={content.characters}
        {expeditionConfig}
        roleStats={content.roleStats}
        rarityMultipliers={content.rarityMultipliers}
        levelThresholds={content.levelThresholds}
        {isAdmin}
        teamPresets={playerSave.teams}
        onStartExpedition={handleStartExpedition}
        onCollectExpedition={handleCollectExpedition}
        onForceCompleteExpedition={handleForceCompleteExpedition}
      />
    {:else}
      <div class="text-center text-gray-500 py-8">
        Expeditions are not configured yet. An admin needs to set them up.
      </div>
    {/if}

  {:else if activeSection === 'teams'}
    <TeamSection
      {playerSave}
      characters={content.characters}
      roleStats={content.roleStats}
      rarityMultipliers={content.rarityMultipliers}
      onSaveTeam={handleSaveTeam}
      onDeleteTeam={handleDeleteTeam}
    />

  {:else if activeSection === 'collection'}
    <CollectionSection
      {playerSave}
      characters={content.characters}
      {gachaConfig}
      abilities={content.abilities}
      roleStats={content.roleStats}
      rarityMultipliers={content.rarityMultipliers}
      levelThresholds={content.levelThresholds}
      onAscend={handleAscend}
    />

  {:else if activeSection === 'save'}
    <SaveSync
      {playerSave}
      onImport={handleSyncImport}
      onReset={handleResetSave}
    />
  {/if}
</div>

<!-- Mobile bottom navigation bar -->
<nav class="sm:hidden fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 z-50">
  <div class="flex justify-around items-center">
    {#each sections as section}
      <button
        onclick={() => { if (!gachaAnimating) activeSection = section.key; }}
        disabled={gachaAnimating && section.key !== 'gacha'}
        class="flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors
          {activeSection === section.key
            ? 'text-amber-400'
            : gachaAnimating && section.key !== 'gacha'
              ? 'text-gray-700 cursor-not-allowed'
              : 'text-gray-500 active:text-gray-300'}"
      >
        <span class="text-lg leading-none">{section.icon}</span>
        <span class="text-[10px] font-medium leading-none">{section.shortLabel}</span>
      </button>
    {/each}
  </div>
</nav>
