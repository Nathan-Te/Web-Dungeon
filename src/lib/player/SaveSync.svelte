<script lang="ts">
  import { exportSyncCode, importSyncCode, savePlayerSave, type PlayerSave } from './playerStore';

  interface Props {
    playerSave: PlayerSave;
    onImport: (save: PlayerSave) => void;
    onReset: () => void;
  }

  let { playerSave, onImport, onReset }: Props = $props();

  // Sync code
  let syncCode = $state('');
  let importCode = $state('');
  let importError = $state('');
  let importSuccess = $state(false);
  let copied = $state(false);

  // JSON
  let jsonExport = $state('');
  let jsonImportText = $state('');
  let jsonError = $state('');
  let jsonSuccess = $state(false);
  let jsonCopied = $state(false);

  function handleExportSync() {
    syncCode = exportSyncCode(playerSave);
    importCode = '';
    importError = '';
    importSuccess = false;
  }

  function handleCopySync() {
    navigator.clipboard.writeText(syncCode);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function handleImportSync() {
    importError = '';
    importSuccess = false;
    const result = importSyncCode(importCode);
    if (typeof result === 'string') {
      importError = result;
    } else {
      if (!confirm('Remplacer votre sauvegarde actuelle ? Cette action est irréversible.')) return;
      savePlayerSave(result);
      importSuccess = true;
      importCode = '';
      onImport(result);
    }
  }

  function handleExportJson() {
    jsonExport = JSON.stringify(playerSave, null, 2);
    jsonImportText = '';
    jsonError = '';
    jsonSuccess = false;
  }

  function handleCopyJson() {
    navigator.clipboard.writeText(jsonExport);
    jsonCopied = true;
    setTimeout(() => (jsonCopied = false), 2000);
  }

  function handleDownloadJson() {
    const blob = new Blob([JSON.stringify(playerSave, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dungeon-gacha-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportJson() {
    jsonError = '';
    jsonSuccess = false;
    try {
      const trimmed = jsonImportText.trim();
      if (!trimmed) { jsonError = 'Texte vide'; return; }
      const parsed = JSON.parse(trimmed);
      if (typeof parsed.version !== 'number' || !Array.isArray(parsed.collection) || !parsed.daily) {
        jsonError = 'Format de sauvegarde invalide';
        return;
      }
      if (!confirm('Remplacer votre sauvegarde actuelle ? Cette action est irréversible.')) return;
      savePlayerSave(parsed);
      jsonSuccess = true;
      jsonImportText = '';
      onImport(parsed);
    } catch {
      jsonError = 'JSON invalide';
    }
  }

  function handleFileImport(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      jsonImportText = reader.result as string;
    };
    reader.readAsText(file);
    input.value = '';
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-gray-300 text-center">Sauvegarde</h2>

  <!-- Sync Code Section -->
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
    <h3 class="font-bold text-sm text-amber-400">Synchronisation multi-appareils</h3>
    <p class="text-xs text-gray-400">
      Exportez votre sauvegarde sous forme de code compact, puis importez-le sur un autre appareil.
    </p>

    <!-- Export Sync -->
    <button
      onclick={handleExportSync}
      class="px-4 py-2 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold w-full sm:w-auto"
    >
      Générer le code de sync
    </button>

    {#if syncCode}
      <div class="relative">
        <textarea
          readonly
          value={syncCode}
          rows={3}
          class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-none"
        ></textarea>
        <button
          onclick={handleCopySync}
          class="absolute top-1 right-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
        >
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
    {/if}

    <!-- Import Sync -->
    <div class="border-t border-slate-700 pt-3 space-y-2">
      <label for="import-sync-code" class="block text-xs text-gray-300 font-bold">Importer un code de sync</label>
      <textarea
        id="import-sync-code"
        bind:value={importCode}
        rows={3}
        placeholder="Collez le code de synchronisation ici..."
        class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-none focus:outline-none focus:border-amber-500"
      ></textarea>
      <button
        onclick={handleImportSync}
        disabled={!importCode.trim()}
        class="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded text-xs font-bold"
      >
        Importer
      </button>
      {#if importError}
        <div class="px-3 py-2 bg-red-900/50 rounded text-red-300 text-xs">{importError}</div>
      {/if}
      {#if importSuccess}
        <div class="px-3 py-2 bg-green-900/50 rounded text-green-300 text-xs">Sauvegarde importée avec succès !</div>
      {/if}
    </div>
  </div>

  <!-- JSON Section -->
  <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 space-y-3">
    <h3 class="font-bold text-sm text-cyan-400">Export / Import JSON</h3>
    <p class="text-xs text-gray-400">
      Exportez ou importez votre sauvegarde au format JSON brut pour la sauvegarder sur votre ordinateur.
    </p>

    <!-- Export JSON -->
    <div class="flex gap-2 flex-wrap">
      <button
        onclick={handleExportJson}
        class="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-xs font-bold"
      >
        Afficher le JSON
      </button>
      <button
        onclick={handleDownloadJson}
        class="px-4 py-2 bg-cyan-800 hover:bg-cyan-700 border border-cyan-600 rounded text-xs font-bold"
      >
        Télécharger .json
      </button>
    </div>

    {#if jsonExport}
      <div class="relative">
        <textarea
          readonly
          value={jsonExport}
          rows={8}
          class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-y"
        ></textarea>
        <button
          onclick={handleCopyJson}
          class="absolute top-1 right-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
        >
          {jsonCopied ? 'Copié !' : 'Copier'}
        </button>
      </div>
    {/if}

    <!-- Import JSON -->
    <div class="border-t border-slate-700 pt-3 space-y-2">
      <label for="import-json" class="block text-xs text-gray-300 font-bold">Importer du JSON</label>

      <div class="flex gap-2 flex-wrap items-center">
        <label class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-xs font-bold cursor-pointer border border-slate-600">
          Charger un fichier .json
          <input
            type="file"
            accept=".json,application/json"
            onchange={handleFileImport}
            class="hidden"
          />
        </label>
        <span class="text-[10px] text-gray-500">ou collez le JSON ci-dessous</span>
      </div>

      <textarea
        id="import-json"
        bind:value={jsonImportText}
        rows={6}
        placeholder="Collez le JSON de sauvegarde ici..."
        class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-y focus:outline-none focus:border-cyan-500"
      ></textarea>
      <button
        onclick={handleImportJson}
        disabled={!jsonImportText.trim()}
        class="px-4 py-2 bg-green-700 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded text-xs font-bold"
      >
        Importer le JSON
      </button>
      {#if jsonError}
        <div class="px-3 py-2 bg-red-900/50 rounded text-red-300 text-xs">{jsonError}</div>
      {/if}
      {#if jsonSuccess}
        <div class="px-3 py-2 bg-green-900/50 rounded text-green-300 text-xs">Sauvegarde importée avec succès !</div>
      {/if}
    </div>
  </div>

  <!-- Danger Zone -->
  <div class="bg-slate-800 rounded-lg p-4 border border-red-900/50 space-y-3">
    <h3 class="font-bold text-sm text-red-400">Zone dangereuse</h3>
    <button
      onclick={onReset}
      class="px-4 py-2 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300 font-bold"
    >
      Réinitialiser la sauvegarde
    </button>
    <p class="text-[10px] text-gray-500">Supprime toutes vos données. Cette action est irréversible.</p>
  </div>
</div>
