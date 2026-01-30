<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    onAuthenticated: () => void;
    onCancel: () => void;
  }

  let { onAuthenticated, onCancel }: Props = $props();

  const ADMIN_KEY = 'dungeon-admin-auth';
  // SHA-256 hash of the admin password (hashed so it's not plain-text in source)
  const ADMIN_PASSWORD_HASH = 'e2f9128f1f9eb8053e540af25307ee57f0462138c6d6eaf454686f2275818b05';

  let password = $state('');
  let error = $state('');

  /** Hash a string using SHA-256 via the Web Crypto API */
  async function sha256(input: string): Promise<string> {
    const data = new TextEncoder().encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Check if already authenticated this session
  onMount(() => {
    if (sessionStorage.getItem(ADMIN_KEY) === 'true') {
      onAuthenticated();
    }
  });

  async function handleSubmit(e: Event) {
    e.preventDefault();
    const hash = await sha256(password);
    if (hash === ADMIN_PASSWORD_HASH) {
      sessionStorage.setItem(ADMIN_KEY, 'true');
      error = '';
      onAuthenticated();
    } else {
      error = 'Mot de passe incorrect';
      password = '';
    }
  }
</script>

<div class="max-w-md mx-auto mt-24 p-6">
  <div class="bg-slate-800 rounded-lg p-6 shadow-lg border border-slate-700">
    <h2 class="text-xl font-bold text-center mb-2">Admin Access</h2>
    <p class="text-gray-400 text-sm text-center mb-6">
      Cette section est reservee a l'administrateur.
    </p>

    <form onsubmit={handleSubmit} class="space-y-4">
      <div>
        <label for="admin-password" class="block text-sm text-gray-300 mb-1">
          Mot de passe
        </label>
        <input
          id="admin-password"
          type="password"
          bind:value={password}
          placeholder="Entrer le mot de passe admin"
          class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white text-sm
            focus:outline-none focus:border-amber-500"
          autofocus
        />
      </div>

      {#if error}
        <div class="text-red-400 text-sm text-center">{error}</div>
      {/if}

      <div class="flex gap-3">
        <button
          type="button"
          onclick={onCancel}
          class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm"
        >
          Retour
        </button>
        <button
          type="submit"
          class="flex-1 px-4 py-2 bg-amber-700 hover:bg-amber-600 rounded text-sm font-bold"
        >
          Connexion
        </button>
      </div>
    </form>
  </div>
</div>
