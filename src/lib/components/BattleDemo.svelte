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
    ROLE_PREFERRED_ROW,
  } from '../game';

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer', 'summoner'];
  const ROLE_COLORS: Record<Role, string> = {
    tank: 'text-blue-400',
    warrior: 'text-orange-400',
    archer: 'text-green-400',
    mage: 'text-purple-400',
    assassin: 'text-gray-300',
    healer: 'text-emerald-400',
    summoner: 'text-teal-400',
  };

  function charactersByRole(role: Role): CharacterDefinition[] {
    return allCharacters.filter((c) => c.role === role);
  }
  import { loadContent } from '../admin/contentStore';
  import BattleGrid from './BattleGrid.svelte';
  import BattleLog from './BattleLog.svelte';

  /** Flat display unit for the grid (no Maps, no deep proxies) */
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
    isBoss?: boolean;
    isSummoned?: boolean;
  }

  // Battle state
  let seed = $state(12345);
  let battleResult: BattleResult | null = $state(null);
  let currentActionIndex = $state(-1);
  let isPlaying = $state(false);
  let playbackSpeed = $state(500);
  let determinismResult = $state('');

  // Display data (flat arrays, no Maps)
  let displayUnits: DisplayUnit[] = $state([]);
  let actionLog: CombatAction[] = $state([]);

  // Available characters loaded from content store
  let allCharacters: CharacterDefinition[] = $state([]);
  let allAbilities: import('../game/abilities').AbilityDefinition[] = $state([]);
  let customRoleStats: Partial<Record<Role, import('../game/types').BaseStats>> | undefined = $state(undefined);
  let playerTeamIds: string[] = $state([]);
  let enemyTeamIds: string[] = $state([]);
  let playerLevel = $state(10);
  let enemyLevel = $state(10);

  function loadCharacters() {
    const content = loadContent();
    allCharacters = content.characters;
    allAbilities = content.abilities;
    customRoleStats = content.roleStats;

    // Default selection: first 3 characters per team
    if (playerTeamIds.length === 0 && allCharacters.length >= 3) {
      playerTeamIds = allCharacters.slice(0, 3).map((c) => c.id);
    }
    if (enemyTeamIds.length === 0 && allCharacters.length >= 6) {
      enemyTeamIds = allCharacters.slice(3, 6).map((c) => c.id);
    }
  }

  function createTeamsFromSelection() {
    const playerTeam = playerTeamIds
      .map((id) => allCharacters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined)
      .map((def) => new Character(def, playerLevel, 0, customRoleStats));

    const enemyTeam = enemyTeamIds
      .map((id) => allCharacters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined)
      .map((def) => new Character(def, enemyLevel, 0, customRoleStats));

    return { playerTeam, enemyTeam };
  }

  function toggleCharInTeam(charId: string, team: 'player' | 'enemy') {
    if (team === 'player') {
      if (playerTeamIds.includes(charId)) {
        playerTeamIds = playerTeamIds.filter((id) => id !== charId);
      } else if (playerTeamIds.length < 5) {
        playerTeamIds = [...playerTeamIds, charId];
      }
    } else {
      if (enemyTeamIds.includes(charId)) {
        enemyTeamIds = enemyTeamIds.filter((id) => id !== charId);
      } else if (enemyTeamIds.length < 5) {
        enemyTeamIds = [...enemyTeamIds, charId];
      }
    }
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
          units.push({
            id: char.id,
            name: char.name,
            role: char.role,
            currentHp: char.hp,
            maxHp: char.hp,
            atk: char.atk,
            def: char.def,
            spd: char.spd,
            position: pos,
            team: teamType,
            isAlive: true,
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

  function runBattle() {
    const { playerTeam, enemyTeam } = createTeamsFromSelection();
    if (playerTeam.length === 0 || enemyTeam.length === 0) return;

    const simulation = new AutoBattleSimulation(playerTeam, enemyTeam, seed, {
      abilityDefs: allAbilities,
    });
    battleResult = simulation.simulate();
    actionLog = battleResult.actionLog;
    displayUnits = buildDisplayUnits(playerTeam, enemyTeam);
    currentActionIndex = -1;
    isPlaying = false;
  }

  function applyAction(action: CombatAction) {
    // Clone array for reactivity — reset living units to idle, keep dead in death, clear hit effects
    // Filter out dead summoned units so they disappear from the grid
    const updated = displayUnits
      .filter((u) => u.isAlive || !u.isSummoned)
      .map((u) => ({ ...u, animState: (u.isAlive ? 'idle' : 'death') as AnimState, hitEffect: undefined as HitEffect | undefined }));

    if (action.actionType === 'attack' || action.actionType === 'ability') {
      // Actor animates
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = action.actionType === 'ability' ? 'castAbility' : 'attack';
      }
      // AOE: apply per-target damage from aoeTargets array
      if (action.aoeTargets && action.aoeTargets.length > 0) {
        for (const aoe of action.aoeTargets) {
          const tIdx = updated.findIndex((u) => u.id === aoe.id);
          if (tIdx !== -1) {
            updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - aoe.damage);
            updated[tIdx].hitEffect = 'damage';
          }
        }
      } else {
        // Single target
        const tIdx = updated.findIndex((u) => u.id === action.targetId);
        if (tIdx !== -1 && action.damage !== undefined) {
          updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - action.damage);
          updated[tIdx].hitEffect = 'damage';
        }
      }
    } else if (action.actionType === 'heal') {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
      }
      const tIdx = updated.findIndex((u) => u.id === action.targetId);
      if (tIdx !== -1 && action.healing !== undefined) {
        updated[tIdx].currentHp = Math.min(updated[tIdx].maxHp, updated[tIdx].currentHp + action.healing);
        updated[tIdx].hitEffect = 'heal';
      }
    } else if (action.actionType === 'death') {
      const dIdx = updated.findIndex((u) => u.id === action.actorId);
      if (dIdx !== -1) {
        updated[dIdx].isAlive = false;
        updated[dIdx].currentHp = 0;
        updated[dIdx].animState = 'death';
      }
    } else if (action.actionType === 'summon' && action.summonedUnit) {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
      }
      const su = action.summonedUnit;
      updated.push({
        id: su.id,
        name: su.name,
        role: su.role,
        currentHp: su.hp,
        maxHp: su.hp,
        atk: su.atk,
        def: su.def,
        spd: su.spd,
        position: su.position,
        team: su.team,
        isAlive: true,
        sprites: su.sprites,
        animState: 'idle' as AnimState,
        isSummoned: true,
      });
    }

    displayUnits = updated;
  }

  function stepForward() {
    if (!battleResult || currentActionIndex >= actionLog.length - 1) return;
    currentActionIndex++;
    applyAction(actionLog[currentActionIndex]);
  }

  function stepBackward() {
    if (!battleResult || currentActionIndex < 0) return;
    const { playerTeam, enemyTeam } = createTeamsFromSelection();
    const fresh = buildDisplayUnits(playerTeam, enemyTeam);
    const targetIndex = currentActionIndex - 1;
    // Replay up to targetIndex
    let units = fresh;
    for (let i = 0; i <= targetIndex; i++) {
      units = replayAction(units, actionLog[i]);
    }
    displayUnits = units;
    currentActionIndex = targetIndex;
  }

  function replayAction(units: DisplayUnit[], action: CombatAction): DisplayUnit[] {
    // Filter out dead summoned units
    const updated = units
      .filter((u) => u.isAlive || !u.isSummoned)
      .map((u) => ({ ...u, animState: (u.isAlive ? 'idle' : 'death') as AnimState, hitEffect: undefined as HitEffect | undefined }));
    if (action.actionType === 'attack' || action.actionType === 'ability') {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = action.actionType === 'ability' ? 'castAbility' : 'attack';
      }
      // AOE: apply per-target damage
      if (action.aoeTargets && action.aoeTargets.length > 0) {
        for (const aoe of action.aoeTargets) {
          const tIdx = updated.findIndex((u) => u.id === aoe.id);
          if (tIdx !== -1) {
            updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - aoe.damage);
            updated[tIdx].hitEffect = 'damage';
          }
        }
      } else {
        const tIdx = updated.findIndex((u) => u.id === action.targetId);
        if (tIdx !== -1 && action.damage !== undefined) {
          updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - action.damage);
          updated[tIdx].hitEffect = 'damage';
        }
      }
    } else if (action.actionType === 'heal') {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
      }
      const tIdx = updated.findIndex((u) => u.id === action.targetId);
      if (tIdx !== -1 && action.healing !== undefined) {
        updated[tIdx].currentHp = Math.min(updated[tIdx].maxHp, updated[tIdx].currentHp + action.healing);
        updated[tIdx].hitEffect = 'heal';
      }
    } else if (action.actionType === 'death') {
      const dIdx = updated.findIndex((u) => u.id === action.actorId);
      if (dIdx !== -1) {
        updated[dIdx].isAlive = false;
        updated[dIdx].currentHp = 0;
        updated[dIdx].animState = 'death';
      }
    } else if (action.actionType === 'summon' && action.summonedUnit) {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
      }
      const su = action.summonedUnit;
      updated.push({
        id: su.id,
        name: su.name,
        role: su.role,
        currentHp: su.hp,
        maxHp: su.hp,
        atk: su.atk,
        def: su.def,
        spd: su.spd,
        position: su.position,
        team: su.team,
        isAlive: true,
        sprites: su.sprites,
        animState: 'idle' as AnimState,
        isSummoned: true,
      });
    }
    return updated;
  }

  let playInterval: ReturnType<typeof setInterval> | null = null;

  function togglePlay() {
    if (isPlaying) {
      if (playInterval) clearInterval(playInterval);
      playInterval = null;
      isPlaying = false;
    } else {
      isPlaying = true;
      playInterval = setInterval(() => {
        if (!battleResult || currentActionIndex >= actionLog.length - 1) {
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

  function testDeterminism() {
    const { playerTeam: t1p, enemyTeam: t1e } = createTeamsFromSelection();
    const { playerTeam: t2p, enemyTeam: t2e } = createTeamsFromSelection();

    const testSeed = 42;
    const r1 = new AutoBattleSimulation(t1p, t1e, testSeed).simulate();
    const r2 = new AutoBattleSimulation(t2p, t2e, testSeed).simulate();

    const match =
      r1.winner === r2.winner &&
      r1.turns === r2.turns &&
      r1.actionLog.length === r2.actionLog.length &&
      r1.actionLog.every(
        (a, i) =>
          a.damage === r2.actionLog[i].damage &&
          a.healing === r2.actionLog[i].healing &&
          a.isCritical === r2.actionLog[i].isCritical
      );

    determinismResult = match
      ? `PASS: Same seed (${testSeed}) produces identical results! Winner: ${r1.winner}, Turns: ${r1.turns}, Actions: ${r1.actionLog.length}`
      : 'FAIL: Results do not match!';
  }

  onMount(() => {
    loadCharacters();
    runBattle();
  });

  let playerDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'player'));
  let enemyDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'enemy'));
  let battleDone = $derived(
    battleResult !== null && currentActionIndex >= actionLog.length - 1
  );
</script>

<div class="max-w-4xl mx-auto p-4">
  <h1 class="text-3xl font-bold text-center mb-6">Auto-Chess Battle Demo</h1>

  <!-- Team Selection -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
    <!-- Player Team -->
    <div class="bg-slate-800 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold text-blue-400 text-sm">Player Team ({playerTeamIds.length}/5)</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">Lv</span>
          <input type="number" min="1" max="100" bind:value={playerLevel}
            class="w-14 px-1 py-0.5 bg-slate-700 rounded text-xs" />
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
                  onclick={() => toggleCharInTeam(char.id, 'player')}
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

    <!-- Enemy Team -->
    <div class="bg-slate-800 rounded-lg p-3">
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-bold text-red-400 text-sm">Enemy Team ({enemyTeamIds.length}/5)</h3>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">Lv</span>
          <input type="number" min="1" max="100" bind:value={enemyLevel}
            class="w-14 px-1 py-0.5 bg-slate-700 rounded text-xs" />
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
                  onclick={() => toggleCharInTeam(char.id, 'enemy')}
                  class="px-2 py-1 rounded text-xs transition-colors
                    {enemyTeamIds.includes(char.id)
                      ? 'bg-red-600 text-white'
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
  </div>

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
      disabled={playerTeamIds.length === 0 || enemyTeamIds.length === 0}
      class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded font-bold"
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
    <BattleGrid {playerDisplayUnits} {enemyDisplayUnits} />
  </div>

  <!-- Playback Controls -->
  <div class="flex justify-center gap-4 mb-4">
    <button
      onclick={stepBackward}
      disabled={!battleResult || currentActionIndex < 0}
      class="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
    >
      Prev
    </button>

    <button
      onclick={togglePlay}
      disabled={!battleResult}
      class="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded font-bold"
    >
      {isPlaying ? 'Pause' : 'Play'}
    </button>

    <button
      onclick={stepForward}
      disabled={!battleResult || currentActionIndex >= actionLog.length - 1}
      class="px-4 py-2 bg-slate-600 hover:bg-slate-500 disabled:opacity-50 disabled:cursor-not-allowed rounded"
    >
      Next
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
  {#if battleDone && battleResult}
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
  <BattleLog actions={actionLog} currentIndex={currentActionIndex} />

  <!-- Stats Panel -->
  {#if battleResult}
    <div class="mt-4 grid grid-cols-2 gap-4 text-sm">
      <div class="bg-slate-800 p-3 rounded">
        <h4 class="font-bold text-blue-400 mb-2">Player Team Stats</h4>
        {#each playerDisplayUnits as unit (unit.id)}
          <div class="flex justify-between">
            <span>{unit.name}</span>
            <span class="{unit.isAlive ? 'text-green-400' : 'text-red-400'}">
              {unit.currentHp}/{unit.maxHp} HP
            </span>
          </div>
        {/each}
      </div>

      <div class="bg-slate-800 p-3 rounded">
        <h4 class="font-bold text-red-400 mb-2">Enemy Team Stats</h4>
        {#each enemyDisplayUnits as unit (unit.id)}
          <div class="flex justify-between">
            <span>{unit.name}</span>
            <span class="{unit.isAlive ? 'text-green-400' : 'text-red-400'}">
              {unit.currentHp}/{unit.maxHp} HP
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
