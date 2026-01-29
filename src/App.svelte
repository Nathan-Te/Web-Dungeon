<script lang="ts">
  import BattleDemo from './lib/components/BattleDemo.svelte';
  import DungeonRunner from './lib/components/DungeonRunner.svelte';
  import AdminPage from './lib/admin/AdminPage.svelte';

  let currentPage = $state('game');

  function navigate(page: string) {
    currentPage = page;
  }
</script>

<main class="min-h-screen bg-slate-900 py-8">
  {#if currentPage === 'admin'}
    <AdminPage onNavigate={navigate} />
  {:else if currentPage === 'dungeon'}
    <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-end gap-2">
      <button
        onclick={() => navigate('game')}
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
    <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-end gap-2">
      <button
        onclick={() => navigate('dungeon')}
        class="px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm font-medium"
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
  {/if}
</main>
