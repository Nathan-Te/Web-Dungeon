<script lang="ts">
  import PlayerHome from './lib/player/PlayerHome.svelte';
  import BattleDemo from './lib/components/BattleDemo.svelte';
  import DungeonRunner from './lib/components/DungeonRunner.svelte';
  import AdminPage from './lib/admin/AdminPage.svelte';

  let currentPage = $state('player');

  function navigate(page: string) {
    currentPage = page;
  }
</script>

<main class="min-h-screen bg-slate-900 py-8 text-white">
  {#if currentPage === 'admin'}
    <AdminPage onNavigate={navigate} />
  {:else if currentPage === 'demo'}
    <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-end gap-2">
      <button
        onclick={() => navigate('player')}
        class="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm font-medium"
      >
        Player
      </button>
      <button
        onclick={() => navigate('dungeon-test')}
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        Dungeon Test
      </button>
      <button
        onclick={() => navigate('admin')}
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        Admin
      </button>
    </div>
    <BattleDemo />
  {:else if currentPage === 'dungeon-test'}
    <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-end gap-2">
      <button
        onclick={() => navigate('player')}
        class="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm font-medium"
      >
        Player
      </button>
      <button
        onclick={() => navigate('demo')}
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        Battle Demo
      </button>
      <button
        onclick={() => navigate('admin')}
        class="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
      >
        Admin
      </button>
    </div>
    <DungeonRunner />
  {:else}
    <PlayerHome onNavigate={navigate} />
  {/if}
</main>
