<script lang="ts">
  import type { Role, Position } from '../game/types';
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
    sprite?: string;
  }

  interface Props {
    playerDisplayUnits: DisplayUnit[];
    enemyDisplayUnits: DisplayUnit[];
  }

  let { playerDisplayUnits, enemyDisplayUnits }: Props = $props();

  function getUnitAtPosition(units: DisplayUnit[], row: number, col: number): DisplayUnit | undefined {
    return units.find((u) => u.position.row === row && u.position.col === col);
  }

  const rows = [0, 1, 2] as const;
  const cols = [0, 1, 2] as const;
</script>

<div class="flex flex-col items-center gap-8">
  <!-- Enemy Grid (mirrored - row 2 at top, row 0 at bottom) -->
  <div class="flex flex-col gap-2">
    <h3 class="text-red-400 font-bold text-center mb-2">Enemy Team</h3>
    {#each [2, 1, 0] as row}
      <div class="flex gap-2 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(enemyDisplayUnits, row, col)}
          <div class="w-20 h-24 border border-gray-700 rounded-lg flex items-center justify-center">
            {#if unit}
              <CharacterCard
                name={unit.name}
                role={unit.role}
                currentHp={unit.currentHp}
                maxHp={unit.maxHp}
                isAlive={unit.isAlive}
                isPlayer={false}
                sprite={unit.sprite}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>

  <!-- Battle Line Separator -->
  <div class="w-full max-w-xs border-t-2 border-dashed border-gray-500 relative">
    <span class="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-900 px-2 text-gray-400 text-sm">
      BATTLEFIELD
    </span>
  </div>

  <!-- Player Grid -->
  <div class="flex flex-col gap-2">
    <h3 class="text-blue-400 font-bold text-center mb-2">Player Team</h3>
    {#each rows as row}
      <div class="flex gap-2 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(playerDisplayUnits, row, col)}
          <div class="w-20 h-24 border border-gray-700 rounded-lg flex items-center justify-center">
            {#if unit}
              <CharacterCard
                name={unit.name}
                role={unit.role}
                currentHp={unit.currentHp}
                maxHp={unit.maxHp}
                isAlive={unit.isAlive}
                isPlayer={true}
                sprite={unit.sprite}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
