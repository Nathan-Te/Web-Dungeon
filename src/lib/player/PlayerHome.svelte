<script lang="ts">
  import { onMount } from 'svelte';
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
    // Async: fetch remote content and update if newer
    const synced = await loadContentWithSync();
    content = synced;
  });

  function handleGachaPull(characterId: string) {
    playerSave = markGachaPulled(addCharacterToCollection(playerSave, characterId));
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
</script>

<div class="max-w-4xl mx-auto p-4">
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
    <span class="{playerSave.daily.gachaPulled ? 'text-gray-500' : 'text-yellow-400'}">
      Gacha: {playerSave.daily.gachaPulled ? 'Used' : '1 pull'}
    </span>
    <span class="{playerSave.daily.dungeonCleared ? 'text-green-400' : playerSave.daily.dungeonAttemptsLeft > 0 ? 'text-amber-400' : 'text-red-400'}">
      Dungeon: {playerSave.daily.dungeonCleared ? 'Cleared' : `${playerSave.daily.dungeonAttemptsLeft}/3 attempts`}
    </span>
  </div>

  <!-- Section tabs -->
  <div class="flex gap-1 mb-6 border-b border-slate-700 pb-1">
    {#each sections as section}
      <button
        onclick={() => (activeSection = section.key)}
        class="px-4 py-2 rounded-t text-sm font-medium transition-colors
          {activeSection === section.key
            ? 'bg-slate-700 text-white'
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
        onPull={handleGachaPull}
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
        </div>
      {:else}
        <DailyDungeonSection
          {playerSave}
          characters={content.characters}
          dungeon={dailyDungeon}
          enemies={content.enemies}
          abilities={content.abilities}
          roleStats={content.roleStats}
          {maxTeamSize}
          onAttemptUsed={handleDungeonAttemptUsed}
          onDungeonCleared={handleDungeonCleared}
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
      onAscend={handleAscend}
    />
  {/if}
</div>
