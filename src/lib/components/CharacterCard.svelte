<script lang="ts">
  import type { CombatState, Role } from '../game/types';

  interface Props {
    unit: CombatState;
    name: string;
    role: Role;
    isPlayer: boolean;
  }

  let { unit, name, role, isPlayer }: Props = $props();

  const roleColors: Record<Role, string> = {
    tank: 'bg-blue-600',
    warrior: 'bg-red-600',
    archer: 'bg-green-600',
    mage: 'bg-purple-600',
    assassin: 'bg-gray-700',
    healer: 'bg-yellow-600',
  };

  const roleIcons: Record<Role, string> = {
    tank: '🛡️',
    warrior: '⚔️',
    archer: '🏹',
    mage: '🔮',
    assassin: '🗡️',
    healer: '💚',
  };

  let hpPercent = $derived(Math.max(0, (unit.currentHp / unit.maxHp) * 100));
  let isAlive = $derived(unit.isAlive);
</script>

<div
  class="relative w-20 h-24 rounded-lg border-2 transition-all duration-200
    {isPlayer ? 'border-blue-400' : 'border-red-400'}
    {roleColors[role]}
    {isAlive ? 'opacity-100' : 'opacity-30 grayscale'}"
>
  <div class="absolute top-0 left-0 right-0 text-center text-xs font-bold truncate px-1">
    {name}
  </div>

  <div class="absolute top-5 left-0 right-0 text-center text-2xl">
    {roleIcons[role]}
  </div>

  <div class="absolute bottom-6 left-1 right-1">
    <div class="h-2 bg-gray-900 rounded-full overflow-hidden">
      <div
        class="h-full transition-all duration-300
          {hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'}"
        style="width: {hpPercent}%"
      ></div>
    </div>
  </div>

  <div class="absolute bottom-1 left-0 right-0 text-center text-xs">
    {unit.currentHp}/{unit.maxHp}
  </div>
</div>
