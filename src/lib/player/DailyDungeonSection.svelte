<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import {
    Character,
    AutoBattleSimulation,
    type CharacterDefinition,
    type CombatAction,
    type BattleResult,
    type Role,
    type Position,
    type SpriteSet,
    type SpriteSource,
    type AnimState,
    type HitEffect,
    type SummonTemplate,
    ROLE_BASE_STATS,
    ROLE_PREFERRED_ROW,
    COMBAT_CONSTANTS,
  } from '../game';
  import type { BaseStats, Rarity } from '../game/types';
  import type { Dungeon, DungeonRoom, EnemyTemplate, GachaConfig } from '../admin/adminTypes';
  import type { AbilityDefinition } from '../game/abilities';
  import type { PlayerSave, OwnedCharacter } from './playerStore';
  import { getXpForLevel, hasRoomAwardedXp } from './playerStore';
  import BattleGrid from '../components/BattleGrid.svelte';
  import BattleLog from '../components/BattleLog.svelte';

  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    dungeon: Dungeon;
    enemies: EnemyTemplate[];
    abilities: AbilityDefinition[];
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    levelThresholds?: number[];
    maxTeamSize?: number;
    onAttemptUsed: () => void;
    onDungeonCleared: () => void;
    onXpAwarded: (survivorIds: string[], xp: number) => void;
    onRoomXpAwarded: (roomIndex: number) => void;
  }

  let { playerSave, characters, dungeon, enemies, abilities, roleStats, rarityMultipliers, levelThresholds, maxTeamSize = 5, onAttemptUsed, onDungeonCleared, onXpAwarded, onRoomXpAwarded }: Props = $props();

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'bg-blue-900', warrior: 'bg-orange-900', archer: 'bg-green-900',
    mage: 'bg-purple-900', assassin: 'bg-gray-800', healer: 'bg-emerald-900',
    summoner: 'bg-teal-900',
  };

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
    abilityOverlay?: SpriteSource;
  }

  // Selection
  let selectedIds: string[] = $state([]);
  let phase: 'select' | 'running' | 'room_result' | 'complete' | 'failed' = $state('select');
  let currentRoomIndex = $state(0);
  let roomResults: { room: DungeonRoom; result: BattleResult }[] = $state([]);

  // Battle display
  let displayUnits: DisplayUnit[] = $state([]);
  let actionLog: CombatAction[] = $state([]);
  let currentActionIndex = $state(-1);
  let isPlaying = $state(false);
  let playbackSpeed = $state(500);
  let playInterval: ReturnType<typeof setInterval> | null = null;

  // Carry-over HP
  let survivorHp: Map<string, { currentHp: number; maxHp: number }> = $state(new Map());

  // XP gain display after room win
  interface XpGainEntry {
    characterId: string;
    name: string;
    prevXp: number;
    prevLevel: number;
    newXp: number;
    newLevel: number;
    xpGained: number;
    sprites?: import('../game/types').SpriteSet;
    role: Role;
  }
  let xpGains: XpGainEntry[] = $state([]);
  let showXpScreen = $state(false);

  // Track boss/summoner
  let enemyBossIds: Set<string> = new Set();
  let bossAbilityMap: Map<string, Role[]> = new Map();
  let summonerConfigMap: Map<string, { templates: SummonTemplate[]; maxSummons: number }> = new Map();
  let characterAbilityIds: Map<string, string[]> = new Map();

  let playerDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'player'));
  let enemyDisplayUnits = $derived(displayUnits.filter((u) => u.team === 'enemy'));
  let battleDone = $derived(currentActionIndex >= actionLog.length - 1 && actionLog.length > 0);
  let latestResult = $derived(roomResults.length > 0 ? roomResults[roomResults.length - 1].result : null);
  let currentRoom = $derived(currentRoomIndex < dungeon.rooms.length ? dungeon.rooms[currentRoomIndex] : null);

  // Owned characters available for selection
  let ownedCharacters = $derived(
    playerSave.collection
      .map((o) => ({ owned: o, def: characters.find((c) => c.id === o.characterId) }))
      .filter((x): x is { owned: OwnedCharacter; def: CharacterDefinition } => x.def !== undefined)
  );

  function toggleSelect(charId: string) {
    if (selectedIds.includes(charId)) {
      selectedIds = selectedIds.filter((id) => id !== charId);
    } else if (selectedIds.length < maxTeamSize) {
      selectedIds = [...selectedIds, charId];
    }
  }

  function startDungeon() {
    if (selectedIds.length === 0) return;
    phase = 'running';
    currentRoomIndex = 0;
    roomResults = [];
    survivorHp = new Map();
    onAttemptUsed();
    runCurrentRoom();
  }

  function createPlayerTeam(): Character[] {
    return selectedIds
      .map((id) => {
        // After room 0, only include survivors (characters still in survivorHp)
        if (currentRoomIndex > 0 && survivorHp.size > 0 && !survivorHp.has(id)) return null;
        const entry = ownedCharacters.find((x) => x.owned.characterId === id);
        if (!entry) return null;

        // Register player summoner configs
        if (entry.def.role === 'summoner' && entry.def.summonIds && entry.def.summonIds.length > 0) {
          const templates: SummonTemplate[] = entry.def.summonIds
            .map((sid) => {
              const summonDef = characters.find((c) => c.id === sid);
              if (!summonDef) return null;
              // Summon at the summoner's level/ascension
              return {
                id: summonDef.id,
                name: summonDef.name,
                role: summonDef.role,
                level: entry.owned.level,
                ascension: entry.owned.ascension,
                sprites: summonDef.sprites,
              } satisfies SummonTemplate;
            })
            .filter((t): t is SummonTemplate => t !== null);
          if (templates.length > 0) {
            summonerConfigMap.set(id, { templates, maxSummons: entry.def.maxSummons ?? 1 });
          }
        }

        return new Character(entry.def, entry.owned.level, entry.owned.ascension, roleStats, rarityMultipliers);
      })
      .filter((c): c is Character => c !== null);
  }

  function createEnemyTeamFromRoom(room: DungeonRoom): Character[] {
    enemyBossIds = new Set();
    bossAbilityMap = new Map();
    // Note: summonerConfigMap is reset in runCurrentRoom() before both teams are built
    characterAbilityIds = new Map();

    return room.enemies
      .map((re) => {
        const template = enemies.find((e) => e.id === re.enemyTemplateId);
        if (!template) return null;
        const charId = `${template.id}_${Math.random().toString(36).slice(2, 6)}`;
        const def: CharacterDefinition = {
          id: charId,
          name: template.name,
          role: template.role,
          rarity: template.rarity,
          abilityName: '',
          abilityDescription: '',
          sprites: template.sprites ?? (template.sprite ? { idle: template.sprite } : undefined),
        };
        const level = Math.max(1, Math.round(template.level * room.difficultyMult));

        if (template.isBoss && template.abilityIds && template.abilityIds.length > 0) {
          characterAbilityIds.set(charId, [...template.abilityIds]);
        } else if (template.abilityId) {
          characterAbilityIds.set(charId, [template.abilityId]);
        }

        if (template.isBoss) {
          enemyBossIds.add(charId);
          if (template.abilityIds && template.abilityIds.length > 0) {
            const roles: Role[] = template.abilityIds.map((aid) => {
              const ab = abilities.find((a) => a.id === aid);
              return ab?.allowedRoles[0] ?? template.role;
            });
            bossAbilityMap.set(charId, roles);
          }
        }

        if (template.role === 'summoner' && template.summonIds && template.summonIds.length > 0) {
          const templates: SummonTemplate[] = template.summonIds
            .map((sid) => enemies.find((e) => e.id === sid))
            .filter((e): e is EnemyTemplate => e !== null && e !== undefined)
            .map((e) => ({
              id: e.id, name: e.name, role: e.role,
              level: Math.max(1, Math.round(e.level * room.difficultyMult)),
              ascension: e.ascension,
              sprites: e.sprites ?? (e.sprite ? { idle: e.sprite } : undefined),
              statOverrides: e.statOverrides,
            }));
          summonerConfigMap.set(charId, { templates, maxSummons: template.maxSummons ?? 1 });
        }

        return new Character(def, level, template.ascension, roleStats, rarityMultipliers);
      })
      .filter((c): c is Character => c !== null);
  }

  function buildDisplayUnits(playerTeam: Character[], enemyTeam: Character[]): DisplayUnit[] {
    const units: DisplayUnit[] = [];
    const hasBossEnemy = enemyTeam.some((c) => enemyBossIds.has(c.id));

    const assignTeam = (team: Character[], teamType: 'player' | 'enemy') => {
      const sorted = [...team].sort((a, b) => ROLE_PREFERRED_ROW[a.role] - ROLE_PREFERRED_ROW[b.role]);
      const used = new Set<string>();

      if (teamType === 'enemy' && hasBossEnemy) {
        for (const char of sorted) {
          const isBoss = enemyBossIds.has(char.id);
          const pos: Position = isBoss
            ? { row: 0, col: 0 }
            : (() => {
                for (let c = 0; c < 3; c++) {
                  const key = `3-${c}`;
                  if (!used.has(key)) { used.add(key); return { row: 3 as const, col: c as 0 | 1 | 2 }; }
                }
                return { row: 3 as const, col: 0 as const };
              })();
          const hp = survivorHp.get(char.id);
          units.push({
            id: char.id, name: char.name, role: char.role,
            currentHp: hp?.currentHp ?? char.hp,
            maxHp: hp?.maxHp ?? char.hp,
            atk: char.atk, def: char.def, spd: char.spd,
            position: pos, team: teamType, isAlive: true,
            sprites: char.sprites, animState: 'idle' as AnimState, isBoss,
          });
        }
      } else {
        for (const char of sorted) {
          const preferred = ROLE_PREFERRED_ROW[char.role];
          let placed = false;
          for (let r = preferred; r < 3 && !placed; r++) {
            for (let c = 0; c < 3 && !placed; c++) {
              const key = `${r}-${c}`;
              if (!used.has(key)) {
                used.add(key);
                const hp = survivorHp.get(char.id);
                units.push({
                  id: char.id, name: char.name, role: char.role,
                  currentHp: hp?.currentHp ?? char.hp,
                  maxHp: hp?.maxHp ?? char.hp,
                  atk: char.atk, def: char.def, spd: char.spd,
                  position: { row: r as 0 | 1 | 2, col: c as 0 | 1 | 2 },
                  team: teamType, isAlive: true, sprites: char.sprites, animState: 'idle' as AnimState,
                });
                placed = true;
              }
            }
          }
          if (!placed) {
            for (let r = 0; r < preferred && !placed; r++) {
              for (let c = 0; c < 3 && !placed; c++) {
                const key = `${r}-${c}`;
                if (!used.has(key)) {
                  used.add(key);
                  const hp = survivorHp.get(char.id);
                  units.push({
                    id: char.id, name: char.name, role: char.role,
                    currentHp: hp?.currentHp ?? char.hp,
                    maxHp: hp?.maxHp ?? char.hp,
                    atk: char.atk, def: char.def, spd: char.spd,
                    position: { row: r as 0 | 1 | 2, col: c as 0 | 1 | 2 },
                    team: teamType, isAlive: true, sprites: char.sprites,
                  });
                  placed = true;
                }
              }
            }
          }
        }
      }
    };

    assignTeam(playerTeam, 'player');
    assignTeam(enemyTeam, 'enemy');
    return units;
  }

  function runCurrentRoom() {
    const room = dungeon.rooms[currentRoomIndex];
    if (!room) return;

    // Reset shared battle config maps before building teams
    summonerConfigMap = new Map();

    const playerTeam = createPlayerTeam();
    if (playerTeam.length === 0) {
      // All player characters are dead — auto-fail
      phase = 'failed';
      return;
    }
    const enemyTeam = createEnemyTeamFromRoom(room);
    if (enemyTeam.length === 0) return;

    const roomSeed = Date.now() + currentRoomIndex * 1000;
    const simulation = new AutoBattleSimulation(playerTeam, enemyTeam, roomSeed, {
      bossAbilities: bossAbilityMap.size > 0 ? bossAbilityMap : undefined,
      summonerConfigs: summonerConfigMap.size > 0 ? summonerConfigMap : undefined,
      customRoleStats: roleStats,
      abilityDefs: abilities,
      characterAbilityIds: characterAbilityIds.size > 0 ? characterAbilityIds : undefined,
      playerHpOverrides: survivorHp.size > 0 ? survivorHp : undefined,
    });
    const result = simulation.simulate();

    actionLog = result.actionLog;
    // Build initial display state (uses current survivorHp for carry-over)
    displayUnits = buildDisplayUnits(playerTeam, enemyTeam);
    currentActionIndex = -1;
    isPlaying = false;

    roomResults = [...roomResults, { room, result }];

    // Snapshot the initial display state for playback BEFORE applying actions
    const initialDisplay = displayUnits.map(u => ({ ...u }));

    // Apply all actions to get final post-battle state for survivor tracking
    for (const action of result.actionLog) {
      applyActionToUnits(displayUnits, action);
    }
    survivorHp = new Map();
    for (const u of displayUnits) {
      if (u.team === 'player' && u.isAlive) {
        survivorHp.set(u.id, { currentHp: u.currentHp, maxHp: u.maxHp });
      }
    }

    // Award XP to survivors if room was won (skip if already awarded for this room index)
    if (result.winner === 'player') {
      const xp = room.xpReward ?? 0;
      const alreadyAwarded = hasRoomAwardedXp(playerSave, currentRoomIndex);
      if (xp > 0 && !alreadyAwarded) {
        onRoomXpAwarded(currentRoomIndex);
        const survivorIds = Array.from(survivorHp.keys());
        // Snapshot pre-XP state
        const preXpSnapshot = new Map<string, { xp: number; level: number }>();
        for (const sid of survivorIds) {
          const owned = playerSave.collection.find((c) => c.characterId === sid);
          if (owned) preXpSnapshot.set(sid, { xp: owned.xp ?? 0, level: owned.level });
        }
        onXpAwarded(survivorIds, xp);
        // Build XP gain entries by comparing with updated playerSave (will be updated by callback)
        // We compute expected new values locally
        const xpEach = Math.floor(xp / survivorIds.length);
        xpGains = survivorIds.map((sid) => {
          const pre = preXpSnapshot.get(sid);
          const def = characters.find((c) => c.id === sid);
          if (!pre || !def) return null;
          // Simulate level-up logic locally for display
          let newXp = pre.xp + xpEach;
          let newLevel = pre.level;
          while (true) {
            const needed = getXpForLevel(newLevel, levelThresholds);
            if (needed === null || newXp < needed) break;
            newXp -= needed;
            newLevel++;
          }
          return {
            characterId: sid,
            name: def.name,
            prevXp: pre.xp,
            prevLevel: pre.level,
            newXp,
            newLevel,
            xpGained: xpEach,
            sprites: def.sprites,
            role: def.role,
          };
        }).filter((e): e is XpGainEntry => e !== null);
        showXpScreen = true;
      }
    }

    // Restore pre-battle display state for playback
    displayUnits = initialDisplay;
    currentActionIndex = -1;
    startPlayback();
  }

  function applyActionToUnits(units: DisplayUnit[], action: CombatAction) {
    if (action.actionType === 'attack' || action.actionType === 'ability') {
      if (action.aoeTargets && action.aoeTargets.length > 0) {
        for (const aoe of action.aoeTargets) {
          const t = units.find((u) => u.id === aoe.id);
          if (t) t.currentHp = Math.max(0, t.currentHp - aoe.damage);
        }
      } else {
        const t = units.find((u) => u.id === action.targetId);
        if (t && action.damage !== undefined) t.currentHp = Math.max(0, t.currentHp - action.damage);
      }
    } else if (action.actionType === 'heal') {
      const t = units.find((u) => u.id === action.targetId);
      if (t && action.healing !== undefined) t.currentHp = Math.min(t.maxHp, t.currentHp + action.healing);
    } else if (action.actionType === 'death') {
      const t = units.find((u) => u.id === action.actorId);
      if (t) { t.isAlive = false; t.currentHp = 0; }
    } else if (action.actionType === 'summon' && action.summonedUnit) {
      const su = action.summonedUnit;
      units.push({
        id: su.id, name: su.name, role: su.role,
        currentHp: su.hp, maxHp: su.hp, atk: su.atk, def: su.def, spd: su.spd,
        position: su.position, team: su.team, isAlive: true, sprites: su.sprites,
        isSummoned: true,
      });
    }
  }

  function applyAction(action: CombatAction) {
    const updated = displayUnits
      .filter((u) => u.isAlive || !u.isSummoned)
      .map((u) => ({ ...u, animState: (u.isAlive ? 'idle' : 'death') as AnimState, hitEffect: undefined as HitEffect | undefined, abilityOverlay: undefined as SpriteSource | undefined }));

    if (action.actionType === 'attack' || action.actionType === 'ability') {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = action.actionType === 'ability' ? 'castAbility' : 'attack';
        if (action.abilityCasterSprite) updated[aIdx].abilityOverlay = action.abilityCasterSprite;
      }
      if (action.aoeTargets && action.aoeTargets.length > 0) {
        for (const aoe of action.aoeTargets) {
          const tIdx = updated.findIndex((u) => u.id === aoe.id);
          if (tIdx !== -1) {
            updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - aoe.damage);
            updated[tIdx].hitEffect = 'damage';
            if (action.abilityTargetSprite) updated[tIdx].abilityOverlay = action.abilityTargetSprite;
            if (updated[tIdx].currentHp <= 0) { updated[tIdx].isAlive = false; updated[tIdx].animState = 'death'; }
          }
        }
      } else {
        const tIdx = updated.findIndex((u) => u.id === action.targetId);
        if (tIdx !== -1 && action.damage !== undefined) {
          updated[tIdx].currentHp = Math.max(0, updated[tIdx].currentHp - action.damage);
          updated[tIdx].hitEffect = 'damage';
          if (action.abilityTargetSprite) updated[tIdx].abilityOverlay = action.abilityTargetSprite;
          if (updated[tIdx].currentHp <= 0) { updated[tIdx].isAlive = false; updated[tIdx].animState = 'death'; }
        }
      }
    } else if (action.actionType === 'heal') {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
        if (action.abilityCasterSprite) updated[aIdx].abilityOverlay = action.abilityCasterSprite;
      }
      const tIdx = updated.findIndex((u) => u.id === action.targetId);
      if (tIdx !== -1 && action.healing !== undefined) {
        updated[tIdx].currentHp = Math.min(updated[tIdx].maxHp, updated[tIdx].currentHp + action.healing);
        updated[tIdx].hitEffect = 'heal';
        if (action.abilityTargetSprite) updated[tIdx].abilityOverlay = action.abilityTargetSprite;
      }
    } else if (action.actionType === 'death') {
      const dIdx = updated.findIndex((u) => u.id === action.actorId);
      if (dIdx !== -1) { updated[dIdx].isAlive = false; updated[dIdx].currentHp = 0; updated[dIdx].animState = 'death'; }
    } else if (action.actionType === 'summon' && action.summonedUnit) {
      const aIdx = updated.findIndex((u) => u.id === action.actorId);
      if (aIdx !== -1) {
        updated[aIdx].animState = 'castAbility';
        if (action.abilityCasterSprite) updated[aIdx].abilityOverlay = action.abilityCasterSprite;
      }
      const su = action.summonedUnit;
      updated.push({
        id: su.id, name: su.name, role: su.role,
        currentHp: su.hp, maxHp: su.hp, atk: su.atk, def: su.def, spd: su.spd,
        position: su.position, team: su.team, isAlive: true, sprites: su.sprites,
        animState: 'idle' as AnimState, isSummoned: true,
      });
    }
    displayUnits = updated;
  }

  function startPlayback() {
    stopPlayback();
    currentActionIndex = -1;
    isPlaying = true;
    playInterval = setInterval(() => {
      if (currentActionIndex < actionLog.length - 1) {
        currentActionIndex++;
        applyAction(actionLog[currentActionIndex]);
      } else {
        stopPlayback();
      }
    }, playbackSpeed);
  }

  function stopPlayback() {
    isPlaying = false;
    if (playInterval) { clearInterval(playInterval); playInterval = null; }
  }

  function handleNextRoom() {
    if (!latestResult || latestResult.winner !== 'player') return;
    if (currentRoomIndex + 1 >= dungeon.rooms.length) {
      phase = 'complete';
      onDungeonCleared();
    } else {
      currentRoomIndex++;
      runCurrentRoom();
    }
  }

  function handleDefeat() {
    phase = 'failed';
  }

  onDestroy(() => stopPlayback());

  let canContinue = $derived(battleDone && latestResult?.winner === 'player');
  let isLastRoom = $derived(currentRoomIndex + 1 >= dungeon.rooms.length);
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold text-amber-400 text-center">Daily Dungeon: {dungeon.name}</h2>

  {#if phase === 'select'}
    <!-- Team Selection -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h3 class="font-bold mb-3">Select Your Team (up to {maxTeamSize})</h3>
      <div class="text-xs text-gray-400 mb-2">
        Attempts remaining: <span class="text-amber-400 font-bold">{playerSave.daily.dungeonAttemptsLeft}</span>
        <span class="ml-3">Selected: <span class="text-white font-bold">{selectedIds.length}/{maxTeamSize}</span></span>
      </div>

      {#if ownedCharacters.length === 0}
        <p class="text-gray-500 py-4">You have no characters yet. Pull from the Gacha first!</p>
      {:else}
        <div class="flex gap-3 flex-wrap mb-4">
          {#each ownedCharacters as { owned, def }}
            <button
              onclick={() => toggleSelect(owned.characterId)}
              class="w-28 h-36 rounded-lg border-2 flex flex-col items-center overflow-hidden transition-all
                {selectedIds.includes(owned.characterId)
                  ? 'border-green-400 ring-2 ring-green-400 scale-105'
                  : selectedIds.length >= maxTeamSize
                    ? 'border-slate-700 opacity-40 cursor-not-allowed'
                    : 'border-slate-600 hover:border-slate-400'}
                {ROLE_COLORS[def.role]}"
            >
              <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-20 h-20 mt-1" />
              <span class="text-[10px] font-medium truncate w-full text-center px-1">{def.name}</span>
              <span class="text-[9px] capitalize text-gray-400">{def.role}</span>
              <span class="text-[9px] text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</span>
            </button>
          {/each}
        </div>

        <div class="flex gap-3">
          <button
            onclick={startDungeon}
            disabled={selectedIds.length === 0 || playerSave.daily.dungeonAttemptsLeft <= 0}
            class="px-6 py-3 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 rounded font-bold"
          >
            Enter Dungeon ({dungeon.rooms.length} rooms)
          </button>
          {#if playerSave.daily.dungeonAttemptsLeft <= 0}
            <span class="text-red-400 text-sm self-center">No attempts left today!</span>
          {/if}
        </div>
      {/if}
    </div>

  {:else if phase === 'running'}
    <!-- Battle in progress -->
    <div class="flex items-center justify-center gap-4 mb-2">
      <span class="text-sm text-gray-400">
        Room {currentRoomIndex + 1}/{dungeon.rooms.length} — {currentRoom?.name ?? ''}
      </span>
      <div class="flex items-center gap-2">
        <span class="text-xs text-gray-500">Speed:</span>
        <select
          bind:value={playbackSpeed}
          onchange={() => {
            if (isPlaying) {
              stopPlayback();
              isPlaying = true;
              playInterval = setInterval(() => {
                if (currentActionIndex < actionLog.length - 1) {
                  currentActionIndex++;
                  applyAction(actionLog[currentActionIndex]);
                } else { stopPlayback(); }
              }, playbackSpeed);
            }
          }}
          class="px-2 py-1 bg-slate-700 rounded text-xs text-white"
        >
          <option value={800}>Slow</option>
          <option value={500}>Normal</option>
          <option value={250}>Fast</option>
        </select>
      </div>
    </div>

    <!-- Desktop: 3-column layout (log | battle | xp), Mobile: stacked -->
    <div class="flex flex-col xl:flex-row xl:items-start xl:gap-4">
      <!-- Left column: Battle Log (desktop) -->
      <div class="hidden xl:block xl:w-80 xl:flex-shrink-0 xl:order-1">
        <BattleLog actions={actionLog} currentIndex={currentActionIndex} />
      </div>

      <!-- Center column: Battle Grid + controls -->
      <div class="flex-1 xl:order-2 flex flex-col items-center">
        <BattleGrid {playerDisplayUnits} {enemyDisplayUnits} />

        <!-- Mobile-only: Battle Log below grid -->
        <div class="mt-4 xl:hidden w-full">
          <BattleLog actions={actionLog} currentIndex={currentActionIndex} />
        </div>

        {#if battleDone}
          {#if canContinue && !showXpScreen}
            <div class="flex justify-center gap-3 mt-4 xl:hidden">
              <button
                onclick={handleNextRoom}
                class="px-6 py-3 bg-green-600 hover:bg-green-500 rounded font-bold"
              >
                {isLastRoom ? 'Victory! Complete Dungeon' : 'Next Room'}
              </button>
            </div>
          {:else if !canContinue}
            <div class="flex justify-center gap-3 mt-4">
              <div class="text-center">
                <div class="text-red-400 font-bold mb-2">Defeated!</div>
                <button
                  onclick={handleDefeat}
                  class="px-6 py-3 bg-slate-600 hover:bg-slate-500 rounded"
                >
                  Back
                </button>
              </div>
            </div>
          {/if}
        {/if}
      </div>

      <!-- Right column: XP Gained / placeholder to keep center balanced -->
      <div class="xl:w-80 xl:flex-shrink-0 xl:order-3">
        {#if battleDone && canContinue && showXpScreen && xpGains.length > 0}
          <div class="mt-4 xl:mt-0 bg-slate-800 rounded-lg p-4">
            <h3 class="text-center font-bold text-cyan-400 mb-3">XP Gained!</h3>
            <div class="space-y-3">
              {#each xpGains as entry}
                {@const xpNeeded = getXpForLevel(entry.newLevel, levelThresholds)}
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 flex-shrink-0 rounded bg-slate-700 overflow-hidden">
                    <SpritePreview sprites={entry.sprites} fallback={ROLE_ICONS[entry.role]} class="w-10 h-10" />
                  </div>
                  <div class="flex-1">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-medium">{entry.name}</span>
                      <span class="text-cyan-400 text-xs font-bold">+{entry.xpGained} XP</span>
                    </div>
                    {#if entry.newLevel > entry.prevLevel}
                      <div class="text-xs text-yellow-400 font-bold">Level Up! Lv{entry.prevLevel} → Lv{entry.newLevel}</div>
                    {/if}
                    {#if xpNeeded !== null}
                      <div class="w-full bg-slate-700 rounded-full h-2 mt-1">
                        <div
                          class="bg-cyan-500 h-2 rounded-full transition-all"
                          style="width: {Math.min(100, (entry.newXp / xpNeeded) * 100)}%"
                        ></div>
                      </div>
                      <div class="text-[10px] text-gray-500 mt-0.5">
                        Lv{entry.newLevel} — {entry.newXp}/{xpNeeded} XP
                      </div>
                    {:else}
                      <div class="text-[10px] text-cyan-400 font-bold mt-0.5">Max Level</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
            <div class="flex justify-center mt-4">
              <button
                onclick={() => { showXpScreen = false; handleNextRoom(); }}
                class="px-6 py-3 bg-green-600 hover:bg-green-500 rounded font-bold"
              >
                {isLastRoom ? 'Victory! Complete Dungeon' : 'Next Room'}
              </button>
            </div>
          </div>
        {:else if battleDone && canContinue && !showXpScreen}
          <!-- Desktop-only: Next Room button in right column -->
          <div class="hidden xl:flex xl:items-center xl:justify-center xl:pt-8">
            <button
              onclick={handleNextRoom}
              class="px-6 py-3 bg-green-600 hover:bg-green-500 rounded font-bold"
            >
              {isLastRoom ? 'Victory! Complete Dungeon' : 'Next Room'}
            </button>
          </div>
        {/if}
      </div>
    </div>

  {:else if phase === 'complete'}
    <div class="text-center py-8">
      <div class="text-3xl font-bold text-green-400 mb-2">Dungeon Cleared!</div>
      <div class="text-gray-400">You conquered {dungeon.name} in {roomResults.length} rooms.</div>
    </div>

  {:else if phase === 'failed'}
    <div class="text-center py-8">
      <div class="text-3xl font-bold text-red-400 mb-2">Dungeon Failed</div>
      <div class="text-gray-400 mb-4">
        You were defeated at room {currentRoomIndex + 1}.
        Attempts remaining: <span class="text-amber-400 font-bold">{playerSave.daily.dungeonAttemptsLeft}</span>
      </div>
      {#if playerSave.daily.dungeonAttemptsLeft > 0}
        <button
          onclick={() => { phase = 'select'; selectedIds = []; }}
          class="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded font-bold"
        >
          Try Again
        </button>
      {:else}
        <div class="text-red-400 text-sm">No more attempts today. Come back tomorrow!</div>
      {/if}
    </div>
  {/if}
</div>
