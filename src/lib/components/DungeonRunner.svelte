<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Character,
    AutoBattleSimulation,
    type CharacterDefinition,
    type CombatAction,
    type BattleResult,
    type Role,
    type Position,
    type SpriteSet,
    type AnimState,
    type HitEffect,
    ROLE_BASE_STATS,
    ROLE_PREFERRED_ROW,
    COMBAT_CONSTANTS,
  } from '../game';
  import type { Dungeon, DungeonRoom, EnemyTemplate } from '../admin/adminTypes';
  import { loadContent } from '../admin/contentStore';
  import BattleGrid from './BattleGrid.svelte';
  import BattleLog from './BattleLog.svelte';

  interface DisplayUnit {
    id: string;
    name: string;
    role: Role;
    currentHp: number;
    maxHp: number;
    atk: number;
    def: number;
    spd: number;
    position: Position;
    team: 'player' | 'enemy';
    isAlive: boolean;
    sprites?: SpriteSet;
    animState?: AnimState;
    hitEffect?: HitEffect;
  }

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer'];
  const ROLE_COLORS: Record<Role, string> = {
    tank: 'text-blue-400',
    warrior: 'text-orange-400',
    archer: 'text-green-400',
    mage: 'text-purple-400',
    assassin: 'text-gray-300',
    healer: 'text-emerald-400',
  };

  // Content
  let allCharacters: CharacterDefinition[] = $state([]);
  let allDungeons: Dungeon[] = $state([]);
  let allEnemies: EnemyTemplate[] = $state([]);

  // Selection
  let selectedDungeonId: string = $state('');
  let playerTeamIds: string[] = $state([]);
  let playerLevel = $state(10);
  let seed = $state(42);

  // Run state
  type RunPhase = 'select' | 'running' | 'room_result' | 'dungeon_complete';
  let phase: RunPhase = $state('select');
  let currentRoomIndex = $state(0);
  let roomResults: { room: DungeonRoom; result: BattleResult }[] = $state([]);

  // Carry-over HP: maps characterId -> { currentHp, maxHp }
  let survivorHp: Map<string, { currentHp: number; maxHp: number }> = $state(new Map());

  // Battle display
  let displayUnits: DisplayUnit[] = $state([]);
  let actionLog: CombatAction[] = $state([]);
  let currentActionIndex = $state(-1);
  let isPlaying = $state(false);
  let playbackSpeed = $state(250);
  let playInterval: ReturnType<typeof setInterval> | null = null;

  let selectedDungeon = $derived(allDungeons.find((d) => d.id === selectedDungeonId) ?? null);
  let currentRoom = $derived(
    selectedDungeon && currentRoomIndex < selectedDungeon.rooms.length
      ? selectedDungeon.rooms[currentRoomIndex]
      : null
  );
  let playerDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'player'));
  let enemyDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'enemy'));
  let battleDone = $derived(currentActionIndex >= actionLog.length - 1 && actionLog.length > 0);
  let latestResult = $derived(
    roomResults.length > 0 ? roomResults[roomResults.length - 1].result : null
  );

  function charactersByRole(role: Role): CharacterDefinition[] {
    return allCharacters.filter((c) => c.role === role);
  }

  function toggleChar(charId: string) {
    if (playerTeamIds.includes(charId)) {
      playerTeamIds = playerTeamIds.filter((id) => id !== charId);
    } else if (playerTeamIds.length < 5) {
      playerTeamIds = [...playerTeamIds, charId];
    }
  }

  onMount(() => {
    const content = loadContent();
    allCharacters = content.characters;
    allDungeons = content.dungeons;
    allEnemies = content.enemies;
    if (allDungeons.length > 0) selectedDungeonId = allDungeons[0].id;
    if (allCharacters.length >= 3) {
      playerTeamIds = allCharacters.slice(0, 3).map((c) => c.id);
    }
  });

  function startDungeon() {
    if (!selectedDungeon || playerTeamIds.length === 0) return;
    phase = 'running';
    currentRoomIndex = 0;
    roomResults = [];
    survivorHp = new Map();
    runCurrentRoom();
  }

  function createPlayerTeam(): Character[] {
    return playerTeamIds
      .map((id) => allCharacters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined)
      .map((def) => new Character(def, playerLevel, 0));
  }

  function createEnemyTeamFromRoom(room: DungeonRoom): Character[] {
    return room.enemies
      .map((re) => {
        const template = allEnemies.find((e) => e.id === re.enemyTemplateId);
        if (!template) return null;
        const def: CharacterDefinition = {
          id: `${template.id}_${Math.random().toString(36).slice(2, 6)}`,
          name: template.name,
          role: template.role,
          rarity: template.rarity,
          abilityName: '',
          abilityDescription: '',
          sprites: template.sprites ?? (template.sprite ? { idle: template.sprite } : undefined),
        };
        const level = Math.max(1, Math.round(template.level * room.difficultyMult));
        return new Character(def, level, template.ascension);
      })
      .filter((c): c is Character => c !== null);
  }

  function buildDisplayUnits(playerTeam: Character[], enemyTeam: Character[]): DisplayUnit[] {
    const units: DisplayUnit[] = [];
    const assignTeam = (team: Character[], teamType: 'player' | 'enemy') => {
      const sorted = [...team].sort(
        (a, b) => ROLE_PREFERRED_ROW[a.role] - ROLE_PREFERRED_ROW[b.role]
      );
      const used = new Set<string>();
      for (const char of sorted) {
        const preferredRow = ROLE_PREFERRED_ROW[char.role];
        let pos: Position | null = null;
        for (let col = 0; col <= 2 && !pos; col++) {
          const key = `${preferredRow},${col}`;
          if (!used.has(key)) {
            pos = { row: preferredRow, col: col as 0 | 1 | 2 };
            used.add(key);
          }
        }
        if (!pos) {
          for (let row = 0; row <= 2 && !pos; row++) {
            for (let col = 0; col <= 2 && !pos; col++) {
              const key = `${row},${col}`;
              if (!used.has(key)) {
                pos = { row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 };
                used.add(key);
              }
            }
          }
        }
        if (pos) {
          // Apply carry-over HP for player units
          let currentHp = char.hp;
          let maxHp = char.hp;
          if (teamType === 'player') {
            const carried = survivorHp.get(char.definition.id);
            if (carried) {
              currentHp = carried.currentHp;
              maxHp = carried.maxHp;
            }
          }
          units.push({
            id: char.id,
            name: char.name,
            role: char.role,
            currentHp,
            maxHp,
            atk: char.atk,
            def: char.def,
            spd: char.spd,
            position: pos,
            team: teamType,
            isAlive: currentHp > 0,
            sprites: char.definition.sprites ?? (char.definition.sprite ? { idle: char.definition.sprite } : undefined),
            animState: 'idle' as AnimState,
          });
        }
      }
    };
    assignTeam(playerTeam, 'player');
    assignTeam(enemyTeam, 'enemy');
    return units;
  }

  function runCurrentRoom() {
    if (!selectedDungeon || currentRoomIndex >= selectedDungeon.rooms.length) return;
    const room = selectedDungeon.rooms[currentRoomIndex];

    // Build teams
    const playerTeam = createPlayerTeam();
    const enemyTeam = createEnemyTeamFromRoom(room);

    if (enemyTeam.length === 0) {
      // Skip empty room
      roomResults = [...roomResults, {
        room,
        result: { winner: 'player', turns: 0, actionLog: [], playerSurvivors: playerTeam.map(c => c.name), enemySurvivors: [], seed },
      }];
      phase = 'room_result';
      return;
    }

    // Apply carry-over HP by modifying player characters' combat state
    // We simulate battle with fresh Characters but the display shows carry-over
    const roomSeed = seed + currentRoomIndex * 1000;
    const simulation = new AutoBattleSimulation(playerTeam, enemyTeam, roomSeed);
    const result = simulation.simulate();

    actionLog = result.actionLog;
    displayUnits = buildDisplayUnits(playerTeam, enemyTeam);
    currentActionIndex = -1;
    isPlaying = false;

    roomResults = [...roomResults, { room, result }];

    // Update survivor HP from result
    // We need to replay actions to determine final HP states
    // For simplicity, auto-play to end to get final state
    const finalUnits = displayUnits.map((u) => ({ ...u }));
    for (const action of actionLog) {
      applyActionToUnits(finalUnits, action);
    }

    // Store carry-over HP
    const newSurvivorHp = new Map<string, { currentHp: number; maxHp: number }>();
    for (const unit of finalUnits) {
      if (unit.team === 'player') {
        // Map back to original character definition id (remove random suffix for enemies)
        const originalId = playerTeamIds.find((id) => {
          const def = allCharacters.find((c) => c.id === id);
          return def && unit.id === def.id;
        });
        if (originalId) {
          newSurvivorHp.set(originalId, {
            currentHp: unit.isAlive ? unit.currentHp : 0,
            maxHp: unit.maxHp,
          });
        }
      }
    }
    survivorHp = newSurvivorHp;

    phase = result.winner === 'player' ? 'room_result' : 'room_result';
  }

  function applyActionToUnits(units: DisplayUnit[], action: CombatAction) {
    if (action.actionType === 'attack' || action.actionType === 'ability') {
      const aIdx = units.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        units[aIdx].animState = action.actionType === 'ability' ? 'castAbility' : 'attack';
      }
      const tIdx = units.findIndex((u) => u.id === action.targetId);
      if (tIdx !== -1 && action.damage !== undefined) {
        units[tIdx].currentHp = Math.max(0, units[tIdx].currentHp - action.damage);
        units[tIdx].hitEffect = 'damage';
      }
    } else if (action.actionType === 'heal') {
      const aIdx = units.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        units[aIdx].animState = 'castAbility';
      }
      const tIdx = units.findIndex((u) => u.id === action.targetId);
      if (tIdx !== -1 && action.healing !== undefined) {
        units[tIdx].currentHp = Math.min(units[tIdx].maxHp, units[tIdx].currentHp + action.healing);
        units[tIdx].hitEffect = 'heal';
      }
    } else if (action.actionType === 'death') {
      const dIdx = units.findIndex((u) => u.id === action.actorId);
      if (dIdx !== -1) {
        units[dIdx].isAlive = false;
        units[dIdx].currentHp = 0;
        units[dIdx].animState = 'death';
      }
    }
  }

  function applyAction(action: CombatAction) {
    // Reset living units to idle, keep dead in death, clear hit effects
    const updated = displayUnits.map((u) => ({ ...u, animState: (u.isAlive ? 'idle' : 'death') as AnimState, hitEffect: undefined as HitEffect | undefined }));
    applyActionToUnits(updated, action);
    displayUnits = updated;
  }

  function stepForward() {
    if (currentActionIndex >= actionLog.length - 1) return;
    currentActionIndex++;
    applyAction(actionLog[currentActionIndex]);
  }

  function togglePlay() {
    if (isPlaying) {
      if (playInterval) clearInterval(playInterval);
      playInterval = null;
      isPlaying = false;
    } else {
      isPlaying = true;
      playInterval = setInterval(() => {
        if (currentActionIndex >= actionLog.length - 1) {
          if (playInterval) clearInterval(playInterval);
          playInterval = null;
          isPlaying = false;
          return;
        }
        stepForward();
      }, playbackSpeed);
    }
  }

  function proceedToNextRoom() {
    if (playInterval) clearInterval(playInterval);
    playInterval = null;
    isPlaying = false;

    if (!selectedDungeon) return;

    // Check if player lost
    if (latestResult && latestResult.winner !== 'player') {
      phase = 'dungeon_complete';
      return;
    }

    // Check if dungeon is complete
    if (currentRoomIndex >= selectedDungeon.rooms.length - 1) {
      phase = 'dungeon_complete';
      return;
    }

    currentRoomIndex++;
    phase = 'running';
    runCurrentRoom();
  }

  function backToSelect() {
    if (playInterval) clearInterval(playInterval);
    playInterval = null;
    isPlaying = false;
    phase = 'select';
    currentRoomIndex = 0;
    roomResults = [];
    displayUnits = [];
    actionLog = [];
    currentActionIndex = -1;
  }

  let dungeonWon = $derived(
    phase === 'dungeon_complete' &&
    selectedDungeon !== null &&
    roomResults.length === selectedDungeon.rooms.length &&
    roomResults.every((rr) => rr.result.winner === 'player')
  );
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-3xl font-bold text-center mb-6">Dungeon Test</h1>

  {#if phase === 'select'}
    <!-- Dungeon & Team Selection -->
    <div class="space-y-4">
      <!-- Dungeon picker -->
      <div class="bg-slate-800 rounded-lg p-4">
        <h3 class="font-bold text-amber-400 mb-2">Select Dungeon</h3>
        {#if allDungeons.length === 0}
          <p class="text-gray-500 text-sm">No dungeons available. Create one in the Admin panel.</p>
        {:else}
          <div class="space-y-1">
            {#each allDungeons as dungeon (dungeon.id)}
              <button
                onclick={() => (selectedDungeonId = dungeon.id)}
                class="w-full text-left px-3 py-2 rounded transition-colors
                  {selectedDungeonId === dungeon.id
                    ? 'bg-amber-800 text-amber-100'
                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'}"
              >
                <span class="font-medium">{dungeon.name}</span>
                <span class="text-xs ml-2 opacity-70">{dungeon.rooms.length} rooms</span>
                {#if dungeon.description}
                  <span class="text-xs ml-2 opacity-50">{dungeon.description}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <!-- Team picker -->
      <div class="bg-slate-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-bold text-blue-400">Your Team ({playerTeamIds.length}/5)</h3>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-400">Lv</span>
            <input type="number" min="1" max="100" bind:value={playerLevel}
              class="w-14 px-1 py-0.5 bg-slate-700 rounded text-xs" />
            <span class="text-xs text-gray-400 ml-2">Seed</span>
            <input type="number" bind:value={seed}
              class="w-20 px-1 py-0.5 bg-slate-700 rounded text-xs" />
          </div>
        </div>
        {#each ROLES as role}
          {@const chars = charactersByRole(role)}
          {#if chars.length > 0}
            <div class="mb-1">
              <span class="text-xs font-bold capitalize {ROLE_COLORS[role]}">{role}</span>
              <div class="flex flex-wrap gap-1 mt-0.5">
                {#each chars as char (char.id)}
                  <button
                    onclick={() => toggleChar(char.id)}
                    class="px-2 py-1 rounded text-xs transition-colors
                      {playerTeamIds.includes(char.id)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}"
                  >
                    {char.name}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        {/each}
      </div>

      <!-- Start button -->
      <div class="text-center">
        <button
          onclick={startDungeon}
          disabled={!selectedDungeon || playerTeamIds.length === 0 || (selectedDungeon?.rooms.length ?? 0) === 0}
          class="px-8 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 rounded-lg font-bold text-lg"
        >
          Enter Dungeon
        </button>
      </div>
    </div>

  {:else}
    <!-- Dungeon progress header -->
    <div class="bg-slate-800 rounded-lg p-3 mb-4">
      <div class="flex items-center justify-between mb-2">
        <span class="font-bold text-amber-400">{selectedDungeon?.name}</span>
        <button
          onclick={backToSelect}
          class="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
        >
          Abandon
        </button>
      </div>
      <!-- Room progress bar -->
      {#if selectedDungeon}
        <div class="flex gap-1">
          {#each selectedDungeon.rooms as room, i}
            {@const rr = roomResults[i]}
            <div class="flex-1 h-2 rounded
              {i === currentRoomIndex && phase === 'running' ? 'bg-amber-500 animate-pulse' :
               rr ? (rr.result.winner === 'player' ? 'bg-green-500' : 'bg-red-500') :
               'bg-slate-600'}">
            </div>
          {/each}
        </div>
        <div class="flex justify-between mt-1">
          {#each selectedDungeon.rooms as room, i}
            <span class="text-xs {i === currentRoomIndex ? 'text-amber-400 font-bold' : 'text-gray-500'}">
              {room.roomNumber}
            </span>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Team HP summary -->
    <div class="bg-slate-800 rounded-lg p-3 mb-4">
      <h4 class="text-xs font-bold text-blue-400 mb-1">Team Status</h4>
      <div class="flex gap-3 flex-wrap">
        {#each playerTeamIds as charId}
          {@const char = allCharacters.find((c) => c.id === charId)}
          {@const hp = survivorHp.get(charId)}
          {#if char}
            <div class="flex items-center gap-1">
              <span class="text-xs {hp && hp.currentHp <= 0 ? 'text-red-500 line-through' : 'text-gray-300'}">
                {char.name}
              </span>
              {#if hp}
                <span class="text-xs {hp.currentHp <= 0 ? 'text-red-500' : hp.currentHp < hp.maxHp * 0.5 ? 'text-yellow-400' : 'text-green-400'}">
                  {hp.currentHp}/{hp.maxHp}
                </span>
              {/if}
            </div>
          {/if}
        {/each}
      </div>
    </div>

    {#if phase === 'running' || phase === 'room_result'}
      <!-- Current room info -->
      {#if currentRoom}
        <div class="text-center mb-3">
          <span class="text-sm text-gray-400">Room {currentRoom.roomNumber}</span>
          <span class="font-bold ml-2">{currentRoom.name}</span>
          {#if currentRoom.isBoss}
            <span class="text-red-400 ml-2 text-xs font-bold">BOSS</span>
          {/if}
          <span class="text-xs text-gray-500 ml-2">x{currentRoom.difficultyMult.toFixed(1)}</span>
        </div>
      {/if}

      <!-- Battle Grid -->
      {#if displayUnits.length > 0}
        <div class="mb-4">
          <BattleGrid {playerDisplayUnits} {enemyDisplayUnits} />
        </div>
      {/if}

      <!-- Playback Controls -->
      <div class="flex justify-center gap-3 mb-4">
        <button
          onclick={togglePlay}
          disabled={actionLog.length === 0}
          class="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded font-bold"
        >
          {isPlaying ? 'Pause' : battleDone ? 'Done' : 'Play'}
        </button>

        <button
          onclick={stepForward}
          disabled={currentActionIndex >= actionLog.length - 1}
          class="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 rounded"
        >
          Next
        </button>

        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-400">Speed:</span>
          <select bind:value={playbackSpeed} class="px-1 py-1 bg-slate-700 rounded text-xs">
            <option value={500}>Slow</option>
            <option value={250}>Normal</option>
            <option value={100}>Fast</option>
            <option value={50}>Very Fast</option>
          </select>
        </div>
      </div>

      <!-- Room result -->
      {#if battleDone && latestResult}
        <div class="mb-4 p-3 rounded-lg text-center font-bold
          {latestResult.winner === 'player' ? 'bg-green-900' : 'bg-red-900'}">
          {#if latestResult.winner === 'player'}
            Room Cleared! ({latestResult.turns} turns)
          {:else}
            Defeated in room {currentRoom?.roomNumber}...
          {/if}
        </div>
        <div class="text-center mb-4">
          <button
            onclick={proceedToNextRoom}
            class="px-6 py-2 bg-amber-600 hover:bg-amber-700 rounded font-bold"
          >
            {latestResult.winner !== 'player'
              ? 'End Run'
              : selectedDungeon && currentRoomIndex >= selectedDungeon.rooms.length - 1
                ? 'Finish Dungeon'
                : 'Next Room'}
          </button>
        </div>
      {/if}

      <!-- Battle Log -->
      <BattleLog actions={actionLog} currentIndex={currentActionIndex} />

    {:else if phase === 'dungeon_complete'}
      <!-- Final results -->
      <div class="bg-slate-800 rounded-lg p-6 text-center">
        <h2 class="text-2xl font-bold mb-4
          {dungeonWon ? 'text-green-400' : 'text-red-400'}">
          {dungeonWon ? 'Dungeon Cleared!' : 'Dungeon Failed'}
        </h2>

        <div class="space-y-2 mb-6">
          {#each roomResults as rr, i}
            <div class="flex items-center gap-3 px-3 py-2 rounded
              {rr.result.winner === 'player' ? 'bg-green-900/30' : 'bg-red-900/30'}">
              <span class="w-8 h-8 flex items-center justify-center rounded font-bold text-sm
                {rr.room.isBoss ? 'bg-red-800' : 'bg-slate-700'}">
                {rr.room.roomNumber}
              </span>
              <span class="flex-1 text-left text-sm">{rr.room.name}</span>
              <span class="text-xs text-gray-400">{rr.result.turns} turns</span>
              <span class="text-sm font-bold
                {rr.result.winner === 'player' ? 'text-green-400' : 'text-red-400'}">
                {rr.result.winner === 'player' ? 'Cleared' : 'Defeated'}
              </span>
            </div>
          {/each}
        </div>

        <button
          onclick={backToSelect}
          class="px-6 py-2 bg-amber-600 hover:bg-amber-700 rounded font-bold"
        >
          Back to Selection
        </button>
      </div>
    {/if}
  {/if}
</div>
