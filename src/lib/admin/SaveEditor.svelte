<script lang="ts">
  import type { CharacterDefinition } from '../game/types';
  import {
    importSyncCode,
    exportSyncCode,
    type PlayerSave,
    type OwnedCharacter,
  } from '../player/playerStore';

  interface Props {
    characters: CharacterDefinition[];
  }

  let { characters }: Props = $props();

  let inputCode = $state('');
  let save: PlayerSave | null = $state(null);
  let error = $state('');
  let copied = $state(false);

  function handleImport() {
    error = '';
    const result = importSyncCode(inputCode);
    if (typeof result === 'string') {
      error = result;
    } else {
      save = result;
    }
  }

  function handleExport(): string {
    if (!save) return '';
    return exportSyncCode(save);
  }

  function handleCopyExport() {
    const code = handleExport();
    if (code) {
      navigator.clipboard.writeText(code);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function getCharName(charId: string): string {
    return characters.find(c => c.id === charId)?.name ?? charId;
  }

  // --- Collection editing ---
  function updateChar(index: number, field: keyof OwnedCharacter, value: number | string) {
    if (!save) return;
    const updated = [...save.collection];
    updated[index] = { ...updated[index], [field]: value };
    save = { ...save, collection: updated };
  }

  function removeChar(index: number) {
    if (!save) return;
    save = { ...save, collection: save.collection.filter((_, i) => i !== index) };
  }

  function addChar() {
    if (!save) return;
    save = {
      ...save,
      collection: [...save.collection, { characterId: '', level: 1, ascension: 0, duplicates: 0, xp: 0 }],
    };
  }

  // --- Daily editing ---
  function updateDaily(field: string, value: string | number | boolean) {
    if (!save) return;
    save = { ...save, daily: { ...save.daily, [field]: value } };
  }

  // --- Pity editing ---
  function updatePity(rarity: string, value: number) {
    if (!save) return;
    save = { ...save, pityCounters: { ...(save.pityCounters ?? {}), [rarity]: value } };
  }

  // --- Expedition editing ---
  function removeExpedition(index: number) {
    if (!save) return;
    const exps = (save.expeditions ?? []).filter((_, i) => i !== index);
    save = { ...save, expeditions: exps.length > 0 ? exps : undefined };
  }
</script>

<div class="space-y-6">
  <!-- Import -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3">Importer une sauvegarde</h3>
    <p class="text-xs text-gray-400 mb-3">
      Collez le code de synchronisation exporte par un joueur.
    </p>
    <div class="flex gap-2">
      <textarea
        bind:value={inputCode}
        rows={3}
        placeholder="Code de sauvegarde base64..."
        class="flex-1 px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-none
          focus:outline-none focus:border-amber-500"
      ></textarea>
    </div>
    <div class="flex gap-2 mt-3">
      <button
        onclick={handleImport}
        disabled={!inputCode.trim()}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed rounded text-sm font-bold"
      >
        Charger
      </button>
      {#if save}
        <button
          onclick={() => { save = null; inputCode = ''; error = ''; }}
          class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          Fermer
        </button>
      {/if}
    </div>
    {#if error}
      <div class="mt-2 px-3 py-2 bg-red-900 rounded text-red-300 text-xs">{error}</div>
    {/if}
  </div>

  {#if save}
    <!-- Export -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3">Exporter</h3>
      <button
        onclick={handleCopyExport}
        class="px-4 py-2 bg-green-700 hover:bg-green-600 rounded text-sm font-bold"
      >
        {copied ? 'Copie !' : 'Copier le code modifie'}
      </button>
    </div>

    <!-- Summary -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3">Resume</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-sm">
        <div class="bg-slate-900 rounded p-2">
          <div class="text-lg font-bold text-blue-400">{save.collection.length}</div>
          <div class="text-xs text-gray-400">Personnages</div>
        </div>
        <div class="bg-slate-900 rounded p-2">
          <div class="text-lg font-bold text-yellow-400">{save.daily.gachaPullsRemaining}</div>
          <div class="text-xs text-gray-400">Tirages restants</div>
        </div>
        <div class="bg-slate-900 rounded p-2">
          <div class="text-lg font-bold text-amber-400">{save.daily.dungeonAttemptsLeft}/3</div>
          <div class="text-xs text-gray-400">Tentatives donjon</div>
        </div>
        <div class="bg-slate-900 rounded p-2">
          <div class="text-lg font-bold text-emerald-400">{(save.expeditions ?? []).length}</div>
          <div class="text-xs text-gray-400">Expeditions</div>
        </div>
      </div>
    </div>

    <!-- Daily State -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3 text-amber-400">Etat quotidien</h3>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Date</label>
          <input
            type="date"
            value={save.daily.date}
            oninput={(e) => updateDaily('date', e.currentTarget.value)}
            class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Tirages gacha</label>
          <input
            type="number"
            min="0"
            value={save.daily.gachaPullsRemaining}
            oninput={(e) => updateDaily('gachaPullsRemaining', parseInt(e.currentTarget.value) || 0)}
            class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Tentatives donjon</label>
          <input
            type="number"
            min="0"
            max="3"
            value={save.daily.dungeonAttemptsLeft}
            oninput={(e) => updateDaily('dungeonAttemptsLeft', parseInt(e.currentTarget.value) || 0)}
            class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <label class="block text-xs text-gray-400 mb-1">Donjon complete</label>
          <select
            value={save.daily.dungeonCleared ? 'true' : 'false'}
            onchange={(e) => updateDaily('dungeonCleared', e.currentTarget.value === 'true')}
            class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
          >
            <option value="false">Non</option>
            <option value="true">Oui</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Pity Counters -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3 text-orange-400">Compteurs de pity</h3>
      <div class="grid grid-cols-2 gap-3">
        {#each ['epic', 'legendary'] as rarity}
          <div>
            <label class="block text-xs text-gray-400 mb-1 capitalize">{rarity}</label>
            <input
              type="number"
              min="0"
              value={save.pityCounters?.[rarity] ?? 0}
              oninput={(e) => updatePity(rarity, parseInt(e.currentTarget.value) || 0)}
              class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
            />
            <span class="text-xs text-gray-500">tirages sans {rarity}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Collection -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3 text-blue-400">
        Collection ({save.collection.length} personnages)
      </h3>

      {#if save.collection.length > 0}
        <div class="space-y-2 mb-3">
          <div class="grid grid-cols-[1fr_60px_60px_60px_60px_40px] gap-2 text-xs text-gray-400 font-bold px-1">
            <span>Personnage</span>
            <span>Niv.</span>
            <span>Asc.</span>
            <span>Dupl.</span>
            <span>XP</span>
            <span></span>
          </div>
          {#each save.collection as char, i}
            <div class="grid grid-cols-[1fr_60px_60px_60px_60px_40px] gap-2 items-center bg-slate-900 rounded p-1">
              <select
                value={char.characterId}
                onchange={(e) => updateChar(i, 'characterId', e.currentTarget.value)}
                class="px-2 py-1 bg-slate-700 rounded text-xs truncate"
              >
                <option value="">-- choisir --</option>
                {#each characters as c}
                  <option value={c.id}>{c.name} ({c.rarity})</option>
                {/each}
              </select>
              <input
                type="number" min="1" max="99"
                value={char.level}
                oninput={(e) => updateChar(i, 'level', parseInt(e.currentTarget.value) || 1)}
                class="px-1 py-1 bg-slate-700 rounded text-xs text-center"
              />
              <input
                type="number" min="0" max="6"
                value={char.ascension}
                oninput={(e) => updateChar(i, 'ascension', parseInt(e.currentTarget.value) || 0)}
                class="px-1 py-1 bg-slate-700 rounded text-xs text-center"
              />
              <input
                type="number" min="0"
                value={char.duplicates}
                oninput={(e) => updateChar(i, 'duplicates', parseInt(e.currentTarget.value) || 0)}
                class="px-1 py-1 bg-slate-700 rounded text-xs text-center"
              />
              <input
                type="number" min="0"
                value={char.xp}
                oninput={(e) => updateChar(i, 'xp', parseInt(e.currentTarget.value) || 0)}
                class="px-1 py-1 bg-slate-700 rounded text-xs text-center"
              />
              <button
                onclick={() => removeChar(i)}
                class="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs"
              >
                X
              </button>
            </div>
          {/each}
        </div>
      {:else}
        <p class="text-xs text-gray-500 mb-3 italic">Aucun personnage dans la collection.</p>
      {/if}

      <button
        onclick={addChar}
        class="px-3 py-1 bg-blue-800 hover:bg-blue-700 rounded text-xs"
      >
        + Ajouter un personnage
      </button>
    </div>

    <!-- Expeditions -->
    {#if (save.expeditions ?? []).length > 0}
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold mb-3 text-emerald-400">
          Expeditions actives ({(save.expeditions ?? []).length})
        </h3>
        <div class="space-y-2">
          {#each save.expeditions ?? [] as exp, i}
            <div class="flex items-center justify-between bg-slate-900 rounded p-2">
              <div class="text-xs">
                <span class="text-gray-300">{exp.duration}h</span>
                <span class="text-gray-500 ml-2">
                  {exp.teamCharacterIds.map(id => getCharName(id)).join(', ')}
                </span>
                <span class="text-gray-600 ml-2">
                  {new Date(exp.completesAt).toLocaleString()}
                </span>
              </div>
              <button
                onclick={() => removeExpedition(i)}
                class="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs"
              >
                X
              </button>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <!-- Raw JSON -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3">JSON brut</h3>
      <pre class="bg-slate-900 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
{JSON.stringify(save, null, 2)}
      </pre>
    </div>
  {/if}
</div>
