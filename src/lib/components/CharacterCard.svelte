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

  const roleIcons: Record<Role, string> = {
    tank: 'T',
    warrior: 'W',
    archer: 'A',
    mage: 'M',
    assassin: 'X',
    healer: 'H',
  };

  let hpPercent = $derived(Math.max(0, (currentHp / maxHp) * 100));
</script>

<div
  class="relative w-20 h-24 rounded-lg border-2 transition-all duration-200 overflow-hidden
    {isPlayer ? 'border-blue-400' : 'border-red-400'}
    {sprite ? 'bg-slate-900' : roleColors[role]}
    {isAlive ? 'opacity-100' : 'opacity-30 grayscale'}"
>
  {#if sprite}
    <img src={sprite} alt={name} class="absolute inset-0 w-full h-full object-contain" />
    <div class="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/70"></div>
  {/if}

  <div class="absolute top-0 left-0 right-0 text-center text-xs font-bold truncate px-1 z-10
    {sprite ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : ''}">
    {name}
  </div>

  {#if !sprite}
    <div class="absolute top-5 left-0 right-0 text-center text-2xl font-bold">
      {roleIcons[role]}
    </div>
  {/if}

  <div class="absolute bottom-6 left-1 right-1 z-10">
    <div class="h-2 bg-gray-900 rounded-full overflow-hidden">
      <div
        class="h-full transition-all duration-300
          {hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}"
        style="width: {hpPercent}%"
      ></div>
    </div>
  </div>

  <div class="absolute bottom-1 left-0 right-0 text-center text-xs z-10
    {sprite ? 'drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' : ''}">
    {currentHp}/{maxHp}
  </div>
</div>
