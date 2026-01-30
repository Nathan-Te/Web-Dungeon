<script lang="ts">
  import { exportSyncCode, importSyncCode, savePlayerSave, type PlayerSave } from './playerStore';

  interface Props {
    playerSave: PlayerSave;
    onImport: (save: PlayerSave) => void;
  }

  let { playerSave, onImport }: Props = $props();

  let showSync = $state(false);
  let syncCode = $state('');
  let importCode = $state('');
  let importError = $state('');
  let importSuccess = $state(false);
  let copied = $state(false);

  function handleExport() {
    syncCode = exportSyncCode(playerSave);
    importCode = '';
    importError = '';
    importSuccess = false;
  }

  function handleCopy() {
    navigator.clipboard.writeText(syncCode);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }

  function handleImport() {
    importError = '';
    importSuccess = false;
    const result = importSyncCode(importCode);
    if (typeof result === 'string') {
      importError = result;
    } else {
      if (!confirm('Remplacer votre sauvegarde actuelle ? Cette action est irreversible.')) return;
      savePlayerSave(result);
      importSuccess = true;
      importCode = '';
      onImport(result);
    }
  }
</script>

<div class="mt-4">
  <button
    onclick={() => { showSync = !showSync; syncCode = ''; importCode = ''; importError = ''; importSuccess = false; }}
    class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-gray-300"
  >
    {showSync ? 'Fermer sync' : 'Sync multi-appareils'}
  </button>

  {#if showSync}
    <div class="mt-3 bg-slate-800 rounded-lg p-4 space-y-4 border border-slate-700">
      <h3 class="font-bold text-sm text-amber-400">Synchronisation multi-appareils</h3>
      <p class="text-xs text-gray-400">
        Exportez votre sauvegarde sous forme de code, puis importez-le sur un autre appareil.
      </p>

      <!-- Export -->
      <div class="space-y-2">
        <button
          onclick={handleExport}
          class="px-3 py-1.5 bg-blue-700 hover:bg-blue-600 rounded text-xs font-bold"
        >
          Exporter ma sauvegarde
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
              onclick={handleCopy}
              class="absolute top-1 right-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs"
            >
              {copied ? 'Copie !' : 'Copier'}
            </button>
          </div>
          <p class="text-xs text-gray-500">Copiez ce code et collez-le sur votre autre appareil.</p>
        {/if}
      </div>

      <!-- Import -->
      <div class="space-y-2 border-t border-slate-700 pt-4">
        <label for="import-code" class="block text-xs text-gray-300 font-bold">Importer une sauvegarde</label>
        <textarea
          id="import-code"
          bind:value={importCode}
          rows={3}
          placeholder="Collez le code de synchronisation ici..."
          class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-xs text-gray-300 font-mono resize-none
            focus:outline-none focus:border-amber-500"
        ></textarea>
        <button
          onclick={handleImport}
          disabled={!importCode.trim()}
          class="px-3 py-1.5 bg-green-700 hover:bg-green-600 disabled:bg-slate-600 disabled:cursor-not-allowed rounded text-xs font-bold"
        >
          Importer
        </button>

        {#if importError}
          <div class="px-3 py-2 bg-red-900 rounded text-red-300 text-xs">{importError}</div>
        {/if}
        {#if importSuccess}
          <div class="px-3 py-2 bg-green-900 rounded text-green-300 text-xs">Sauvegarde importee avec succes !</div>
        {/if}
      </div>
    </div>
  {/if}
</div>
