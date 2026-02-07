<script lang="ts">
  import type { EnemyTemplate, DungeonRoom, Dungeon, Tower } from './adminTypes';
  import type { SpriteSource, SpriteSheetConfig } from '../game/types';
  import { createBlankDungeon, createBlankRoom, generateId } from './adminTypes';

  interface Props {
    dungeons: Dungeon[];
    enemies: EnemyTemplate[];
    towers?: Tower[];
    dailyDungeonId?: string;
    dailyDungeonSchedule?: Record<string, string>;
    onSave: (dungeon: Dungeon) => void;
    onDelete: (id: string) => void;
    onSaveDailyDungeon?: (id: string) => void;
    onSaveSchedule?: (schedule: Record<string, string>) => void;
  }

  let { dungeons, enemies, towers, dailyDungeonId, dailyDungeonSchedule, onSave, onDelete, onSaveDailyDungeon, onSaveSchedule }: Props = $props();

  let editingDungeon: Dungeon | null = $state(null);
  let editingRoomIndex: number | null = $state(null);

  // Daily dungeon config
  let selectedDailyId: string = $state(dailyDungeonId ?? '');
  let schedule: Record<string, string> = $state(dailyDungeonSchedule ? { ...dailyDungeonSchedule } : {});

  // Calendar state
  let calendarMonth = $state(new Date());

  function getCalendarDays(): { date: string; day: number; isCurrentMonth: boolean }[] {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push({ date: '', day: 0, isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ date: dateStr, day: d, isCurrentMonth: true });
    }
    return days;
  }

  let calendarDays = $derived(getCalendarDays());
  let calendarLabel = $derived(
    calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  function prevMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1);
  }
  function nextMonth() {
    calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1);
  }

  let selectedCalendarDate: string | null = $state(null);
  let selectedCalendarDungeonId: string = $state('');

  function selectCalendarDate(date: string) {
    selectedCalendarDate = date;
    selectedCalendarDungeonId = schedule[date] ?? '';
  }

  function assignDungeonToDate() {
    if (!selectedCalendarDate || !onSaveSchedule) return;
    if (selectedCalendarDungeonId) {
      schedule = { ...schedule, [selectedCalendarDate]: selectedCalendarDungeonId };
    } else {
      const { [selectedCalendarDate]: _, ...rest } = schedule;
      schedule = rest;
    }
    onSaveSchedule(schedule);
    selectedCalendarDate = null;
  }

  function getDungeonNameById(id: string): string {
    return dungeons.find((d) => d.id === id)?.name ?? '???';
  }

  function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function handleSaveDailyDungeon() {
    if (selectedDailyId && onSaveDailyDungeon) onSaveDailyDungeon(selectedDailyId);
  }

  function getDungeonSummary(d: Dungeon): string {
    const totalEnemies = d.rooms.reduce((n, r) => n + r.enemies.length, 0);
    const teamSize = d.maxTeamSize ?? 5;
    return `${d.rooms.length} rooms, ${totalEnemies} enemies, team ${teamSize}`;
  }

  // Search / filter
  let searchQuery = $state('');
  let filterRooms = $state('');
  let filterTeam = $state('');
  type DungeonTypeFilter = 'all' | 'dungeon' | 'tower';
  let filterType: DungeonTypeFilter = $state('all');

  /** Set of dungeon IDs referenced by at least one tower stage */
  let towerDungeonIds = $derived(
    new Set((towers ?? []).flatMap(t => t.stages.map(s => s.dungeonId)))
  );

  /** Map from dungeon ID to tower name(s) that reference it */
  let dungeonTowerNames = $derived(() => {
    const map = new Map<string, string[]>();
    for (const tower of (towers ?? [])) {
      for (const stage of tower.stages) {
        const names = map.get(stage.dungeonId) ?? [];
        if (!names.includes(tower.name)) names.push(tower.name);
        map.set(stage.dungeonId, names);
      }
    }
    return map;
  });

  let filteredDungeons = $derived(() => {
    let list = dungeons;
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((d) => d.name.toLowerCase().includes(q));
    }
    if (filterRooms) {
      const n = parseInt(filterRooms);
      if (!isNaN(n)) list = list.filter((d) => d.rooms.length === n);
    }
    if (filterTeam) {
      const n = parseInt(filterTeam);
      if (!isNaN(n)) list = list.filter((d) => (d.maxTeamSize ?? 5) === n);
    }
    if (filterType === 'tower') {
      list = list.filter((d) => towerDungeonIds.has(d.id));
    } else if (filterType === 'dungeon') {
      list = list.filter((d) => !towerDungeonIds.has(d.id));
    }
    return list;
  });

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

  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  /** Get idle sprite info for an enemy template */
  function getIdleSprite(template: EnemyTemplate): {
    type: 'static' | 'sheet' | 'none';
    src?: string;
    sheet?: SpriteSheetConfig;
  } {
    const idle = template.sprites?.idle ?? (template.sprite ? template.sprite : undefined);
    if (!idle) return { type: 'none' };
    if (isSheet(idle)) return { type: 'sheet', sheet: idle };
    return { type: 'static', src: idle as string };
  }
</script>

<div class="space-y-4">
  <!-- Daily Dungeon Fallback -->
  {#if onSaveDailyDungeon}
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3 text-amber-400">Daily Dungeon - Default Fallback</h3>
      <div class="flex gap-3 items-end">
        <div class="flex-1">
          <span class="block text-xs text-gray-400 mb-1">Fallback dungeon (used when no calendar entry for today)</span>
          <select
            bind:value={selectedDailyId}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            <option value="">-- None --</option>
            {#each dungeons as d}
              <option value={d.id}>{d.name} — {getDungeonSummary(d)}</option>
            {/each}
          </select>
        </div>
        <button
          onclick={handleSaveDailyDungeon}
          disabled={!selectedDailyId}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-bold"
        >
          Save
        </button>
      </div>
    </div>
  {/if}

  <!-- Daily Dungeon Calendar -->
  {#if onSaveSchedule}
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3 text-amber-400">Daily Dungeon Calendar</h3>

      <!-- Month navigation -->
      <div class="flex items-center justify-between mb-3">
        <button onclick={prevMonth} class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">&lt;</button>
        <span class="font-bold text-sm">{calendarLabel}</span>
        <button onclick={nextMonth} class="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm">&gt;</button>
      </div>

      <!-- Weekday headers -->
      <div class="grid grid-cols-7 gap-1 mb-1">
        {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as d}
          <div class="text-center text-[10px] text-gray-500 font-bold">{d}</div>
        {/each}
      </div>

      <!-- Calendar grid -->
      <div class="grid grid-cols-7 gap-1">
        {#each calendarDays as cell}
          {#if cell.isCurrentMonth}
            {@const assigned = schedule[cell.date]}
            {@const isToday = cell.date === getTodayStr()}
            <button
              onclick={() => selectCalendarDate(cell.date)}
              class="h-10 rounded text-xs flex flex-col items-center justify-center transition-colors
                {isToday ? 'ring-2 ring-yellow-400' : ''}
                {assigned ? 'bg-amber-900 text-amber-200' : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}
                {selectedCalendarDate === cell.date ? 'ring-2 ring-white' : ''}"
            >
              <span class="font-bold">{cell.day}</span>
              {#if assigned}
                <span class="text-[7px] truncate w-full text-center px-0.5">{getDungeonNameById(assigned)}</span>
              {/if}
            </button>
          {:else}
            <div></div>
          {/if}
        {/each}
      </div>

      <!-- Assign dungeon to selected date -->
      {#if selectedCalendarDate}
        <div class="mt-3 p-3 bg-slate-900 rounded">
          <div class="text-xs text-gray-400 mb-2">Assign dungeon for <span class="text-white font-bold">{selectedCalendarDate}</span>:</div>
          <div class="flex gap-2 items-end">
            <select
              bind:value={selectedCalendarDungeonId}
              class="flex-1 px-3 py-2 bg-slate-700 rounded text-sm"
            >
              <option value="">-- None --</option>
              {#each dungeons as d}
                <option value={d.id}>{d.name} — {getDungeonSummary(d)}</option>
              {/each}
            </select>
            <button
              onclick={assignDungeonToDate}
              class="px-4 py-2 bg-amber-600 hover:bg-amber-500 rounded text-sm font-bold"
            >
              {selectedCalendarDungeonId ? 'Assign' : 'Clear'}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Toolbar -->
  <div class="flex gap-3 items-center flex-wrap">
    <button
      onclick={startNewDungeon}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Dungeon
    </button>
    <span class="text-gray-400 text-sm">{dungeons.length} dungeons</span>
  </div>

  <!-- Search / Filter -->
  <div class="flex gap-2 items-end flex-wrap">
    <div class="flex-1 min-w-[140px]">
      <span class="block text-[10px] text-gray-500 mb-0.5">Search by name</span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Search..."
        class="w-full px-3 py-1.5 bg-slate-700 rounded text-sm"
      />
    </div>
    <div class="w-36">
      <span class="block text-[10px] text-gray-500 mb-0.5">Type</span>
      <select
        bind:value={filterType}
        class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm"
      >
        <option value="all">Tous</option>
        <option value="dungeon">Donjons seuls</option>
        <option value="tower">Étages de tour</option>
      </select>
    </div>
    <div class="w-24">
      <span class="block text-[10px] text-gray-500 mb-0.5">Rooms</span>
      <input
        type="number"
        min="0"
        bind:value={filterRooms}
        placeholder="Any"
        class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm"
      />
    </div>
    <div class="w-24">
      <span class="block text-[10px] text-gray-500 mb-0.5">Team size</span>
      <input
        type="number"
        min="1"
        max="9"
        bind:value={filterTeam}
        placeholder="Any"
        class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm"
      />
    </div>
  </div>

  <!-- Dungeon Edit Form -->
  {#if editingDungeon}
    <div class="bg-slate-800 rounded-lg p-4 border border-amber-800">
      <h3 class="font-bold mb-3 text-amber-400">
        {dungeons.some((d) => d.id === editingDungeon?.id) ? 'Edit' : 'New'} Dungeon
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
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
        <div>
          <span class="block text-xs text-gray-400 mb-1">Max Team Size</span>
          <input
            type="number"
            min="1"
            max="9"
            value={editingDungeon.maxTeamSize ?? 5}
            oninput={(e) => { if (editingDungeon) editingDungeon = { ...editingDungeon, maxTeamSize: parseInt(e.currentTarget.value) || 5 }; }}
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
                    <div class="grid grid-cols-2 sm:grid-cols-5 gap-2">
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
                      <div>
                        <span class="block text-xs text-gray-400 mb-0.5">XP Reward</span>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={room.xpReward ?? 0}
                          oninput={(e) => updateRoom(i, { ...room, xpReward: parseInt(e.currentTarget.value) || 0 })}
                          class="w-full px-2 py-1 bg-slate-700 rounded text-xs"
                        />
                      </div>
                      <div>
                        <span class="block text-xs text-gray-400 mb-0.5">Gold Reward</span>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          value={room.goldReward ?? 0}
                          oninput={(e) => updateRoom(i, { ...room, goldReward: parseInt(e.currentTarget.value) || 0 })}
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
                            {@const sprite = enemy ? getIdleSprite(enemy) : { type: 'none' as const }}
                            <div class="relative w-16 h-20 rounded-lg border-2 flex flex-col items-center overflow-hidden
                              {enemy ? (ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500') : 'bg-slate-800 border-slate-500'}">
                              <div class="w-14 h-14 flex items-center justify-center mt-0.5">
                                {#if sprite.type === 'static' && sprite.src}
                                  <img src={sprite.src} alt={enemy?.name ?? ''} class="w-full h-full object-contain" />
                                {:else if sprite.type === 'sheet' && sprite.sheet}
                                  <div class="w-full h-full"
                                    style="background-image: url({sprite.sheet.src}); background-size: {sprite.sheet.framesPerRow * 100}% auto; background-position: 0 0;"
                                  ></div>
                                {:else}
                                  <span class="text-lg font-bold">{enemy ? (ROLE_ICONS[enemy.role] ?? '?') : '?'}</span>
                                {/if}
                              </div>
                              <span class="text-[9px] font-medium text-center leading-tight px-0.5 truncate w-full">
                                {enemy?.name ?? '???'}
                              </span>
                              {#if enemy?.isBoss}
                                <span class="absolute top-0 left-0 right-0 text-[8px] text-center text-red-400 font-bold bg-black/50">BOSS</span>
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
                              {@const sprite = getIdleSprite(enemy)}
                              <button
                                onclick={() => addEnemyToRoom(i, enemy.id)}
                                class="w-14 h-16 rounded border-2 flex flex-col items-center overflow-hidden hover:brightness-125 transition-all
                                  {ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500'}"
                              >
                                <div class="w-12 h-10 flex items-center justify-center">
                                  {#if sprite.type === 'static' && sprite.src}
                                    <img src={sprite.src} alt={enemy.name} class="w-full h-full object-contain" />
                                  {:else if sprite.type === 'sheet' && sprite.sheet}
                                    <div class="w-full h-full"
                                      style="background-image: url({sprite.sheet.src}); background-size: {sprite.sheet.framesPerRow * 100}% auto; background-position: 0 0;"
                                    ></div>
                                  {:else}
                                    <span class="text-sm font-bold">{ROLE_ICONS[enemy.role] ?? '?'}</span>
                                  {/if}
                                </div>
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
    {#each filteredDungeons() as dungeon (dungeon.id)}
      {@const towerNames = dungeonTowerNames().get(dungeon.id)}
      <div class="px-4 py-3 bg-slate-800 rounded group">
        <div class="flex items-center gap-3">
          <span class="flex-1 flex items-center gap-2 flex-wrap">
            <span class="font-medium">{dungeon.name}</span>
            {#if towerNames && towerNames.length > 0}
              <span class="text-[10px] px-1.5 py-0.5 rounded bg-purple-900 text-purple-300 border border-purple-700 font-medium">
                Tour : {towerNames.join(', ')}
              </span>
            {/if}
            {#if dungeon.description}
              <span class="text-xs text-gray-500">{dungeon.description}</span>
            {/if}
          </span>

          <span class="text-xs text-amber-400">{dungeon.rooms.length} rooms</span>

          <span class="text-xs text-gray-500">
            {dungeon.rooms.reduce((n, r) => n + r.enemies.length, 0)} enemies
          </span>

          <span class="text-xs text-blue-400">team {dungeon.maxTeamSize ?? 5}</span>

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
                    {@const sprite = enemy ? getIdleSprite(enemy) : { type: 'none' as const }}
                    <span class="w-6 h-6 flex items-center justify-center rounded border overflow-hidden
                      {enemy ? (ROLE_COLORS[enemy.role] ?? 'bg-slate-800 border-slate-500') : 'bg-slate-800 border-slate-500'}"
                      title={enemy?.name ?? '???'}
                    >
                      {#if sprite.type === 'static' && sprite.src}
                        <img src={sprite.src} alt="" class="w-full h-full object-contain" />
                      {:else if sprite.type === 'sheet' && sprite.sheet}
                        <div class="w-full h-full"
                          style="background-image: url({sprite.sheet.src}); background-size: {sprite.sheet.framesPerRow * 100}% auto; background-position: 0 0;"
                        ></div>
                      {:else}
                        <span class="text-[9px] font-bold">{enemy ? (ROLE_ICONS[enemy.role] ?? '?') : '?'}</span>
                      {/if}
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

  {#if filteredDungeons().length === 0}
    <p class="text-gray-500 text-center py-4">
      {dungeons.length === 0 ? 'No dungeons. Create a dungeon and fill it with rooms!' : 'No dungeons match your filters.'}
    </p>
  {/if}
</div>
