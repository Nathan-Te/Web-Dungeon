<script lang="ts">
  import type { EnemyTemplate, DungeonRoom } from './adminTypes';
  import { createBlankRoom, generateId } from './adminTypes';

  interface Props {
    rooms: DungeonRoom[];
    enemies: EnemyTemplate[];
    onSave: (room: DungeonRoom) => void;
    onDelete: (id: string) => void;
  }

  let { rooms, enemies, onSave, onDelete }: Props = $props();

  let editingRoom: DungeonRoom | null = $state(null);

  let sortedRooms = $derived([...rooms].sort((a, b) => a.roomNumber - b.roomNumber));

  function startNew() {
    const nextNum = rooms.length > 0
      ? Math.max(...rooms.map((r) => r.roomNumber)) + 1
      : 1;
    editingRoom = createBlankRoom(nextNum);
  }

  function startEdit(room: DungeonRoom) {
    editingRoom = {
      ...room,
      enemies: room.enemies.map((e) => ({ ...e })),
    };
  }

  function handleSave() {
    if (!editingRoom || !editingRoom.name.trim()) return;
    onSave(editingRoom);
    editingRoom = null;
  }

  function handleCancel() {
    editingRoom = null;
  }

  function handleDeleteRoom(id: string) {
    if (confirm('Delete this room?')) {
      onDelete(id);
      if (editingRoom?.id === id) editingRoom = null;
    }
  }

  function addEnemyToRoom(enemyId: string) {
    if (!editingRoom) return;
    if (editingRoom.enemies.length >= 5) return;
    editingRoom = {
      ...editingRoom,
      enemies: [...editingRoom.enemies, { enemyTemplateId: enemyId }],
    };
  }

  function removeEnemyFromRoom(index: number) {
    if (!editingRoom) return;
    editingRoom = {
      ...editingRoom,
      enemies: editingRoom.enemies.filter((_, i) => i !== index),
    };
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
      onclick={startNew}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Room
    </button>
    <span class="text-gray-400 text-sm">{rooms.length} rooms</span>
  </div>

  <!-- Edit Form -->
  {#if editingRoom}
    <div class="bg-slate-800 rounded-lg p-4 border border-amber-800">
      <h3 class="font-bold mb-3 text-amber-400">
        {rooms.some((r) => r.id === editingRoom?.id) ? 'Edit' : 'New'} Room
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Name</label>
          <input
            type="text"
            bind:value={editingRoom.name}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Room Number</label>
          <input
            type="number"
            bind:value={editingRoom.roomNumber}
            min="1"
            max="10"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Difficulty Multiplier</label>
          <input
            type="number"
            step="0.1"
            min="0.5"
            max="5"
            bind:value={editingRoom.difficultyMult}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div class="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            id="isBoss"
            bind:checked={editingRoom.isBoss}
            class="w-4 h-4"
          />
          <label for="isBoss" class="text-sm">Boss Room</label>
        </div>
      </div>

      <!-- Enemy Composition -->
      <div class="mt-4">
        <label class="block text-xs text-gray-400 mb-2">
          Enemies ({editingRoom.enemies.length}/5)
        </label>

        {#if editingRoom.enemies.length > 0}
          <div class="space-y-1 mb-3">
            {#each editingRoom.enemies as roomEnemy, i}
              <div class="flex items-center gap-2 px-2 py-1 bg-slate-900 rounded text-sm">
                <span class="text-gray-500 w-4">{i + 1}.</span>
                <span class="capitalize text-xs text-gray-400 w-16">{getEnemyRole(roomEnemy.enemyTemplateId)}</span>
                <span class="flex-1 text-red-300">{getEnemyName(roomEnemy.enemyTemplateId)}</span>
                <button
                  onclick={() => removeEnemyFromRoom(i)}
                  class="text-xs text-red-500 hover:text-red-400"
                >
                  Remove
                </button>
              </div>
            {/each}
          </div>
        {/if}

        {#if editingRoom.enemies.length < 5}
          {#if enemies.length > 0}
            <div class="flex gap-2 flex-wrap">
              {#each enemies as enemy (enemy.id)}
                <button
                  onclick={() => addEnemyToRoom(enemy.id)}
                  class="px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded"
                >
                  + {enemy.name} ({enemy.role})
                </button>
              {/each}
            </div>
          {:else}
            <p class="text-gray-500 text-xs">Create enemy templates first (Enemies tab)</p>
          {/if}
        {:else}
          <p class="text-amber-500 text-xs">Room is full (5/5)</p>
        {/if}
      </div>

      <div class="flex gap-2 mt-4">
        <button
          onclick={handleSave}
          disabled={!editingRoom.name.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-bold"
        >
          Save
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

  <!-- Room List -->
  <div class="space-y-2">
    {#each sortedRooms as room (room.id)}
      <div class="px-4 py-3 bg-slate-800 rounded group">
        <div class="flex items-center gap-3">
          <span class="w-8 h-8 flex items-center justify-center rounded font-bold text-sm
            {room.isBoss ? 'bg-red-800 text-red-200' : 'bg-slate-700 text-gray-300'}">
            {room.roomNumber}
          </span>

          <span class="flex-1 font-medium">
            {room.name}
            {#if room.isBoss}
              <span class="text-xs text-red-400 ml-2">BOSS</span>
            {/if}
          </span>

          <span class="text-xs text-gray-500">x{room.difficultyMult.toFixed(1)}</span>

          <span class="text-xs text-gray-400">{room.enemies.length} enemies</span>

          <button
            onclick={() => startEdit(room)}
            class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded opacity-60 group-hover:opacity-100"
          >
            Edit
          </button>
          <button
            onclick={() => handleDeleteRoom(room.id)}
            class="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded opacity-60 group-hover:opacity-100"
          >
            Del
          </button>
        </div>

        {#if room.enemies.length > 0}
          <div class="mt-2 flex gap-2 flex-wrap">
            {#each room.enemies as roomEnemy}
              <span class="text-xs px-2 py-0.5 bg-slate-700 rounded text-red-300">
                {getEnemyName(roomEnemy.enemyTemplateId)}
              </span>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>

  {#if rooms.length === 0}
    <p class="text-gray-500 text-center py-8">No dungeon rooms. Create rooms and fill them with enemies!</p>
  {/if}
</div>
