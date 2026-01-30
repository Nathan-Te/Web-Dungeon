<script lang="ts">
  import type { Role, Position, SpriteSet, SpriteSource, AnimState, HitEffect } from '../game/types';
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
    abilityOverlay?: SpriteSource;
  }

  interface Props {
    playerDisplayUnits: DisplayUnit[];
    enemyDisplayUnits: DisplayUnit[];
  }

  let { playerDisplayUnits, enemyDisplayUnits }: Props = $props();

  function getUnitAtPosition(units: DisplayUnit[], row: number, col: number): DisplayUnit | undefined {
    return units.find((u) => u.position.row === row && u.position.col === col);
  }

  let hasBoss = $derived(enemyDisplayUnits.some((u) => u.isBoss));
  let bossUnit = $derived(enemyDisplayUnits.find((u) => u.isBoss));

  const cols = [0, 1, 2] as const;
</script>

<div class="flex flex-col items-center gap-8">
  <!-- Enemy Grid -->
  <div class="flex flex-col gap-3">
    <h3 class="text-red-400 font-bold text-center mb-2">Enemy Team</h3>

    {#if hasBoss && bossUnit}
      <!-- Boss layout: 3x3 boss card + row 3 for minions -->
      <!-- Boss takes rows 0-2, rendered as a single large card -->
      <div class="flex justify-center">
        <div class="border border-red-800 rounded-lg flex items-center justify-center overflow-visible"
          style="width: calc(6rem * 3 + 0.75rem * 2); height: calc(7rem * 3 + 0.75rem * 2);">
          <CharacterCard
            name={bossUnit.name}
            role={bossUnit.role}
            currentHp={bossUnit.currentHp}
            maxHp={bossUnit.maxHp}
            isAlive={bossUnit.isAlive}
            isPlayer={false}
            sprites={bossUnit.sprites}
            animState={bossUnit.animState}
            hitEffect={bossUnit.hitEffect}
            isBoss={true}
            abilityOverlay={bossUnit.abilityOverlay}
          />
        </div>
      </div>
      <!-- Row 3: minions below the boss -->
      <div class="flex gap-3 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(enemyDisplayUnits.filter(u => !u.isBoss), 3, col)}
          <div class="w-24 h-28 border border-gray-700 rounded-lg flex items-start justify-center overflow-visible pt-1">
            {#if unit}
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
                abilityOverlay={unit.abilityOverlay}
              />
            {/if}
          </div>
        {/each}
      </div>
    {:else}
      <!-- Normal 3x3 grid (mirrored - row 2 at top, row 0 at bottom) -->
      <!-- Extra row 3 for summons shown first (above row 2) -->
      {#if enemyDisplayUnits.some(u => u.position.row === 3)}
        <div class="flex gap-3 justify-center">
          {#each cols as col}
            {@const unit = getUnitAtPosition(enemyDisplayUnits, 3, col)}
            <div class="w-24 h-28 border border-gray-700 rounded-lg flex items-start justify-center overflow-visible pt-1">
              {#if unit}
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
                  abilityOverlay={unit.abilityOverlay}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/if}
      {#each [2, 1, 0] as row}
        <div class="flex gap-3 justify-center">
          {#each cols as col}
            {@const unit = getUnitAtPosition(enemyDisplayUnits, row, col)}
            <div class="w-24 h-28 border border-gray-700 rounded-lg flex items-start justify-center overflow-visible pt-1">
              {#if unit}
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
                  abilityOverlay={unit.abilityOverlay}
                />
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Battle Line Separator -->
  <div class="w-full max-w-sm border-t-2 border-dashed border-gray-500 relative">
    <span class="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-900 px-2 text-gray-400 text-sm">
      BATTLEFIELD
    </span>
  </div>

  <!-- Player Grid (always 3x3, potentially + row 3 for summons) -->
  <div class="flex flex-col gap-3">
    <h3 class="text-blue-400 font-bold text-center mb-2">Player Team</h3>
    {#each [0, 1, 2] as row}
      <div class="flex gap-3 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(playerDisplayUnits, row, col)}
          <div class="w-24 h-28 border border-gray-700 rounded-lg flex items-start justify-center overflow-visible pt-1">
            {#if unit}
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
                abilityOverlay={unit.abilityOverlay}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/each}
    <!-- Extra row 3 for summons if any -->
    {#if playerDisplayUnits.some(u => u.position.row === 3)}
      <div class="flex gap-3 justify-center">
        {#each cols as col}
          {@const unit = getUnitAtPosition(playerDisplayUnits, 3, col)}
          <div class="w-24 h-28 border border-gray-700 rounded-lg flex items-start justify-center overflow-visible pt-1">
            {#if unit}
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
                abilityOverlay={unit.abilityOverlay}
              />
            {/if}
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
