<script lang="ts">
  import type { CombatState, Role } from '../game/types';
  import CharacterCard from './CharacterCard.svelte';

  interface Props {
    playerUnits: Map<string, CombatState>;
    enemyUnits: Map<string, CombatState>;
    characterNames: Map<string, string>;
    characterRoles: Map<string, Role>;
  }

  let { playerUnits, enemyUnits, characterNames, characterRoles }: Props = $props();

  function getUnitAtPosition(
    units: Map<string, CombatState>,
    row: number,
    col: number
  ): CombatState | null {
    for (const unit of units.values()) {
      if (unit.position.row === row && unit.position.col === col) {
        return unit;
      }
    }
    return null;
  }

  const rows = [0, 1, 2];
  const cols = [0, 1, 2];
</script>

<div class="flex flex-col items-center gap-8">
  <!-- Enemy Grid (mirrored - row 2 at top, row 0 at bottom) -->
  <div class="flex flex-col gap-2">
    <h3 class="text-red-400 font-bold text-center mb-2">Enemy Team</h3>
    {#each [...rows].reverse() as row}
      <div class="flex gap-2 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(enemyUnits, row, col)}
          <div class="w-20 h-24 border border-gray-700 rounded-lg flex items-center justify-center">
            {#if unit}
              <CharacterCard
                {unit}
                name={characterNames.get(unit.characterId) || '???'}
                role={characterRoles.get(unit.characterId) || 'warrior'}
                isPlayer={false}
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
          {@const unit = getUnitAtPosition(playerUnits, row, col)}
          <div class="w-20 h-24 border border-gray-700 rounded-lg flex items-center justify-center">
            {#if unit}
              <CharacterCard
                {unit}
                name={characterNames.get(unit.characterId) || '???'}
                role={characterRoles.get(unit.characterId) || 'warrior'}
                isPlayer={true}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
  </div>
</div>
