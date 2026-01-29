<script lang="ts">
  import type { CharacterDefinition, Rarity, Role } from '../game/types';
  import type { GachaConfig, Dungeon } from './adminTypes';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    characters: CharacterDefinition[];
    dungeons: Dungeon[];
    gachaConfig?: GachaConfig;
    dailyDungeonId?: string;
    dailyDungeonSchedule?: Record<string, string>;
    maxDungeonTeamSize?: number;
    onSave: (config: GachaConfig) => void;
    onSaveDailyDungeon: (id: string) => void;
    onSaveSchedule: (schedule: Record<string, string>) => void;
    onSaveMaxTeamSize: (size: number) => void;
  }

  let { characters, dungeons, gachaConfig, dailyDungeonId, dailyDungeonSchedule, maxDungeonTeamSize, onSave, onSaveDailyDungeon, onSaveSchedule, onSaveMaxTeamSize }: Props = $props();

  const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'text-gray-300',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  const DEFAULT_CONFIG: GachaConfig = {
    characterPool: [],
    rates: { common: 0.74, rare: 0.20, epic: 0.05, legendary: 0.01 },
    ascensionCosts: [1, 2, 3, 4, 5, 6],
  };

  let config: GachaConfig = $state(
    gachaConfig
      ? { ...gachaConfig, characterPool: [...gachaConfig.characterPool], rates: { ...gachaConfig.rates }, ascensionCosts: [...gachaConfig.ascensionCosts] }
      : { ...DEFAULT_CONFIG, characterPool: [], rates: { ...DEFAULT_CONFIG.rates }, ascensionCosts: [...DEFAULT_CONFIG.ascensionCosts] }
  );

  let selectedDailyId: string = $state(dailyDungeonId ?? '');
  let schedule: Record<string, string> = $state(dailyDungeonSchedule ? { ...dailyDungeonSchedule } : {});
  let teamSize: number = $state(maxDungeonTeamSize ?? 6);

  // Calendar state
  let calendarMonth = $state(new Date());

  function getCalendarDays(): { date: string; day: number; isCurrentMonth: boolean }[] {
    const y = calendarMonth.getFullYear();
    const m = calendarMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay(); // 0=Sun
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const days: { date: string; day: number; isCurrentMonth: boolean }[] = [];
    // Padding for start of week
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
    if (!selectedCalendarDate) return;
    if (selectedCalendarDungeonId) {
      schedule = { ...schedule, [selectedCalendarDate]: selectedCalendarDungeonId };
    } else {
      const { [selectedCalendarDate]: _, ...rest } = schedule;
      schedule = rest;
    }
    onSaveSchedule(schedule);
    selectedCalendarDate = null;
  }

  function getDungeonName(id: string): string {
    return dungeons.find((d) => d.id === id)?.name ?? '???';
  }

  function getTodayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  function handleSaveMaxTeamSize() {
    onSaveMaxTeamSize(teamSize);
  }

  function isInPool(charId: string): boolean {
    return config.characterPool.includes(charId);
  }

  function toggleCharacter(charId: string) {
    if (isInPool(charId)) {
      config = { ...config, characterPool: config.characterPool.filter((id) => id !== charId) };
    } else {
      config = { ...config, characterPool: [...config.characterPool, charId] };
    }
  }

  function addAllCharacters() {
    config = { ...config, characterPool: characters.map((c) => c.id) };
  }

  function clearPool() {
    config = { ...config, characterPool: [] };
  }

  function updateRate(rarity: Rarity, value: number) {
    config = { ...config, rates: { ...config.rates, [rarity]: value } };
  }

  let rateSum = $derived(
    RARITIES.reduce((sum, r) => sum + (config.rates[r] ?? 0), 0)
  );

  function updateAscensionCost(index: number, value: number) {
    const costs = [...config.ascensionCosts];
    costs[index] = value;
    config = { ...config, ascensionCosts: costs };
  }

  function addAscensionLevel() {
    config = { ...config, ascensionCosts: [...config.ascensionCosts, config.ascensionCosts.length + 1] };
  }

  function removeLastAscensionLevel() {
    if (config.ascensionCosts.length <= 1) return;
    config = { ...config, ascensionCosts: config.ascensionCosts.slice(0, -1) };
  }

  function handleSave() {
    onSave(config);
  }

  function handleSaveDailyDungeon() {
    if (selectedDailyId) onSaveDailyDungeon(selectedDailyId);
  }

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'bg-blue-900', warrior: 'bg-orange-900', archer: 'bg-green-900',
    mage: 'bg-purple-900', assassin: 'bg-gray-800', healer: 'bg-emerald-900',
    summoner: 'bg-teal-900',
  };

  function getCharsByRarity(rarity: Rarity): CharacterDefinition[] {
    return characters.filter((c) => c.rarity === rarity);
  }
</script>

<div class="space-y-6">
  <!-- Daily Dungeon Fallback -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-amber-400">Daily Dungeon - Default Fallback</h3>
    <div class="flex gap-3 items-end mb-4">
      <div class="flex-1">
        <span class="block text-xs text-gray-400 mb-1">Fallback dungeon (used when no calendar entry for today)</span>
        <select
          bind:value={selectedDailyId}
          class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
        >
          <option value="">-- None --</option>
          {#each dungeons as dungeon}
            <option value={dungeon.id}>{dungeon.name} ({dungeon.rooms.length} rooms)</option>
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

    <!-- Max Team Size -->
    <div class="flex gap-3 items-end">
      <div>
        <span class="block text-xs text-gray-400 mb-1">Max Team Size</span>
        <input
          type="number"
          min="1"
          max="9"
          bind:value={teamSize}
          class="w-20 px-3 py-2 bg-slate-700 rounded text-sm"
        />
      </div>
      <button
        onclick={handleSaveMaxTeamSize}
        class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-sm font-bold"
      >
        Save
      </button>
    </div>
  </div>

  <!-- Daily Dungeon Calendar -->
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
              <span class="text-[7px] truncate w-full text-center px-0.5">{getDungeonName(assigned)}</span>
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
            {#each dungeons as dungeon}
              <option value={dungeon.id}>{dungeon.name}</option>
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

  <!-- Gacha Rates -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-yellow-400">Gacha Pull Rates</h3>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {#each RARITIES as rarity}
        <div>
          <span class="block text-xs mb-1 capitalize {RARITY_COLORS[rarity]}">{rarity}</span>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={config.rates[rarity]}
            oninput={(e) => updateRate(rarity, parseFloat(e.currentTarget.value) || 0)}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      {/each}
    </div>
    <div class="mt-2 text-xs {Math.abs(rateSum - 1) < 0.001 ? 'text-green-400' : 'text-red-400'}">
      Total: {rateSum.toFixed(4)} {Math.abs(rateSum - 1) < 0.001 ? '(valid)' : '(must equal 1.0)'}
    </div>
  </div>

  <!-- Ascension Costs -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-cyan-400">Ascension Costs (duplicates needed)</h3>
    <div class="flex gap-2 flex-wrap mb-3">
      {#each config.ascensionCosts as cost, i}
        <div class="text-center">
          <span class="block text-[10px] text-gray-500 mb-0.5">Asc {i}→{i + 1}</span>
          <input
            type="number"
            min="1"
            max="99"
            value={cost}
            oninput={(e) => updateAscensionCost(i, parseInt(e.currentTarget.value) || 1)}
            class="w-14 px-2 py-1 bg-slate-700 rounded text-sm text-center"
          />
        </div>
      {/each}
    </div>
    <div class="flex gap-2">
      <button
        onclick={addAscensionLevel}
        class="px-3 py-1 bg-cyan-800 hover:bg-cyan-700 rounded text-xs"
      >
        + Level
      </button>
      <button
        onclick={removeLastAscensionLevel}
        disabled={config.ascensionCosts.length <= 1}
        class="px-3 py-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 rounded text-xs"
      >
        - Level
      </button>
    </div>
  </div>

  <!-- Character Pool -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-green-400">
      Gacha Character Pool ({config.characterPool.length}/{characters.length})
    </h3>
    <div class="flex gap-2 mb-3">
      <button onclick={addAllCharacters} class="px-3 py-1 bg-green-800 hover:bg-green-700 rounded text-xs">
        Add All
      </button>
      <button onclick={clearPool} class="px-3 py-1 bg-red-900 hover:bg-red-800 rounded text-xs">
        Clear All
      </button>
    </div>

    {#each RARITIES as rarity}
      {@const chars = getCharsByRarity(rarity)}
      {#if chars.length > 0}
        <div class="mb-3">
          <span class="text-xs font-bold capitalize {RARITY_COLORS[rarity]}">{rarity}</span>
          <div class="flex gap-2 flex-wrap mt-1">
            {#each chars as char}
              <button
                onclick={() => toggleCharacter(char.id)}
                class="w-16 h-20 rounded-lg border-2 flex flex-col items-center overflow-hidden transition-all
                  {isInPool(char.id)
                    ? 'border-green-400 ring-1 ring-green-400'
                    : 'border-slate-600 hover:border-slate-400 opacity-50'}
                  {ROLE_COLORS[char.role]}"
              >
                <SpritePreview sprites={char.sprites} fallback={ROLE_ICONS[char.role]} class="w-12 h-12 mt-0.5" />
                <span class="text-[8px] font-medium truncate w-full text-center px-0.5">{char.name}</span>
                <span class="text-[7px] capitalize text-gray-400">{char.role}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <!-- Save Button -->
  <button
    onclick={handleSave}
    disabled={Math.abs(rateSum - 1) >= 0.001}
    class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-bold"
  >
    Save Gacha Config
  </button>
</div>
