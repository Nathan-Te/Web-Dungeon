<script lang="ts">
  import { onMount } from 'svelte';
  import type { CharacterDefinition } from '../game/types';
  import type { GameContent, EnemyTemplate, DungeonRoom } from './adminTypes';
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
    upsertRoom,
    deleteRoom,
  } from './contentStore';
  import CharacterEditor from './CharacterEditor.svelte';
  import EnemyEditor from './EnemyEditor.svelte';
  import DungeonEditor from './DungeonEditor.svelte';

  interface Props {
    onNavigate: (page: string) => void;
  }

  let { onNavigate }: Props = $props();

  type Tab = 'characters' | 'enemies' | 'dungeons' | 'data';
  let activeTab: Tab = $state('characters');
  let content: GameContent = $state({ version: 1, characters: [], enemies: [], dungeonRooms: [] });
  let statusMessage = $state('');
  let importError = $state('');

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

  // Room CRUD
  function onSaveRoom(room: DungeonRoom) {
    save(upsertRoom(content, room));
  }
  function onDeleteRoom(id: string) {
    save(deleteRoom(content, id));
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

  const tabs: { key: Tab; label: string; count: () => number }[] = [
    { key: 'characters', label: 'Characters', count: () => content.characters.length },
    { key: 'enemies', label: 'Enemies', count: () => content.enemies.length },
    { key: 'dungeons', label: 'Dungeon Rooms', count: () => content.dungeonRooms.length },
    { key: 'data', label: 'Import / Export', count: () => 0 },
  ];
</script>

<div class="max-w-4xl mx-auto p-4">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold">Content Admin</h1>
    <button
      onclick={() => onNavigate('game')}
      class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
    >
      Back to Game
    </button>
  </div>

  <!-- Status bar -->
  {#if statusMessage}
    <div class="mb-4 px-3 py-2 bg-green-900 rounded text-green-300 text-sm text-center">
      {statusMessage}
    </div>
  {/if}

  <!-- Tabs -->
  <div class="flex gap-1 mb-6 border-b border-slate-700 pb-1">
    {#each tabs as tab}
      <button
        onclick={() => (activeTab = tab.key)}
        class="px-4 py-2 rounded-t text-sm font-medium transition-colors
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
      onSave={onSaveCharacter}
      onDelete={onDeleteCharacter}
    />
  {:else if activeTab === 'enemies'}
    <EnemyEditor
      enemies={content.enemies}
      onSave={onSaveEnemy}
      onDelete={onDeleteEnemy}
    />
  {:else if activeTab === 'dungeons'}
    <DungeonEditor
      rooms={content.dungeonRooms}
      enemies={content.enemies}
      onSave={onSaveRoom}
      onDelete={onDeleteRoom}
    />
  {:else if activeTab === 'data'}
    <div class="space-y-6">
      <!-- Summary -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3">Content Summary</h3>
        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-blue-400">{content.characters.length}</div>
            <div class="text-xs text-gray-400">Characters</div>
          </div>
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-red-400">{content.enemies.length}</div>
            <div class="text-xs text-gray-400">Enemies</div>
          </div>
          <div class="bg-slate-900 rounded p-3">
            <div class="text-2xl font-bold text-amber-400">{content.dungeonRooms.length}</div>
            <div class="text-xs text-gray-400">Rooms</div>
          </div>
        </div>
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
