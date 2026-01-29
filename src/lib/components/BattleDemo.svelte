<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Character,
    AutoBattleSimulation,
    CHARACTER_DEFINITIONS,
    type CombatState,
    type CombatAction,
    type BattleResult,
    type Role,
  } from '../game';
  import BattleGrid from './BattleGrid.svelte';
  import BattleLog from './BattleLog.svelte';

  // Battle state
  let seed = $state(12345);
  let battleResult: BattleResult | null = $state(null);
  let currentActionIndex = $state(-1);
  let isPlaying = $state(false);
  let playbackSpeed = $state(500); // ms per action

  // Unit tracking for grid display
  let playerUnits: Map<string, CombatState> = $state(new Map());
  let enemyUnits: Map<string, CombatState> = $state(new Map());
  let characterNames: Map<string, string> = $state(new Map());
  let characterRoles: Map<string, Role> = $state(new Map());

  // Create test teams
  function createTestTeams() {
    // Player team: Tank, Archer, Mage
    const playerTeam = [
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_001')!, 10, 0), // Bruno (Tank)
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_003')!, 10, 0), // Flynn (Archer)
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_004')!, 10, 0), // Mira (Mage)
    ];

    // Enemy team: Warrior, Assassin, Healer
    const enemyTeam = [
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_002')!, 10, 0), // Aria (Warrior)
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_005')!, 10, 0), // Shade (Assassin)
      new Character(CHARACTER_DEFINITIONS.find((c) => c.id === 'char_008')!, 10, 0), // Elara (Healer)
    ];

    return { playerTeam, enemyTeam };
  }

  // Run battle simulation
  function runBattle() {
    const { playerTeam, enemyTeam } = createTestTeams();

    // Store character info for display
    characterNames = new Map();
    characterRoles = new Map();
    for (const char of [...playerTeam, ...enemyTeam]) {
      characterNames.set(char.id, char.name);
      characterRoles.set(char.id, char.role);
    }

    // Run simulation
    const simulation = new AutoBattleSimulation(playerTeam, enemyTeam, seed);
    battleResult = simulation.simulate();

    // Extract initial states by re-creating simulation for display
    const displaySimulation = new AutoBattleSimulation(playerTeam, enemyTeam, seed);

    // We need to access internal state - let's create a simpler approach
    initializeDisplayState(playerTeam, enemyTeam);

    currentActionIndex = -1;
    isPlaying = false;
  }

  function initializeDisplayState(playerTeam: Character[], enemyTeam: Character[]) {
    playerUnits = new Map();
    enemyUnits = new Map();

    // Simple positioning based on role preferences
    const ROLE_PREFERRED_ROW: Record<Role, 0 | 1 | 2> = {
      tank: 0,
      warrior: 0,
      archer: 2,
      mage: 2,
      assassin: 1,
      healer: 2,
    };

    const assignPositions = (team: Character[], isPlayer: boolean) => {
      const sorted = [...team].sort(
        (a, b) => ROLE_PREFERRED_ROW[a.role] - ROLE_PREFERRED_ROW[b.role]
      );
      const usedPositions = new Set<string>();

      sorted.forEach((char) => {
        const preferredRow = ROLE_PREFERRED_ROW[char.role];
        let position = null;

        for (let col = 0; col <= 2 && !position; col++) {
          const posKey = `${preferredRow},${col}`;
          if (!usedPositions.has(posKey)) {
            position = { row: preferredRow as 0 | 1 | 2, col: col as 0 | 1 | 2 };
            usedPositions.add(posKey);
          }
        }

        if (!position) {
          for (let row = 0; row <= 2 && !position; row++) {
            for (let col = 0; col <= 2 && !position; col++) {
              const posKey = `${row},${col}`;
              if (!usedPositions.has(posKey)) {
                position = { row: row as 0 | 1 | 2, col: col as 0 | 1 | 2 };
                usedPositions.add(posKey);
              }
            }
          }
        }

        if (position) {
          const state: CombatState = {
            characterId: char.id,
            currentHp: char.hp,
            maxHp: char.hp,
            atk: char.atk,
            def: char.def,
            spd: char.spd,
            position,
            team: isPlayer ? 'player' : 'enemy',
            isAlive: true,
            level: char.level,
            ascension: char.ascension,
          };

          if (isPlayer) {
            playerUnits.set(char.id, state);
          } else {
            enemyUnits.set(char.id, state);
          }
        }
      });
    };

    assignPositions(playerTeam, true);
    assignPositions(enemyTeam, false);
  }

  // Apply action effects to display state
  function applyAction(action: CombatAction) {
    if (action.actionType === 'attack' || action.actionType === 'ability') {
      if (action.targetId && action.damage !== undefined) {
        const targetUnit =
          playerUnits.get(action.targetId) || enemyUnits.get(action.targetId);
        if (targetUnit) {
          targetUnit.currentHp = Math.max(0, targetUnit.currentHp - action.damage);
        }
      }
    } else if (action.actionType === 'heal') {
      if (action.targetId && action.healing !== undefined) {
        const targetUnit =
          playerUnits.get(action.targetId) || enemyUnits.get(action.targetId);
        if (targetUnit) {
          targetUnit.currentHp = Math.min(
            targetUnit.maxHp,
            targetUnit.currentHp + action.healing
          );
        }
      }
    } else if (action.actionType === 'death') {
      const deadUnit =
        playerUnits.get(action.actorId) || enemyUnits.get(action.actorId);
      if (deadUnit) {
        deadUnit.isAlive = false;
      }
    }

    // Trigger reactivity
    playerUnits = new Map(playerUnits);
    enemyUnits = new Map(enemyUnits);
  }

  // Step through actions
  function stepForward() {
    if (!battleResult || currentActionIndex >= battleResult.actionLog.length - 1) return;
    currentActionIndex++;
    applyAction(battleResult.actionLog[currentActionIndex]);
  }

  function stepBackward() {
    if (!battleResult || currentActionIndex < 0) return;
    // Re-run from start to previous action
    const { playerTeam, enemyTeam } = createTestTeams();
    initializeDisplayState(playerTeam, enemyTeam);

    for (let i = 0; i < currentActionIndex; i++) {
      applyAction(battleResult.actionLog[i]);
    }
    currentActionIndex--;
  }

  // Auto-play
  let playInterval: ReturnType<typeof setInterval> | null = null;

  function togglePlay() {
    if (isPlaying) {
      if (playInterval) clearInterval(playInterval);
      playInterval = null;
      isPlaying = false;
    } else {
      isPlaying = true;
      playInterval = setInterval(() => {
        if (!battleResult || currentActionIndex >= battleResult.actionLog.length - 1) {
          if (playInterval) clearInterval(playInterval);
          playInterval = null;
          isPlaying = false;
          return;
        }
        stepForward();
      }, playbackSpeed);
    }
  }

  function resetBattle() {
    if (playInterval) clearInterval(playInterval);
    playInterval = null;
    isPlaying = false;
    runBattle();
  }

  // Verify determinism
  let determinismResult = $state('');

  function testDeterminism() {
    const { playerTeam: team1_1, enemyTeam: team1_2 } = createTestTeams();
    const { playerTeam: team2_1, enemyTeam: team2_2 } = createTestTeams();

    const testSeed = 42;
    const sim1 = new AutoBattleSimulation(team1_1, team1_2, testSeed);
    const sim2 = new AutoBattleSimulation(team2_1, team2_2, testSeed);

    const result1 = sim1.simulate();
    const result2 = sim2.simulate();

    const match =
      result1.winner === result2.winner &&
      result1.turns === result2.turns &&
      result1.actionLog.length === result2.actionLog.length &&
      result1.actionLog.every(
        (a, i) =>
          a.damage === result2.actionLog[i].damage &&
          a.healing === result2.actionLog[i].healing &&
          a.isCritical === result2.actionLog[i].isCritical
      );

    determinismResult = match
      ? `PASS: Same seed (${testSeed}) produces identical results! Winner: ${result1.winner}, Turns: ${result1.turns}, Actions: ${result1.actionLog.length}`
      : 'FAIL: Results do not match!';
  }

  // Initialize on mount
  onMount(() => {
    runBattle();
  });
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-3xl font-bold text-center mb-6">Auto-Chess Battle Demo</h1>

  <!-- Controls -->
  <div class="flex flex-wrap gap-4 justify-center mb-6">
    <div class="flex items-center gap-2">
      <label for="seed" class="text-sm">Seed:</label>
      <input
        id="seed"
        type="number"
        bind:value={seed}
        class="w-24 px-2 py-1 bg-slate-700 rounded text-white"
      />
    </div>

    <button
      onclick={resetBattle}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded font-bold"
    >
      New Battle
    </button>

    <button
      onclick={testDeterminism}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold"
    >
      Test Determinism
    </button>
  </div>

  {#if determinismResult}
    <div
      class="mb-4 p-3 rounded text-center font-mono text-sm
        {determinismResult.startsWith('PASS') ? 'bg-green-900' : 'bg-red-900'}"
    >
      {determinismResult}
    </div>
  {/if}

  <!-- Battle Grid -->
  <div class="mb-6">
    <BattleGrid {playerUnits} {enemyUnits} {characterNames} {characterRoles} />
  </div>

  <!-- Playback Controls -->
  <div class="flex justify-center gap-4 mb-4">
    <button
      onclick={stepBackward}
      disabled={!battleResult || currentActionIndex < 0}
      class="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
    >
      ⏮️ Prev
    </button>

    <button
      onclick={togglePlay}
      disabled={!battleResult}
      class="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold"
    >
      {isPlaying ? '⏸️ Pause' : '▶️ Play'}
    </button>

    <button
      onclick={stepForward}
      disabled={!battleResult || currentActionIndex >= (battleResult?.actionLog.length ?? 0) - 1}
      class="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
    >
      Next ⏭️
    </button>

    <div class="flex items-center gap-2">
      <label for="speed" class="text-sm">Speed:</label>
      <select
        id="speed"
        bind:value={playbackSpeed}
        class="px-2 py-1 bg-slate-700 rounded"
      >
        <option value={1000}>Slow</option>
        <option value={500}>Normal</option>
        <option value={250}>Fast</option>
        <option value={100}>Very Fast</option>
      </select>
    </div>
  </div>

  <!-- Battle Result -->
  {#if battleResult && currentActionIndex >= battleResult.actionLog.length - 1}
    <div
      class="mb-4 p-4 rounded-lg text-center font-bold text-xl
        {battleResult.winner === 'player' ? 'bg-blue-900' : battleResult.winner === 'enemy' ? 'bg-red-900' : 'bg-gray-700'}"
    >
      {#if battleResult.winner === 'player'}
        VICTORY! Player wins in {battleResult.turns} turns
      {:else if battleResult.winner === 'enemy'}
        DEFEAT! Enemy wins in {battleResult.turns} turns
      {:else}
        DRAW after {battleResult.turns} turns
      {/if}
    </div>
  {/if}

  <!-- Action Log -->
  <BattleLog actions={battleResult?.actionLog ?? []} currentIndex={currentActionIndex} />

  <!-- Stats Panel -->
  {#if battleResult}
    <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
      <div class="bg-slate-800 p-3 rounded">
        <h4 class="font-bold text-blue-400 mb-2">Player Team Stats</h4>
        {#each playerUnits.values() as unit}
          <div class="flex justify-between">
            <span>{characterNames.get(unit.characterId)}</span>
            <span class="{unit.isAlive ? 'text-green-400' : 'text-red-400'}">
              {unit.currentHp}/{unit.maxHp} HP
            </span>
          </div>
        {/each}
      </div>

      <div class="bg-slate-800 p-3 rounded">
        <h4 class="font-bold text-red-400 mb-2">Enemy Team Stats</h4>
        {#each enemyUnits.values() as unit}
          <div class="flex justify-between">
            <span>{characterNames.get(unit.characterId)}</span>
            <span class="{unit.isAlive ? 'text-green-400' : 'text-red-400'}">
              {unit.currentHp}/{unit.maxHp} HP
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
