<script lang="ts">
  import type { CharacterDefinition, Role, Rarity } from '../game/types';
  import { ROLE_BASE_STATS } from '../game/types';
  import { createBlankCharacter } from './adminTypes';

  interface Props {
    characters: CharacterDefinition[];
    onSave: (char: CharacterDefinition) => void;
    onDelete: (id: string) => void;
  }

  let { characters, onSave, onDelete }: Props = $props();

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer'];
  const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  const ROLE_ABILITIES: Record<Role, { name: string; desc: string }> = {
    tank: { name: 'Taunt', desc: 'Draws enemy attention' },
    warrior: { name: 'Cleave', desc: 'AoE damage to multiple enemies' },
    archer: { name: 'Multi-shot', desc: 'Attacks 2 targets' },
    mage: { name: 'Fireball', desc: 'High burst damage' },
    assassin: { name: 'Backstab', desc: 'Ignores defense' },
    healer: { name: 'Heal', desc: 'Heals the weakest ally' },
  };

  const RARITY_STARS: Record<Rarity, string> = {
    common: '1',
    rare: '2',
    epic: '3',
    legendary: '4',
  };

  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  let editingChar: CharacterDefinition | null = $state(null);
  let filterRole: Role | 'all' = $state('all');
  let filterRarity: Rarity | 'all' = $state('all');

  let filteredCharacters = $derived(
    characters.filter((c) => {
      if (filterRole !== 'all' && c.role !== filterRole) return false;
      if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
      return true;
    })
  );

  function startNew() {
    editingChar = createBlankCharacter();
  }

  function startEdit(char: CharacterDefinition) {
    editingChar = { ...char };
  }

  function handleSave() {
    if (!editingChar || !editingChar.name.trim()) return;
    onSave(editingChar);
    editingChar = null;
  }

  function handleCancel() {
    editingChar = null;
  }

  function handleDelete(id: string) {
    if (confirm('Delete this character?')) {
      onDelete(id);
      if (editingChar?.id === id) editingChar = null;
    }
  }

  function onRoleChange(role: Role) {
    if (!editingChar) return;
    const ability = ROLE_ABILITIES[role];
    editingChar = {
      ...editingChar,
      role,
      abilityName: ability.name,
      abilityDescription: ability.desc,
    };
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex flex-wrap gap-3 items-center">
    <button
      onclick={startNew}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Character
    </button>

    <select
      bind:value={filterRole}
      class="px-2 py-1.5 bg-slate-700 rounded text-sm"
    >
      <option value="all">All Roles</option>
      {#each ROLES as r}
        <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
      {/each}
    </select>

    <select
      bind:value={filterRarity}
      class="px-2 py-1.5 bg-slate-700 rounded text-sm"
    >
      <option value="all">All Rarities</option>
      {#each RARITIES as r}
        <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
      {/each}
    </select>

    <span class="text-gray-400 text-sm">{filteredCharacters.length} characters</span>
  </div>

  <!-- Edit Form -->
  {#if editingChar}
    <div class="bg-slate-800 rounded-lg p-4 border border-slate-600">
      <h3 class="font-bold mb-3">
        {characters.some((c) => c.id === editingChar?.id) ? 'Edit' : 'New'} Character
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Name</label>
          <input
            type="text"
            bind:value={editingChar.name}
            placeholder="Character name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">ID</label>
          <input
            type="text"
            value={editingChar.id}
            disabled
            class="w-full px-3 py-2 bg-slate-900 rounded text-sm text-gray-500"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Role</label>
          <select
            value={editingChar.role}
            onchange={(e) => onRoleChange(e.currentTarget.value as Role)}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            {#each ROLES as r}
              <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Rarity</label>
          <select
            bind:value={editingChar.rarity}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            {#each RARITIES as r}
              <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)} ({RARITY_STARS[r]} star)</option>
            {/each}
          </select>
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Ability Name</label>
          <input
            type="text"
            bind:value={editingChar.abilityName}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Ability Description</label>
          <input
            type="text"
            bind:value={editingChar.abilityDescription}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      </div>

      <!-- Base Stats Preview -->
      <div class="mt-3 p-3 bg-slate-900 rounded text-xs">
        <span class="text-gray-400">Base Stats ({editingChar.role}):</span>
        <span class="ml-2">
          HP:{ROLE_BASE_STATS[editingChar.role].hp}
          ATK:{ROLE_BASE_STATS[editingChar.role].atk}
          DEF:{ROLE_BASE_STATS[editingChar.role].def}
          SPD:{ROLE_BASE_STATS[editingChar.role].spd}
        </span>
      </div>

      <div class="flex gap-2 mt-3">
        <button
          onclick={handleSave}
          disabled={!editingChar.name.trim()}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded text-sm font-bold"
        >
          Save
        </button>
        <button
          onclick={handleCancel}
          class="px-4 py-2 bg-slate-600 hover:bg-slate-500 rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  {/if}

  <!-- Character List -->
  <div class="space-y-1">
    {#each filteredCharacters as char (char.id)}
      <div class="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded hover:bg-slate-750 group">
        <span class="w-6 text-center font-bold text-lg {RARITY_COLORS[char.rarity]}">
          {RARITY_STARS[char.rarity]}
        </span>

        <span class="w-20 text-xs px-2 py-0.5 rounded bg-slate-700 text-center capitalize">
          {char.role}
        </span>

        <span class="flex-1 font-medium">{char.name}</span>

        <span class="text-xs text-gray-500">{char.abilityName}</span>

        <button
          onclick={() => startEdit(char)}
          class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded opacity-60 group-hover:opacity-100"
        >
          Edit
        </button>
        <button
          onclick={() => handleDelete(char.id)}
          class="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded opacity-60 group-hover:opacity-100"
        >
          Del
        </button>
      </div>
    {/each}
  </div>

  {#if filteredCharacters.length === 0}
    <p class="text-gray-500 text-center py-8">No characters found. Create one!</p>
  {/if}
</div>
