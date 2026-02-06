<script lang="ts">
  import type { Tower, TowerStage, Dungeon } from './adminTypes';
  import { createBlankTower } from './adminTypes';

  interface Props {
    towers: Tower[];
    dungeons: Dungeon[];
    onSave: (tower: Tower) => void;
    onDelete: (id: string) => void;
  }

  let { towers, dungeons, onSave, onDelete }: Props = $props();

  let editingTower: Tower | null = $state(null);
  let searchQuery = $state('');

  let filteredTowers = $derived(
    (() => {
      const q = searchQuery.trim().toLowerCase();
      if (!q) return towers;
      return towers.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q));
    })()
  );

  function startNew() {
    editingTower = createBlankTower();
  }

  function startEdit(tower: Tower) {
    editingTower = {
      ...tower,
      stages: tower.stages.map(s => ({ ...s })),
    };
  }

  function handleSave() {
    if (!editingTower || !editingTower.name.trim()) return;
    onSave(editingTower);
    editingTower = null;
  }

  function handleCancel() {
    editingTower = null;
  }

  function handleDelete(id: string) {
    if (confirm('Supprimer cette tour ?')) {
      onDelete(id);
      if (editingTower?.id === id) editingTower = null;
    }
  }

  // Stage management
  function addStage() {
    if (!editingTower || dungeons.length === 0) return;
    const nextNumber = editingTower.stages.length + 1;
    const stage: TowerStage = {
      stageNumber: nextNumber,
      dungeonId: dungeons[0].id,
    };
    editingTower = {
      ...editingTower,
      stages: [...editingTower.stages, stage],
    };
  }

  function removeStage(index: number) {
    if (!editingTower) return;
    const stages = editingTower.stages
      .filter((_, i) => i !== index)
      .map((s, i) => ({ ...s, stageNumber: i + 1 }));
    editingTower = { ...editingTower, stages };
  }

  function updateStage(index: number, field: keyof TowerStage, value: string | number) {
    if (!editingTower) return;
    const stages = editingTower.stages.map((s, i) =>
      i === index ? { ...s, [field]: value } : s
    );
    editingTower = { ...editingTower, stages };
  }

  function moveStage(index: number, direction: -1 | 1) {
    if (!editingTower) return;
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= editingTower.stages.length) return;
    const stages = [...editingTower.stages];
    [stages[index], stages[newIndex]] = [stages[newIndex], stages[index]];
    // Renumber
    const renumbered = stages.map((s, i) => ({ ...s, stageNumber: i + 1 }));
    editingTower = { ...editingTower, stages: renumbered };
  }

  function getDungeonName(dungeonId: string): string {
    return dungeons.find(d => d.id === dungeonId)?.name ?? 'Unknown';
  }

  function getDungeonRoomCount(dungeonId: string): number {
    return dungeons.find(d => d.id === dungeonId)?.rooms.length ?? 0;
  }
</script>

<div class="space-y-6">
  <!-- Toolbar -->
  <div class="flex items-center justify-between">
    <h2 class="text-lg font-bold text-indigo-400">
      Tours ({towers.length})
    </h2>
    <button
      onclick={startNew}
      class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-bold"
    >
      + Nouvelle Tour
    </button>
  </div>

  <!-- Search -->
  {#if towers.length > 0}
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Rechercher une tour..."
      class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm
        focus:outline-none focus:border-indigo-500"
    />
  {/if}

  <!-- Edit Form -->
  {#if editingTower}
    <div class="bg-slate-800 rounded-lg p-5 border border-indigo-600">
      <h3 class="font-bold mb-4 text-indigo-400">
        {editingTower.id.startsWith('tower_') && !towers.find(t => t.id === editingTower!.id) ? 'Nouvelle Tour' : 'Modifier la Tour'}
      </h3>

      <div class="space-y-4">
        <!-- Name -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Nom</label>
          <input
            type="text"
            bind:value={editingTower.name}
            placeholder="Nom de la tour"
            class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm
              focus:outline-none focus:border-indigo-500"
          />
        </div>

        <!-- Description -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">Description</label>
          <textarea
            bind:value={editingTower.description}
            placeholder="Description..."
            rows="2"
            class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm
              focus:outline-none focus:border-indigo-500 resize-y"
          ></textarea>
        </div>

        <!-- Stages -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="block text-xs text-gray-400">Etages ({editingTower.stages.length})</label>
            <button
              onclick={addStage}
              disabled={dungeons.length === 0}
              class="px-3 py-1 bg-indigo-700 hover:bg-indigo-600 disabled:opacity-40 rounded text-xs font-medium"
            >
              + Etage
            </button>
          </div>

          {#if dungeons.length === 0}
            <div class="text-xs text-red-400 bg-red-900/30 rounded p-3">
              Aucun donjon disponible. Creez des donjons dans l'onglet "Dungeons" d'abord.
            </div>
          {:else if editingTower.stages.length === 0}
            <div class="text-xs text-gray-500 text-center py-4">
              Aucun etage. Cliquez sur "+ Etage" pour en ajouter.
            </div>
          {:else}
            <div class="space-y-2">
              {#each editingTower.stages as stage, index}
                <div class="flex items-center gap-2 bg-slate-900 rounded-lg p-3 border border-slate-700">
                  <!-- Stage number -->
                  <div class="w-8 h-8 rounded flex items-center justify-center text-sm font-bold bg-indigo-900 text-indigo-400 flex-shrink-0">
                    {stage.stageNumber}
                  </div>

                  <!-- Dungeon selector -->
                  <div class="flex-1 min-w-0">
                    <select
                      value={stage.dungeonId}
                      onchange={(e) => updateStage(index, 'dungeonId', (e.target as HTMLSelectElement).value)}
                      class="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-white
                        focus:outline-none focus:border-indigo-500"
                    >
                      {#each dungeons as d}
                        <option value={d.id}>{d.name} ({d.rooms.length} salles)</option>
                      {/each}
                    </select>
                    <!-- Optional name override -->
                    <input
                      type="text"
                      value={stage.name ?? ''}
                      oninput={(e) => updateStage(index, 'name', (e.target as HTMLInputElement).value || undefined as any)}
                      placeholder="Nom personnalise (optionnel)"
                      class="w-full mt-1 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-gray-300
                        focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <!-- Move buttons -->
                  <div class="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onclick={() => moveStage(index, -1)}
                      disabled={index === 0}
                      class="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs"
                    >
                      &uarr;
                    </button>
                    <button
                      onclick={() => moveStage(index, 1)}
                      disabled={index === editingTower!.stages.length - 1}
                      class="px-1.5 py-0.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-xs"
                    >
                      &darr;
                    </button>
                  </div>

                  <!-- Delete -->
                  <button
                    onclick={() => removeStage(index)}
                    class="px-2 py-1 bg-red-900 hover:bg-red-800 rounded text-xs text-red-300 flex-shrink-0"
                  >
                    &times;
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-2">
          <button
            onclick={handleSave}
            disabled={!editingTower.name.trim()}
            class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 rounded text-sm font-bold"
          >
            Sauvegarder
          </button>
          <button
            onclick={handleCancel}
            class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Tower List -->
  {#if filteredTowers.length === 0 && towers.length === 0}
    <div class="text-center text-gray-500 py-8 text-sm">
      Aucune tour. Cliquez sur "+ Nouvelle Tour" pour en creer une.
    </div>
  {:else if filteredTowers.length === 0}
    <div class="text-center text-gray-500 py-4 text-sm">
      Aucun resultat pour "{searchQuery}"
    </div>
  {:else}
    <div class="space-y-3">
      {#each filteredTowers as tower}
        <div class="bg-slate-800 rounded-lg p-4 border border-slate-700 hover:border-indigo-600/50 transition-colors">
          <div class="flex items-start justify-between">
            <div class="flex-1 min-w-0">
              <h3 class="font-bold text-indigo-400">{tower.name || '(sans nom)'}</h3>
              {#if tower.description}
                <p class="text-xs text-gray-400 mt-0.5">{tower.description}</p>
              {/if}
              <div class="text-xs text-gray-500 mt-1">
                {tower.stages.length} etage{tower.stages.length !== 1 ? 's' : ''}
              </div>
              <!-- Stage preview -->
              {#if tower.stages.length > 0}
                <div class="flex flex-wrap gap-1 mt-2">
                  {#each tower.stages.slice(0, 8) as stage}
                    <span class="px-2 py-0.5 bg-slate-900 rounded text-[10px] text-gray-400 border border-slate-700">
                      {stage.stageNumber}. {stage.name ?? getDungeonName(stage.dungeonId)}
                      <span class="text-gray-600">({getDungeonRoomCount(stage.dungeonId)}r)</span>
                    </span>
                  {/each}
                  {#if tower.stages.length > 8}
                    <span class="px-2 py-0.5 text-[10px] text-gray-500">+{tower.stages.length - 8} de plus</span>
                  {/if}
                </div>
              {/if}
            </div>
            <div class="flex gap-2 flex-shrink-0 ml-3">
              <button
                onclick={() => startEdit(tower)}
                class="px-3 py-1.5 bg-indigo-900 hover:bg-indigo-800 border border-indigo-600 rounded text-xs font-medium text-indigo-300"
              >
                Modifier
              </button>
              <button
                onclick={() => handleDelete(tower.id)}
                class="px-3 py-1.5 bg-red-900 hover:bg-red-800 border border-red-700 rounded text-xs text-red-300"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
