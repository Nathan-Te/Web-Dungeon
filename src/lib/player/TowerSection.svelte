<script lang="ts">
  import type { CharacterDefinition, Role, BaseStats, Rarity } from '../game/types';
  import type { Tower, TowerStage, Dungeon, EnemyTemplate } from '../admin/adminTypes';
  import type { AbilityDefinition } from '../game/abilities';
  import type { PlayerSave, TeamPreset, TowerProgress } from './playerStore';
  import { getTowerProgress } from './playerStore';
  import DailyDungeonSection from './DailyDungeonSection.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    towers: Tower[];
    dungeons: Dungeon[];
    enemies: EnemyTemplate[];
    abilities: AbilityDefinition[];
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    levelThresholds?: number[];
    teamPresets?: TeamPreset[];
    onStageCleared: (towerId: string, stageNumber: number) => void;
    onXpAwarded: (survivorIds: string[], xp: number) => void;
    onGoldAwarded: (amount: number) => void;
  }

  let {
    playerSave,
    characters,
    towers,
    dungeons,
    enemies,
    abilities,
    roleStats,
    rarityMultipliers,
    levelThresholds,
    teamPresets,
    onStageCleared,
    onXpAwarded,
    onGoldAwarded,
  }: Props = $props();

  type ViewState = 'list' | 'stages' | 'battle';
  let viewState: ViewState = $state('list');
  let selectedTower: Tower | null = $state(null);
  let selectedStage: TowerStage | null = $state(null);
  let activeDungeon: Dungeon | null = $state(null);

  function getProgress(towerId: string): TowerProgress | undefined {
    return getTowerProgress(playerSave, towerId);
  }

  function selectTower(tower: Tower) {
    selectedTower = tower;
    viewState = 'stages';
  }

  function startStage(stage: TowerStage) {
    const dungeon = dungeons.find(d => d.id === stage.dungeonId);
    if (!dungeon) return;
    selectedStage = stage;
    activeDungeon = dungeon;
    viewState = 'battle';
  }

  function handleStageCleared() {
    if (selectedTower && selectedStage) {
      onStageCleared(selectedTower.id, selectedStage.stageNumber);
    }
  }

  function handleAttemptUsed() {
    // Tower stages don't consume daily attempts
  }

  // Dummy room XP tracking — tower doesn't use daily xp tracking
  function handleRoomXpAwarded(_roomIndex: number) {
    // No daily tracking for tower
  }

  function backToStages() {
    viewState = 'stages';
    activeDungeon = null;
    selectedStage = null;
  }

  function backToList() {
    viewState = 'list';
    selectedTower = null;
    selectedStage = null;
    activeDungeon = null;
  }
</script>

<div class="space-y-4">
  {#if viewState === 'battle' && activeDungeon}
    <!-- Battle phase: reuse DailyDungeonSection -->
    <div class="flex items-center gap-2 mb-2">
      <button
        onclick={backToStages}
        class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium"
      >
        &larr; Retour aux étages
      </button>
      <span class="text-sm text-gray-400">
        {selectedTower?.name} — Étage {selectedStage?.stageNumber}
      </span>
    </div>
    <DailyDungeonSection
      {playerSave}
      {characters}
      dungeon={activeDungeon}
      {enemies}
      {abilities}
      {roleStats}
      {rarityMultipliers}
      {levelThresholds}
      maxTeamSize={activeDungeon.maxTeamSize ?? 5}
      {teamPresets}
      unlimitedAttempts={true}
      onAttemptUsed={handleAttemptUsed}
      onDungeonCleared={handleStageCleared}
      onXpAwarded={onXpAwarded}
      onRoomXpAwarded={handleRoomXpAwarded}
      onGoldAwarded={onGoldAwarded}
    />

  {:else if viewState === 'stages' && selectedTower}
    <!-- Stage list for selected tower -->
    <div class="flex items-center gap-2 mb-2">
      <button
        onclick={backToList}
        class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs font-medium"
      >
        &larr; Retour
      </button>
    </div>

    <h2 class="text-xl font-bold text-indigo-400 text-center">{selectedTower.name}</h2>
    {#if selectedTower.description}
      <p class="text-sm text-gray-400 text-center">{selectedTower.description}</p>
    {/if}

    {@const progress = getProgress(selectedTower.id)}
    {@const cleared = progress?.highestStageCleared ?? 0}

    <div class="text-center text-xs text-gray-500 mb-2">
      Progression : {cleared}/{selectedTower.stages.length} étages
    </div>

    <!-- Progress bar -->
    <div class="w-full bg-slate-700 rounded-full h-3 mb-4">
      <div
        class="bg-indigo-500 h-3 rounded-full transition-all"
        style="width: {selectedTower.stages.length > 0 ? (cleared / selectedTower.stages.length) * 100 : 0}%"
      ></div>
    </div>

    <div class="space-y-2">
      {#each selectedTower.stages.sort((a, b) => a.stageNumber - b.stageNumber) as stage}
        {@const isCleared = stage.stageNumber <= cleared}
        {@const isNext = stage.stageNumber === cleared + 1}
        {@const isLocked = stage.stageNumber > cleared + 1}
        {@const stageDungeon = dungeons.find(d => d.id === stage.dungeonId)}
        <div class="bg-slate-800 rounded-lg p-4 border transition-all
          {isCleared ? 'border-green-700/50' : isNext ? 'border-indigo-500' : 'border-slate-700 opacity-60'}">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold
                {isCleared ? 'bg-green-900 text-green-400' : isNext ? 'bg-indigo-900 text-indigo-400' : 'bg-slate-700 text-gray-500'}">
                {#if isCleared}
                  &#10003;
                {:else}
                  {stage.stageNumber}
                {/if}
              </div>
              <div>
                <div class="font-medium text-sm {isLocked ? 'text-gray-500' : ''}">
                  {stage.name ?? stageDungeon?.name ?? `Étage ${stage.stageNumber}`}
                </div>
                {#if stageDungeon}
                  <div class="text-[10px] text-gray-500">
                    {stageDungeon.rooms.length} salles
                    {#if stageDungeon.description}
                      — {stageDungeon.description}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
            <div>
              {#if isCleared}
                <span class="text-xs font-bold text-green-400 bg-green-900/50 px-2 py-1 rounded">Terminé</span>
              {:else if isNext}
                <button
                  onclick={() => startStage(stage)}
                  class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-sm"
                >
                  Entrer
                </button>
              {:else}
                <span class="text-xs text-gray-500">Verrouillé</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    {#if cleared >= selectedTower.stages.length && selectedTower.stages.length > 0}
      <div class="text-center py-4">
        <div class="text-2xl font-bold text-yellow-400">Tour terminée !</div>
        <div class="text-sm text-gray-400">Vous avez complété tous les étages de {selectedTower.name}.</div>
      </div>
    {/if}

  {:else}
    <!-- Tower list -->
    <h2 class="text-xl font-bold text-indigo-400 text-center">Tour</h2>

    {#if towers.length === 0}
      <div class="text-center text-gray-500 py-8 text-sm">
        Aucune tour disponible. Un admin doit en configurer.
      </div>
    {:else}
      <div class="space-y-3">
        {#each towers as tower}
          {@const progress = getProgress(tower.id)}
          {@const cleared = progress?.highestStageCleared ?? 0}
          {@const total = tower.stages.length}
          {@const isComplete = cleared >= total && total > 0}
          <button
            onclick={() => selectTower(tower)}
            class="w-full bg-slate-800 rounded-lg p-5 border text-left transition-all hover:brightness-110
              {isComplete ? 'border-yellow-600/50' : cleared > 0 ? 'border-indigo-600/50' : 'border-slate-700'}"
          >
            <div class="flex items-center justify-between mb-2">
              <h3 class="font-bold text-lg {isComplete ? 'text-yellow-400' : 'text-indigo-400'}">{tower.name}</h3>
              <span class="text-xs text-gray-400">{cleared}/{total} étages</span>
            </div>
            {#if tower.description}
              <p class="text-sm text-gray-400 mb-3">{tower.description}</p>
            {/if}
            <div class="w-full bg-slate-700 rounded-full h-2">
              <div
                class="h-2 rounded-full transition-all {isComplete ? 'bg-yellow-500' : 'bg-indigo-500'}"
                style="width: {total > 0 ? (cleared / total) * 100 : 0}%"
              ></div>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}
</div>
