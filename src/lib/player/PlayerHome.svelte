<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import type { CharacterDefinition, Role, BaseStats } from '../game/types';
  import type { GameContent, GachaConfig, Dungeon, EnemyTemplate } from '../admin/adminTypes';
  import type { AbilityDefinition } from '../game/abilities';
  import { loadContent, loadContentWithSync } from '../admin/contentStore';
  import {
    loadPlayerSave,
    savePlayerSave,
    addCharacterToCollection,
    ascendCharacter,
    markGachaPulled,
    useDungeonAttempt,
    markDungeonCleared,
    resetPlayerSave,
    setPendingGachaReward,
    clearPendingGachaReward,
    claimPendingGachaReward,
    awardXp,
    type PlayerSave,
  } from './playerStore';
  import GachaSection from './GachaSection.svelte';
  import CollectionSection from './CollectionSection.svelte';
  import DailyDungeonSection from './DailyDungeonSection.svelte';

  interface Props {
    onNavigate: (page: string) => void;
  }

  let { onNavigate }: Props = $props();

  type Section = 'gacha' | 'dungeon' | 'collection';
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

  function handleGachaPullStart(characterId: string) {
    // Immediately consume the pull and store the pending reward — prevents refresh exploit
    playerSave = markGachaPulled(playerSave);
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

  function handleResetSave() {
    if (confirm('Reset all your progress? This cannot be undone.')) {
      playerSave = resetPlayerSave();
    }
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

  const sections: { key: Section; label: string; icon: string }[] = [
    { key: 'collection', label: 'Collection', icon: '' },
    { key: 'gacha', label: 'Gacha', icon: '' },
    { key: 'dungeon', label: 'Dungeon', icon: '' },
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

<div class="max-w-4xl mx-auto p-4">
  <!-- Daily Reset Timer -->
  <div class="bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 mb-4 text-center text-sm">
    <span class="text-gray-400">Daily reset in </span>
    <span class="text-amber-400 font-mono font-bold">{resetCountdown}</span>
  </div>

  <!-- Header -->
  <div class="flex items-center justify-between mb-4">
    <!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <h1
      class="text-2xl font-bold text-amber-400 select-none cursor-default"
      onclick={handleTitleClick}
    >
      Dungeon Gacha Run
    </h1>
    <div class="flex gap-2">
      <button
        onclick={handleResetSave}
        class="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300"
      >
        Reset Save
      </button>
    </div>
  </div>

  <!-- Summary bar -->
  <div class="bg-slate-800 rounded-lg px-4 py-2 mb-4 flex gap-6 text-sm">
    <span class="text-blue-400">
      {playerSave.collection.length} Characters
    </span>
    <span class="{playerSave.daily.gachaPullsRemaining <= 0 ? 'text-gray-500' : 'text-yellow-400'}">
      Gacha: {playerSave.daily.gachaPullsRemaining <= 0 ? 'No pulls' : `${playerSave.daily.gachaPullsRemaining} pull${playerSave.daily.gachaPullsRemaining > 1 ? 's' : ''}`}
    </span>
    <span class="{playerSave.daily.dungeonCleared ? 'text-green-400' : playerSave.daily.dungeonAttemptsLeft > 0 ? 'text-amber-400' : 'text-red-400'}">
      Dungeon: {playerSave.daily.dungeonCleared ? 'Cleared' : `${playerSave.daily.dungeonAttemptsLeft}/3 attempts`}
    </span>
  </div>

  <!-- Section tabs -->
  <div class="flex gap-1 mb-6 border-b border-slate-700 pb-1">
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
          onAttemptUsed={handleDungeonAttemptUsed}
          onDungeonCleared={handleDungeonCleared}
          onXpAwarded={handleXpAwarded}
        />
      {/if}
    {:else}
      <div class="text-center text-gray-500 py-8">
        No daily dungeon is set. An admin needs to configure one.
      </div>
    {/if}

  {:else if activeSection === 'collection'}
    <CollectionSection
      {playerSave}
      characters={content.characters}
      {gachaConfig}
      roleStats={content.roleStats}
      rarityMultipliers={content.rarityMultipliers}
      levelThresholds={content.levelThresholds}
      onAscend={handleAscend}
    />
  {/if}
</div>
