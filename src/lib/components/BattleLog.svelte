<script lang="ts">
  import type { CombatAction } from '../game/types';

  interface Props {
    actions: CombatAction[];
    currentIndex: number;
  }

  let { actions, currentIndex }: Props = $props();

  const actionColors: Record<string, string> = {
    attack: 'text-orange-400',
    ability: 'text-purple-400',
    heal: 'text-green-400',
    death: 'text-red-500',
    summon: 'text-teal-400',
  };

  let visibleActions = $derived(actions.slice(0, currentIndex + 1));
</script>

<div class="bg-slate-800 rounded-lg p-4 h-64 overflow-y-auto">
  <h3 class="text-lg font-bold mb-2 sticky top-0 bg-slate-800">Battle Log</h3>

  {#if visibleActions.length === 0}
    <p class="text-gray-500 italic">Battle not started...</p>
  {:else}
    <div class="space-y-1 text-sm">
      {#each visibleActions as action, i}
        <div
          class="py-1 px-2 rounded transition-all duration-200
            {i === currentIndex ? 'bg-slate-700' : ''}
            {actionColors[action.actionType]}"
        >
          <span class="text-gray-500 mr-2">T{action.turn}</span>
          {action.message}
          {#if action.isCritical}
            <span class="text-yellow-400 ml-1">CRIT!</span>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
