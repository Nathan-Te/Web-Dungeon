<script lang="ts">
  import type { Role, Position, SpriteSet, SpriteSource, AnimState, HitEffect, DisplaySize } from '../game/types';
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

  /** Sort units: front row first (row 0), then by col for consistent ordering */
  function sortedUnits(units: DisplayUnit[]): DisplayUnit[] {
    return [...units].sort((a, b) => {
      if (a.position.row !== b.position.row) return a.position.row - b.position.row;
      return a.position.col - b.position.col;
    });
  }

  let sortedPlayers = $derived(sortedUnits(playerDisplayUnits));
  let sortedEnemies = $derived(sortedUnits(enemyDisplayUnits));
</script>

<div class="flex items-center justify-center gap-4 sm:gap-6">
  <!-- Player Team (left side) -->
  <div class="flex flex-col items-center gap-2 min-w-0">
    <h3 class="text-blue-400 font-bold text-center text-sm">Player Team</h3>
    <div class="flex flex-wrap justify-center items-end gap-2 content-end">
      {#each sortedPlayers as unit (unit.id)}
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
      {/each}
      {#if sortedPlayers.length === 0}
        <div class="text-gray-600 text-xs italic py-4">No units</div>
      {/if}
    </div>
  </div>

  <!-- Battle Line Separator (vertical) -->
  <div class="flex flex-col items-center self-stretch justify-center py-4">
    <div class="w-px flex-1 border-l-2 border-dashed border-gray-500"></div>
    <span class="text-gray-400 text-xs px-1 py-2 whitespace-nowrap" style="writing-mode: vertical-lr;">
      VS
    </span>
    <div class="w-px flex-1 border-l-2 border-dashed border-gray-500"></div>
  </div>

  <!-- Enemy Team (right side) -->
  <div class="flex flex-col items-center gap-2 min-w-0">
    <h3 class="text-red-400 font-bold text-center text-sm">Enemy Team</h3>
    <div class="flex flex-wrap justify-center items-end gap-2 content-end">
      {#each sortedEnemies as unit (unit.id)}
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
      {/each}
      {#if sortedEnemies.length === 0}
        <div class="text-gray-600 text-xs italic py-4">No units</div>
      {/if}
    </div>
  </div>
</div>
