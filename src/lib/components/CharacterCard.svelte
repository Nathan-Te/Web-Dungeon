<script lang="ts">
  import type { Role } from '../game/types';

  interface Props {
    name: string;
    role: Role;
    currentHp: number;
    maxHp: number;
    isAlive: boolean;
    isPlayer: boolean;
    sprite?: string;
  }

  let { name, role, currentHp, maxHp, isAlive, isPlayer, sprite }: Props = $props();

  const roleColors: Record<Role, string> = {
    tank: 'bg-blue-600',
    warrior: 'bg-red-600',
    archer: 'bg-green-600',
    mage: 'bg-purple-600',
    assassin: 'bg-gray-700',
    healer: 'bg-yellow-600',
  };

  const roleBorderColors: Record<Role, string> = {
    tank: 'border-blue-500',
    warrior: 'border-red-500',
    archer: 'border-green-500',
    mage: 'border-purple-500',
    assassin: 'border-gray-500',
    healer: 'border-yellow-500',
  };

  const roleIcons: Record<Role, string> = {
    tank: 'T',
    warrior: 'W',
    archer: 'A',
    mage: 'M',
    assassin: 'X',
    healer: 'H',
  };

  let hpPercent = $derived(Math.max(0, (currentHp / maxHp) * 100));
  let hpColor = $derived(
    hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
  );
</script>

{#if sprite}
  <!-- Sprite layout: image dominant, info strip below -->
  <div class="flex flex-col items-center {isAlive ? '' : 'opacity-30 grayscale'}">
    <!-- Sprite image -->
    <div class="w-[4.5rem] h-[4.5rem] rounded-lg border-2 overflow-hidden bg-slate-900
      {isPlayer ? 'border-blue-400' : 'border-red-400'}">
      <img src={sprite} alt={name} class="w-full h-full object-contain" />
    </div>
    <!-- Info strip below the sprite -->
    <div class="w-20 -mt-0.5">
      <div class="text-center text-[10px] font-bold truncate leading-tight">{name}</div>
      <div class="h-1.5 bg-gray-900 rounded-full overflow-hidden mx-0.5">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
      <div class="text-center text-[9px] text-gray-300 leading-tight">{currentHp}/{maxHp}</div>
    </div>
  </div>
{:else}
  <!-- No-sprite layout: role icon card -->
  <div
    class="relative w-20 h-24 rounded-lg border-2 transition-all duration-200
      {isPlayer ? 'border-blue-400' : 'border-red-400'}
      {roleColors[role]}
      {isAlive ? 'opacity-100' : 'opacity-30 grayscale'}"
  >
    <div class="absolute top-0 left-0 right-0 text-center text-xs font-bold truncate px-1">
      {name}
    </div>

    <div class="absolute top-5 left-0 right-0 text-center text-2xl font-bold">
      {roleIcons[role]}
    </div>

    <div class="absolute bottom-6 left-1 right-1">
      <div class="h-2 bg-gray-900 rounded-full overflow-hidden">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
    </div>

    <div class="absolute bottom-1 left-0 right-0 text-center text-xs">
      {currentHp}/{maxHp}
    </div>
  </div>
{/if}
