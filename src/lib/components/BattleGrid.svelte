<script lang="ts">
  import type { Role, Position, SpriteSet, SpriteSource, AnimState, HitEffect, DisplaySize } from '../game/types';
  import { DISPLAY_SIZE_PX } from '../game/types';
  import CharacterCard from './CharacterCard.svelte';

  interface DisplayUnit {
    id: string;
    name: string;
    role: Role;
    currentHp: number;
    maxHp: number;
    position: Position;
    team: 'player' | 'enemy';
    isAlive: boolean;
    sprites?: SpriteSet;
    animState?: AnimState;
    hitEffect?: HitEffect;
    isBoss?: boolean;
    displaySize?: DisplaySize;
    abilityOverlay?: SpriteSource;
  }

  interface Props {
    playerDisplayUnits: DisplayUnit[];
    enemyDisplayUnits: DisplayUnit[];
  }

  let { playerDisplayUnits, enemyDisplayUnits }: Props = $props();

  /** Group units by row for lane-based placement */
  function groupByRow(units: DisplayUnit[]): Map<number, DisplayUnit[]> {
    const map = new Map<number, DisplayUnit[]>();
    for (const u of units) {
      const row = u.position.row;
      if (!map.has(row)) map.set(row, []);
      map.get(row)!.push(u);
    }
    // Sort within each row by col
    for (const [, arr] of map) {
      arr.sort((a, b) => a.position.col - b.position.col);
    }
    return map;
  }

  let playerRows = $derived(groupByRow(playerDisplayUnits));
  let enemyRows = $derived(groupByRow(enemyDisplayUnits));

  /** Get sorted row keys (front=0 first) */
  function sortedRowKeys(map: Map<number, DisplayUnit[]>): number[] {
    return [...map.keys()].sort((a, b) => a - b);
  }

  let playerRowKeys = $derived(sortedRowKeys(playerRows));
  let enemyRowKeys = $derived(sortedRowKeys(enemyRows));

  /**
   * Vertical offset per row to create staggering.
   * Row 0 (front) is at the bottom, row 2 (back) at the top.
   * col-based horizontal jitter adds scatter.
   */
  function laneOffsetY(row: number): number {
    const offsets: Record<number, number> = { 0: 20, 1: 0, 2: -16, 3: 32 };
    return offsets[row] ?? 0;
  }

  function jitterX(col: number, row: number): number {
    const seeds = [0, 8, -6, 12, -10, 4];
    return seeds[(col * 3 + row) % seeds.length] ?? 0;
  }

  function jitterY(col: number, row: number): number {
    const seeds = [0, -4, 6, -2, 8, -6];
    return seeds[(col * 2 + row + 1) % seeds.length] ?? 0;
  }
</script>

<!-- Battlefield container -->
<div class="battlefield-wrap relative w-full overflow-hidden rounded-xl py-2 sm:py-3 px-1 sm:px-2"
     style="background: linear-gradient(180deg, rgba(15,23,42,0.9) 0%, rgba(30,41,59,0.7) 50%, rgba(15,23,42,0.9) 100%);">

  <!-- Ground line decoration -->
  <div class="absolute bottom-0 left-0 right-0 h-8 opacity-20"
       style="background: linear-gradient(0deg, rgba(100,116,139,0.4) 0%, transparent 100%);"></div>

  <!-- Desktop: horizontal layout (player left | VS | enemy right) -->
  <div class="hidden sm:flex items-stretch justify-center gap-0 min-h-[180px]">

    <!-- Player Team (left side) -->
    <div class="flex-1 flex items-center justify-end pr-2 relative">
      {#if playerDisplayUnits.length === 0}
        <div class="text-gray-600 text-xs italic">No units</div>
      {:else}
        <div class="flex gap-1 items-end">
          {#each [...playerRowKeys].reverse() as row}
            {@const units = playerRows.get(row) ?? []}
            <div class="flex flex-col items-center gap-1" style="transform: translateY({laneOffsetY(row)}px);">
              {#each units as unit (unit.id)}
                <div style="transform: translate({jitterX(unit.position.col, row)}px, {jitterY(unit.position.col, row)}px);">
                  <CharacterCard
                    name={unit.name}
                    role={unit.role}
                    currentHp={unit.currentHp}
                    maxHp={unit.maxHp}
                    isAlive={unit.isAlive}
                    isPlayer={true}
                    sprites={unit.sprites}
                    animState={unit.animState}
                    hitEffect={unit.hitEffect}
                    isBoss={unit.isBoss}
                    displaySize={unit.displaySize}
                    abilityOverlay={unit.abilityOverlay}
                  />
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Clash zone separator -->
    <div class="flex flex-col items-center justify-center px-3 shrink-0">
      <div class="w-px flex-1 bg-gradient-to-b from-transparent via-amber-500/40 to-transparent"></div>
      <div class="my-1 text-amber-500/60 text-[10px] font-bold tracking-widest" style="writing-mode: vertical-lr;">VS</div>
      <div class="w-px flex-1 bg-gradient-to-b from-transparent via-amber-500/40 to-transparent"></div>
    </div>

    <!-- Enemy Team (right side) -->
    <div class="flex-1 flex items-center justify-start pl-2 relative">
      {#if enemyDisplayUnits.length === 0}
        <div class="text-gray-600 text-xs italic">No units</div>
      {:else}
        <div class="flex gap-1 items-end">
          {#each enemyRowKeys as row}
            {@const units = enemyRows.get(row) ?? []}
            <div class="flex flex-col items-center gap-1" style="transform: translateY({laneOffsetY(row)}px);">
              {#each units as unit (unit.id)}
                <div style="transform: translate({jitterX(unit.position.col, row)}px, {jitterY(unit.position.col, row)}px);">
                  <CharacterCard
                    name={unit.name}
                    role={unit.role}
                    currentHp={unit.currentHp}
                    maxHp={unit.maxHp}
                    isAlive={unit.isAlive}
                    isPlayer={false}
                    sprites={unit.sprites}
                    animState={unit.animState}
                    hitEffect={unit.hitEffect}
                    isBoss={unit.isBoss}
                    displaySize={unit.displaySize}
                    abilityOverlay={unit.abilityOverlay}
                  />
                </div>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
    </div>
  </div>

  <!-- Mobile: vertical stacked layout (allies top, enemies bottom) -->
  <div class="sm:hidden flex flex-col gap-0">

    <!-- Player Team label + units -->
    <div class="px-1">
      <div class="text-[10px] font-bold text-blue-400 mb-1">Alliés</div>
      {#if playerDisplayUnits.length === 0}
        <div class="text-gray-600 text-xs italic text-center py-2">No units</div>
      {:else}
        <div class="flex flex-wrap justify-center gap-1">
          {#each playerDisplayUnits as unit (unit.id)}
            <CharacterCard
              name={unit.name}
              role={unit.role}
              currentHp={unit.currentHp}
              maxHp={unit.maxHp}
              isAlive={unit.isAlive}
              isPlayer={true}
              sprites={unit.sprites}
              animState={unit.animState}
              hitEffect={unit.hitEffect}
              isBoss={unit.isBoss}
              displaySize="small"
              abilityOverlay={unit.abilityOverlay}
            />
          {/each}
        </div>
      {/if}
    </div>

    <!-- Horizontal VS separator -->
    <div class="flex items-center gap-2 px-4 my-1">
      <div class="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
      <span class="text-amber-500/60 text-[10px] font-bold tracking-widest">VS</span>
      <div class="flex-1 h-px bg-gradient-to-r from-transparent via-amber-500/40 to-transparent"></div>
    </div>

    <!-- Enemy Team label + units -->
    <div class="px-1">
      <div class="text-[10px] font-bold text-red-400 mb-1">Ennemis</div>
      {#if enemyDisplayUnits.length === 0}
        <div class="text-gray-600 text-xs italic text-center py-2">No units</div>
      {:else}
        <div class="flex flex-wrap justify-center gap-1">
          {#each enemyDisplayUnits as unit (unit.id)}
            <CharacterCard
              name={unit.name}
              role={unit.role}
              currentHp={unit.currentHp}
              maxHp={unit.maxHp}
              isAlive={unit.isAlive}
              isPlayer={false}
              sprites={unit.sprites}
              animState={unit.animState}
              hitEffect={unit.hitEffect}
              isBoss={unit.isBoss}
              displaySize={unit.isBoss ? 'large' : 'small'}
              abilityOverlay={unit.abilityOverlay}
            />
          {/each}
        </div>
      {/if}
    </div>

  </div>
</div>
