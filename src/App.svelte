<script lang="ts">
  import BattleDemo from './lib/components/BattleDemo.svelte';
  import AdminPage from './lib/admin/AdminPage.svelte';

  let currentPage = $state('game');

  function navigate(page: string) {
    currentPage = page;
  }
</script>

<main class="min-h-screen bg-slate-900 py-8">
  {#if currentPage === 'admin'}
    <AdminPage onNavigate={navigate} />
  {:else}
    <div class="max-w-4xl mx-auto px-4 mb-4 flex justify-end">
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
