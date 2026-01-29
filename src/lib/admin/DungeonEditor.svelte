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

  function getEnemy(templateId: string): EnemyTemplate | undefined {
    return enemies.find((e) => e.id === templateId);
  }

  function getEnemyName(templateId: string): string {
    return getEnemy(templateId)?.name ?? '(unknown)';
  }

  function getEnemyRole(templateId: string): string {
    return getEnemy(templateId)?.role ?? '???';
  }

  const ROLE_COLORS: Record<string, string> = {
    tank: 'bg-blue-900 border-blue-500',
    warrior: 'bg-orange-900 border-orange-500',
    archer: 'bg-green-900 border-green-500',
    mage: 'bg-purple-900 border-purple-500',
    assassin: 'bg-gray-800 border-gray-400',
    healer: 'bg-emerald-900 border-emerald-500',
    summoner: 'bg-teal-900 border-teal-500',
  };

  const ROLE_ICONS: Record<string, string> = {
    tank: 'T',
    warrior: 'W',
    archer: 'A',
    mage: 'M',
    assassin: 'X',
    healer: 'H',
    summoner: 'S',
  };
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
                        <div class="flex gap-2 flex-wrap mb-2">
                          {#each room.enemies as roomEnemy, ei}
                            {@const enemy = getEnemy(roomEnemy.enemyTemplateId)}
                            <div class="relative w-16 h-20 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5
                              {enemy ? (ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500') : 'bg-slate-800 border-slate-500'}">
                              <span class="text-lg font-bold">{enemy ? (ROLE_ICONS[enemy.role] ?? '?') : '?'}</span>
                              <span class="text-[9px] font-medium text-center leading-tight px-0.5 truncate w-full">
                                {enemy?.name ?? '???'}
                              </span>
                              {#if enemy?.isBoss}
                                <span class="absolute top-0 left-0 right-0 text-[8px] text-center text-red-400 font-bold">BOSS</span>
                              {/if}
                              <button
                                onclick={() => removeEnemyFromRoom(i, ei)}
                                class="absolute -top-1.5 -right-1.5 w-4 h-4 flex items-center justify-center rounded-full bg-red-800 hover:bg-red-600 text-[9px] leading-none"
                              >
                                ✕
                              </button>
                            </div>
                          {/each}
                        </div>
                      {/if}

                      {#if room.enemies.length < 5}
                        {#if enemies.length > 0}
                          <span class="block text-xs text-gray-500 mb-1">Add enemy:</span>
                          <div class="flex gap-1.5 flex-wrap">
                            {#each enemies as enemy (enemy.id)}
                              <button
                                onclick={() => addEnemyToRoom(i, enemy.id)}
                                class="w-14 h-16 rounded border-2 flex flex-col items-center justify-center gap-0.5 hover:brightness-125 transition-all
                                  {ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500'}"
                              >
                                <span class="text-sm font-bold">{ROLE_ICONS[enemy.role] ?? '?'}</span>
                                <span class="text-[8px] text-center leading-tight px-0.5 truncate w-full">{enemy.name}</span>
                                {#if enemy.isBoss}
                                  <span class="text-[7px] text-red-400 font-bold -mt-0.5">BOSS</span>
                                {/if}
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
              <div class="flex items-center gap-1 px-2 py-1 rounded
                {room.isBoss ? 'bg-red-900/50' : 'bg-slate-700'}">
                <span class="text-xs font-bold {room.isBoss ? 'text-red-300' : 'text-gray-300'}">
                  {room.roomNumber}.
                </span>
                <div class="flex gap-0.5">
                  {#each room.enemies as re}
                    {@const enemy = getEnemy(re.enemyTemplateId)}
                    <span class="w-5 h-5 flex items-center justify-center rounded text-[9px] font-bold border
                      {enemy ? (ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500') : 'bg-slate-800 border-slate-500'}"
                      title={enemy?.name ?? '???'}
                    >
                      {enemy ? (ROLE_ICONS[enemy.role] ?? '?') : '?'}
                    </span>
                  {/each}
                </div>
                {#if room.enemies.length === 0}
                  <span class="text-[9px] text-gray-500">empty</span>
                {/if}
              </div>
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
