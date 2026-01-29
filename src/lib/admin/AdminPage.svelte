<script lang="ts">
  import { onMount } from 'svelte';
  import type { CharacterDefinition, BaseStats, Role } from '../game/types';
  import type { AbilityDefinition } from '../game/abilities';
  import type { GameContent, EnemyTemplate, Dungeon } from './adminTypes';
  import {
    loadContent,
    saveContent,
    exportContentAsJson,
    parseImportedJson,
    resetToDefaults,
    upsertCharacter,
    deleteCharacter,
    upsertEnemy,
    deleteEnemy,
    upsertDungeon,
    deleteDungeon,
    upsertAbility,
    deleteAbility,
    publishContentOnline,
    getGitHubToken,
    setGitHubToken,
  } from './contentStore';
  import CharacterEditor from './CharacterEditor.svelte';
  import EnemyEditor from './EnemyEditor.svelte';
  import DungeonEditor from './DungeonEditor.svelte';
  import SpellEditor from './SpellEditor.svelte';
  import RolesReference from './RolesReference.svelte';
  import GachaConfigEditor from './GachaConfigEditor.svelte';
  import type { GachaConfig } from './adminTypes';

  interface Props {
    onNavigate: (page: string) => void;
  }

  let { onNavigate }: Props = $props();

  type Tab = 'characters' | 'enemies' | 'dungeons' | 'spells' | 'roles' | 'gacha' | 'data';
  let activeTab: Tab = $state('characters');
  let content: GameContent = $state({ version: 3, characters: [], enemies: [], dungeons: [], abilities: [] });
  let statusMessage = $state('');
  let importError = $state('');
  let publishError = $state('');
  let isPublishing = $state(false);
  let showTokenInput = $state(false);
  let tokenInput = $state('');

  onMount(() => {
    content = loadContent();
  });

  function save(updated: GameContent) {
    content = updated;
    saveContent(updated);
    showStatus('Saved');
  }

  function showStatus(msg: string) {
    statusMessage = msg;
    setTimeout(() => (statusMessage = ''), 2000);
  }

  // Character CRUD
  function onSaveCharacter(char: CharacterDefinition) {
    save(upsertCharacter(content, char));
  }
  function onDeleteCharacter(id: string) {
    save(deleteCharacter(content, id));
  }

  // Enemy CRUD
  function onSaveEnemy(enemy: EnemyTemplate) {
    save(upsertEnemy(content, enemy));
  }
  function onDeleteEnemy(id: string) {
    save(deleteEnemy(content, id));
  }

  // Dungeon CRUD
  function onSaveDungeon(dungeon: Dungeon) {
    save(upsertDungeon(content, dungeon));
  }
  function onDeleteDungeon(id: string) {
    save(deleteDungeon(content, id));
  }

  // Ability CRUD
  function onSaveAbility(ability: AbilityDefinition) {
    save(upsertAbility(content, ability));
  }
  function onDeleteAbility(id: string) {
    save(deleteAbility(content, id));
  }

  // Role stats
  function onSaveRoleStats(roleStats: Partial<Record<Role, BaseStats>>) {
    save({ ...content, roleStats });
  }

  // Gacha config
  function onSaveGachaConfig(config: GachaConfig) {
    save({ ...content, gachaConfig: config });
  }
  function onSaveDailyDungeon(id: string) {
    save({ ...content, dailyDungeonId: id });
  }
  function onSaveSchedule(schedule: Record<string, string>) {
    save({ ...content, dailyDungeonSchedule: schedule });
  }

  // Data management
  function handleExport() {
    exportContentAsJson(content);
    showStatus('Exported!');
  }

  function handleImport() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const result = parseImportedJson(text);
      if (typeof result === 'string') {
        importError = result;
      } else {
        importError = '';
        save(result);
        showStatus('Imported!');
      }
    };
    input.click();
  }

  function handleReset() {
    if (confirm('Reset ALL content to defaults? This cannot be undone.')) {
      content = resetToDefaults();
      showStatus('Reset to defaults');
    }
  }

  // Publish online
  async function handlePublish() {
    let token = getGitHubToken();
    if (!token) {
      showTokenInput = true;
      return;
    }
    await doPublish(token);
  }

  function handleTokenSubmit() {
    if (!tokenInput.trim()) return;
    setGitHubToken(tokenInput.trim());
    showTokenInput = false;
    doPublish(tokenInput.trim());
    tokenInput = '';
  }

  async function doPublish(token: string) {
    isPublishing = true;
    publishError = '';
    const result = await publishContentOnline(content, token);
    isPublishing = false;
    if (result.success) {
      content = { ...content, publishedAt: result.publishedAt };
      saveContent(content);
      showStatus('Publie en ligne !');
    } else {
      publishError = result.error;
    }
  }

  const tabs: { key: Tab; label: string; count: () => number }[] = [
    { key: 'characters', label: 'Characters', count: () => content.characters.length },
    { key: 'enemies', label: 'Enemies', count: () => content.enemies.length },
    { key: 'dungeons', label: 'Dungeons', count: () => content.dungeons.length },
    { key: 'spells', label: 'Spells', count: () => content.abilities.length },
    { key: 'roles', label: 'Roles', count: () => 0 },
    { key: 'gacha', label: 'Gacha', count: () => content.gachaConfig?.characterPool.length ?? 0 },
    { key: 'data', label: 'Data', count: () => 0 },
  ];
</script>

<div class="max-w-4xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Content Admin</h1>
    <div class="flex gap-2">
      <button
        onclick={() => onNavigate('demo')}
        class="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs"
      >
        Battle Demo
      </button>
      <button
        onclick={() => onNavigate('dungeon-test')}
        class="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs"
      >
        Dungeon Test
      </button>
      <button
        onclick={() => onNavigate('player')}
        class="px-3 py-2 bg-amber-700 hover:bg-amber-600 rounded text-xs font-bold"
      >
        Player
      </button>
    </div>
  </div>

  <!-- Status bar -->
  {#if statusMessage}
    <div class="mb-4 px-3 py-2 bg-green-900 rounded text-green-300 text-sm text-center">
      {statusMessage}
    </div>
  {/if}

  <!-- Tabs -->
  <div class="flex gap-1 mb-6 border-b border-slate-700 pb-1 overflow-x-auto">
    {#each tabs as tab}
      <button
        onclick={() => (activeTab = tab.key)}
        class="px-3 py-2 rounded-t text-sm font-medium transition-colors whitespace-nowrap
          {activeTab === tab.key
            ? 'bg-slate-700 text-white'
            : 'text-gray-400 hover:text-gray-300 hover:bg-slate-800'}"
      >
        {tab.label}
        {#if tab.count() > 0}
          <span class="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-600">
            {tab.count()}
          </span>
        {/if}
      </button>
    {/each}
  </div>

  <!-- Tab Content -->
  {#if activeTab === 'characters'}
    <CharacterEditor
      characters={content.characters}
      abilities={content.abilities}
      onSave={onSaveCharacter}
      onDelete={onDeleteCharacter}
    />
  {:else if activeTab === 'enemies'}
    <EnemyEditor
      enemies={content.enemies}
      abilities={content.abilities}
      onSave={onSaveEnemy}
      onDelete={onDeleteEnemy}
    />
  {:else if activeTab === 'dungeons'}
    <DungeonEditor
      dungeons={content.dungeons}
      enemies={content.enemies}
      dailyDungeonId={content.dailyDungeonId}
      dailyDungeonSchedule={content.dailyDungeonSchedule}
      onSave={onSaveDungeon}
      onDelete={onDeleteDungeon}
      onSaveDailyDungeon={onSaveDailyDungeon}
      onSaveSchedule={onSaveSchedule}
    />
  {:else if activeTab === 'spells'}
    <SpellEditor
      abilities={content.abilities}
      onSave={onSaveAbility}
      onDelete={onDeleteAbility}
    />
  {:else if activeTab === 'roles'}
    <RolesReference roleStats={content.roleStats} {onSaveRoleStats} />
  {:else if activeTab === 'gacha'}
    <GachaConfigEditor
      characters={content.characters}
      gachaConfig={content.gachaConfig}
      onSave={onSaveGachaConfig}
    />
  {:else if activeTab === 'data'}
    <div class="space-y-6">
      <!-- Summary -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3">Content Summary</h3>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-blue-400">{content.characters.length}</div>
            <div class="text-xs text-gray-400">Characters</div>
          </div>
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-red-400">{content.enemies.length}</div>
            <div class="text-xs text-gray-400">Enemies</div>
          </div>
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-amber-400">{content.dungeons.length}</div>
            <div class="text-xs text-gray-400">Dungeons</div>
          </div>
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-purple-400">{content.abilities.length}</div>
            <div class="text-xs text-gray-400">Spells</div>
          </div>
        </div>
      </div>

      <!-- Publish Online -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3">Publier en ligne</h3>
        <p class="text-gray-400 text-sm mb-3">
          Publie le contenu sur le site. Les joueurs recevront automatiquement la mise a jour.
        </p>

        {#if content.publishedAt}
          <p class="text-xs text-gray-500 mb-3">
            Derniere publication : {new Date(content.publishedAt).toLocaleString()}
          </p>
        {/if}

        {#if showTokenInput}
          <div class="flex gap-2 mb-3">
            <input
              type="password"
              bind:value={tokenInput}
              placeholder="GitHub Personal Access Token"
              class="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm
                focus:outline-none focus:border-amber-500"
            />
            <button
              onclick={handleTokenSubmit}
              class="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm font-bold"
            >
              OK
            </button>
            <button
              onclick={() => { showTokenInput = false; }}
              class="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
            >
              Annuler
            </button>
          </div>
          <p class="text-xs text-gray-500 mb-3">
            Token GitHub avec permission "Contents: Read and write" sur le repo.
          </p>
        {:else}
          <button
            onclick={handlePublish}
            disabled={isPublishing}
            class="px-4 py-2 bg-amber-700 hover:bg-amber-600 disabled:bg-slate-600 disabled:cursor-wait rounded text-sm font-bold"
          >
            {isPublishing ? 'Publication...' : 'Publier en ligne'}
          </button>
        {/if}

        {#if publishError}
          <div class="mt-3 px-3 py-2 bg-red-900 rounded text-red-300 text-sm">
            {publishError}
          </div>
        {/if}
      </div>

      <!-- Actions -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3">Data Management</h3>
        <div class="flex flex-wrap gap-3">
          <button
            onclick={handleExport}
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold"
          >
            Export JSON
          </button>

          <button
            onclick={handleImport}
            class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-sm font-bold"
          >
            Import JSON
          </button>

          <button
            onclick={handleReset}
            class="px-4 py-2 bg-red-800 hover:bg-red-700 rounded text-sm font-bold"
          >
            Reset to Defaults
          </button>
        </div>

        {#if importError}
          <div class="mt-3 px-3 py-2 bg-red-900 rounded text-red-300 text-sm">
            {importError}
          </div>
        {/if}
      </div>

      <!-- Raw JSON Preview -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3">Raw JSON Preview</h3>
        <pre class="bg-slate-900 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
{JSON.stringify(content, null, 2)}
        </pre>
      </div>
    </div>
  {/if}
</div>
