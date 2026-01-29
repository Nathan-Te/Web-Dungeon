<script lang="ts">
  import type { EnemyTemplate, DungeonRoom, Dungeon } from './adminTypes';
  import { createBlankDungeon, createBlankRoom, generateId } from './adminTypes';

  interface Props {
    dungeons: Dungeon[];
    enemies: EnemyTemplate[];
    onSave: (dungeon: Dungeon) => void;
    onDelete: (id: string) => void;
  }

  let { dungeons, enemies, onSave, onDelete }: Props = $props();

  let editingDungeon: Dungeon | null = $state(null);
  let editingRoomIndex: number | null = $state(null);

  function startNewDungeon() {
    editingDungeon = createBlankDungeon();
    editingRoomIndex = null;
  }

  function startEditDungeon(dungeon: Dungeon) {
    editingDungeon = {
      ...dungeon,
      rooms: dungeon.rooms.map((r) => ({
        ...r,
        enemies: r.enemies.map((e) => ({ ...e })),
      })),
    };
    editingRoomIndex = null;
  }

  function handleSaveDungeon() {
    if (!editingDungeon || !editingDungeon.name.trim()) return;
    onSave(editingDungeon);
    editingDungeon = null;
    editingRoomIndex = null;
  }

  function handleCancel() {
    editingDungeon = null;
    editingRoomIndex = null;
  }

  function handleDeleteDungeon(id: string) {
    if (confirm('Delete this dungeon and all its rooms?')) {
      onDelete(id);
      if (editingDungeon?.id === id) {
        editingDungeon = null;
        editingRoomIndex = null;
      }
    }
  }

  // --- Room management within editing dungeon ---

  function addRoom() {
    if (!editingDungeon) return;
    const nextNum = editingDungeon.rooms.length + 1;
    const room = createBlankRoom(nextNum);
    editingDungeon = {
      ...editingDungeon,
      rooms: [...editingDungeon.rooms, room],
    };
    editingRoomIndex = editingDungeon.rooms.length - 1;
  }

  function removeRoom(index: number) {
    if (!editingDungeon) return;
    const rooms = editingDungeon.rooms.filter((_, i) => i !== index).map((r, i) => ({
      ...r,
      roomNumber: i + 1,
      name: r.name.match(/^Room \d+$/) ? `Room ${i + 1}` : r.name,
    }));
    editingDungeon = { ...editingDungeon, rooms };
    if (editingRoomIndex === index) editingRoomIndex = null;
    else if (editingRoomIndex !== null && editingRoomIndex > index) editingRoomIndex--;
  }

  function selectRoom(index: number) {
    editingRoomIndex = editingRoomIndex === index ? null : index;
  }

  function updateRoom(index: number, room: DungeonRoom) {
    if (!editingDungeon) return;
    const rooms = editingDungeon.rooms.map((r, i) => (i === index ? room : r));
    editingDungeon = { ...editingDungeon, rooms };
  }

  function addEnemyToRoom(roomIndex: number, enemyId: string) {
    if (!editingDungeon) return;
    const room = editingDungeon.rooms[roomIndex];
    if (room.enemies.length >= 5) return;
    updateRoom(roomIndex, {
      ...room,
      enemies: [...room.enemies, { enemyTemplateId: enemyId }],
    });
  }

  function removeEnemyFromRoom(roomIndex: number, enemyIndex: number) {
    if (!editingDungeon) return;
    const room = editingDungeon.rooms[roomIndex];
    updateRoom(roomIndex, {
      ...room,
      enemies: room.enemies.filter((_, i) => i !== enemyIndex),
    });
  }

  function getEnemyName(templateId: string): string {
    return enemies.find((e) => e.id === templateId)?.name ?? '(unknown)';
  }

  function getEnemyRole(templateId: string): string {
    return enemies.find((e) => e.id === templateId)?.role ?? '???';
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex gap-3 items-center">
    <button
      onclick={startNewDungeon}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Dungeon
    </button>
    <span class="text-gray-400 text-sm">{dungeons.length} dungeons</span>
  </div>

  <!-- Dungeon Edit Form -->
  {#if editingDungeon}
    <div class="bg-slate-800 rounded-lg p-4 border border-amber-800">
      <h3 class="font-bold mb-3 text-amber-400">
        {dungeons.some((d) => d.id === editingDungeon?.id) ? 'Edit' : 'New'} Dungeon
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <div>
          <span class="block text-xs text-gray-400 mb-1">Name</span>
          <input
            type="text"
            bind:value={editingDungeon.name}
            placeholder="Dungeon name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <span class="block text-xs text-gray-400 mb-1">Description</span>
          <input
            type="text"
            bind:value={editingDungeon.description}
            placeholder="Short description"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      </div>

      <!-- Rooms list -->
      <div class="mb-3">
        <div class="flex items-center justify-between mb-2">
          <span class="text-xs text-gray-400 font-bold">
            Rooms ({editingDungeon.rooms.length})
          </span>
          <button
            onclick={addRoom}
            class="px-3 py-1 bg-amber-700 hover:bg-amber-600 rounded text-xs font-bold"
          >
            + Add Room
          </button>
        </div>

        {#if editingDungeon.rooms.length === 0}
          <p class="text-gray-500 text-xs py-2">No rooms yet. Add rooms to build your dungeon.</p>
        {:else}
          <div class="space-y-1">
            {#each editingDungeon.rooms as room, i}
              <div class="bg-slate-900 rounded overflow-hidden">
                <!-- Room header (clickable) -->
                <button
                  onclick={() => selectRoom(i)}
                  class="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-800 transition-colors text-left"
                >
                  <span class="w-6 h-6 flex items-center justify-center rounded text-xs font-bold
                    {room.isBoss ? 'bg-red-800 text-red-200' : 'bg-slate-700 text-gray-300'}">
                    {room.roomNumber}
                  </span>
                  <span class="flex-1 text-sm font-medium">
                    {room.name}
                    {#if room.isBoss}
                      <span class="text-xs text-red-400 ml-1">BOSS</span>
                    {/if}
                  </span>
                  <span class="text-xs text-gray-500">x{room.difficultyMult.toFixed(1)}</span>
                  <span class="text-xs text-gray-400">{room.enemies.length}/5</span>
                  <span class="text-xs text-gray-600">{editingRoomIndex === i ? '▼' : '▶'}</span>
                </button>
                <span
                  role="button"
                  tabindex="0"
                  onclick={(e) => { e.stopPropagation(); removeRoom(i); }}
                  onkeydown={(e) => { if (e.key === 'Enter') removeRoom(i); }}
                  class="px-1.5 py-0.5 text-xs bg-red-900 hover:bg-red-800 rounded cursor-pointer"
                >
                  ✕
                </span>

                <!-- Room detail (expanded) -->
                {#if editingRoomIndex === i}
                  <div class="px-3 pb-3 border-t border-slate-700 pt-2 space-y-2">
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <span class="block text-xs text-gray-400 mb-0.5">Name</span>
                        <input
                          type="text"
                          value={room.name}
                          oninput={(e) => updateRoom(i, { ...room, name: e.currentTarget.value })}
                          class="w-full px-2 py-1 bg-slate-700 rounded text-xs"
                        />
                      </div>
                      <div>
                        <span class="block text-xs text-gray-400 mb-0.5">Difficulty</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.5"
                          max="5"
                          value={room.difficultyMult}
                          oninput={(e) => updateRoom(i, { ...room, difficultyMult: parseFloat(e.currentTarget.value) || 1 })}
                          class="w-full px-2 py-1 bg-slate-700 rounded text-xs"
                        />
                      </div>
                      <div class="flex items-end gap-1 pb-0.5">
                        <input
                          type="checkbox"
                          checked={room.isBoss}
                          onchange={(e) => updateRoom(i, { ...room, isBoss: e.currentTarget.checked })}
                          class="w-3.5 h-3.5"
                        />
                        <span class="text-xs text-gray-400">Boss</span>
                      </div>
                    </div>

                    <!-- Enemies in room -->
                    <div>
                      <span class="block text-xs text-gray-400 mb-1">
                        Enemies ({room.enemies.length}/5)
                      </span>
                      {#if room.enemies.length > 0}
                        <div class="space-y-0.5 mb-2">
                          {#each room.enemies as roomEnemy, ei}
                            <div class="flex items-center gap-2 px-2 py-1 bg-slate-800 rounded text-xs">
                              <span class="text-gray-500 w-3">{ei + 1}.</span>
                              <span class="capitalize text-gray-400 w-14">{getEnemyRole(roomEnemy.enemyTemplateId)}</span>
                              <span class="flex-1 text-red-300">{getEnemyName(roomEnemy.enemyTemplateId)}</span>
                              <button
                                onclick={() => removeEnemyFromRoom(i, ei)}
                                class="text-red-500 hover:text-red-400"
                              >
                                ✕
                              </button>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      {#if room.enemies.length < 5}
                        {#if enemies.length > 0}
                          <div class="flex gap-1 flex-wrap">
                            {#each enemies as enemy (enemy.id)}
                              <button
                                onclick={() => addEnemyToRoom(i, enemy.id)}
                                class="px-2 py-0.5 text-xs bg-red-900 hover:bg-red-800 rounded"
                              >
                                + {enemy.name}
                              </button>
                            {/each}
                          </div>
                        {:else}
                          <p class="text-gray-500 text-xs">Create enemy templates first (Enemies tab)</p>
                        {/if}
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex gap-2">
        <button
          onclick={handleSaveDungeon}
          disabled={!editingDungeon.name.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-bold"
        >
          Save Dungeon
        </button>
        <button
          onclick={handleCancel}
          class="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Dungeon List -->
  <div class="space-y-2">
    {#each dungeons as dungeon (dungeon.id)}
      <div class="px-4 py-3 bg-slate-800 rounded group">
        <div class="flex items-center gap-3">
          <span class="flex-1">
            <span class="font-medium">{dungeon.name}</span>
            {#if dungeon.description}
              <span class="text-xs text-gray-500 ml-2">{dungeon.description}</span>
            {/if}
          </span>

          <span class="text-xs text-amber-400">{dungeon.rooms.length} rooms</span>

          <span class="text-xs text-gray-500">
            {dungeon.rooms.reduce((n, r) => n + r.enemies.length, 0)} enemies total
          </span>

          <button
            onclick={() => startEditDungeon(dungeon)}
            class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded opacity-60 group-hover:opacity-100"
          >
            Edit
          </button>
          <button
            onclick={() => handleDeleteDungeon(dungeon.id)}
            class="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded opacity-60 group-hover:opacity-100"
          >
            Del
          </button>
        </div>

        {#if dungeon.rooms.length > 0}
          <div class="mt-2 flex gap-2 flex-wrap">
            {#each dungeon.rooms as room, i}
              <span class="text-xs px-2 py-0.5 rounded
                {room.isBoss ? 'bg-red-900 text-red-300' : 'bg-slate-700 text-gray-300'}">
                {room.roomNumber}. {room.name} ({room.enemies.length} en.)
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if dungeons.length === 0}
    <p class="text-gray-500 text-center py-8">No dungeons. Create a dungeon and fill it with rooms!</p>
  {/if}
</div>
