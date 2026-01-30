<script lang="ts">
  import type { AbilityDefinition, AbilityTargeting } from '../game/abilities';
  import type { Role, SpriteSource } from '../game/types';
  import { createBlankAbility } from './adminTypes';
  import SingleSpritePicker from './SingleSpritePicker.svelte';

  interface Props {
    abilities: AbilityDefinition[];
    onSave: (ability: AbilityDefinition) => void;
    onDelete: (id: string) => void;
  }

  let { abilities, onSave, onDelete }: Props = $props();

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer', 'summoner'];

  const TARGETING_OPTIONS: { value: AbilityTargeting; label: string }[] = [
    { value: 'single_closest', label: 'Single - Closest enemy' },
    { value: 'single_lowest_hp', label: 'Single - Lowest HP enemy' },
    { value: 'single_back_row', label: 'Single - Back row enemy' },
    { value: 'aoe_first_n', label: 'AoE - First N enemies' },
    { value: 'aoe_random_n', label: 'AoE - N random enemies' },
    { value: 'heal_lowest_ally', label: 'Heal - Lowest HP ally' },
  ];

  const TARGETING_COLORS: Record<string, string> = {
    single_closest: 'text-blue-400',
    single_lowest_hp: 'text-orange-400',
    single_back_row: 'text-gray-300',
    aoe_first_n: 'text-red-400',
    aoe_random_n: 'text-yellow-400',
    heal_lowest_ally: 'text-green-400',
  };

  let editingAbility: AbilityDefinition | null = $state(null);
  let searchQuery = $state('');
  let filterRole = $state('');
  let filterTargeting = $state('');
  let filterCooldown = $state('');

  let filteredAbilities = $derived(
    abilities.filter((a) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      }
      if (filterRole && !a.allowedRoles.includes(filterRole as Role)) return false;
      if (filterTargeting && a.targeting !== filterTargeting) return false;
      if (filterCooldown === 'yes' && !(a.cooldown && a.cooldown > 0)) return false;
      if (filterCooldown === 'no' && a.cooldown && a.cooldown > 0) return false;
      return true;
    })
  );

  function startNew() {
    editingAbility = createBlankAbility();
  }

  function startEdit(ability: AbilityDefinition) {
    editingAbility = { ...ability, allowedRoles: [...ability.allowedRoles] };
  }

  function handleSave() {
    if (!editingAbility || !editingAbility.name.trim()) return;
    onSave(editingAbility);
    editingAbility = null;
  }

  function handleCancel() {
    editingAbility = null;
  }

  function handleDelete(id: string) {
    if (confirm('Delete this spell? Characters using it will need to be reassigned.')) {
      onDelete(id);
      if (editingAbility?.id === id) editingAbility = null;
    }
  }

  function toggleRole(role: Role) {
    if (!editingAbility) return;
    const roles = editingAbility.allowedRoles;
    if (roles.includes(role)) {
      editingAbility = { ...editingAbility, allowedRoles: roles.filter((r) => r !== role) };
    } else {
      editingAbility = { ...editingAbility, allowedRoles: [...roles, role] };
    }
  }

  function isBuiltIn(id: string): boolean {
    return id.startsWith('ability_');
  }

  function getTargetingLabel(targeting: AbilityTargeting): string {
    return TARGETING_OPTIONS.find((t) => t.value === targeting)?.label ?? targeting;
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex gap-3 items-center flex-wrap">
    <button
      onclick={startNew}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Spell
    </button>
    <span class="text-gray-400 text-sm">{filteredAbilities.length}/{abilities.length} spells</span>
  </div>

  <!-- Search / Filters -->
  <div class="flex gap-2 items-end flex-wrap">
    <div class="flex-1 min-w-[120px]">
      <span class="block text-[10px] text-gray-500 mb-0.5">Search</span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Name or description..."
        class="w-full px-3 py-1.5 bg-slate-700 rounded text-sm"
      />
    </div>
    <div class="w-28">
      <span class="block text-[10px] text-gray-500 mb-0.5">Role</span>
      <select bind:value={filterRole} class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm">
        <option value="">All</option>
        {#each ROLES as r}
          <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        {/each}
      </select>
    </div>
    <div class="w-36">
      <span class="block text-[10px] text-gray-500 mb-0.5">Targeting</span>
      <select bind:value={filterTargeting} class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm">
        <option value="">All</option>
        {#each TARGETING_OPTIONS as opt}
          <option value={opt.value}>{opt.label}</option>
        {/each}
      </select>
    </div>
    <div class="w-28">
      <span class="block text-[10px] text-gray-500 mb-0.5">Cooldown</span>
      <select bind:value={filterCooldown} class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm">
        <option value="">All</option>
        <option value="yes">Has CD</option>
        <option value="no">No CD</option>
      </select>
    </div>
  </div>

  <!-- Edit Form -->
  {#if editingAbility}
    <div class="bg-slate-800 rounded-lg p-4 border border-purple-800">
      <h3 class="font-bold mb-3 text-purple-400">
        {abilities.some((a) => a.id === editingAbility?.id) ? 'Edit' : 'New'} Spell
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span class="block text-xs text-gray-400 mb-1">Name</span>
          <input
            type="text"
            bind:value={editingAbility.name}
            placeholder="Spell name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">ID</span>
          <input
            type="text"
            value={editingAbility.id}
            disabled
            class="w-full px-3 py-2 bg-slate-900 rounded text-sm text-gray-500"
          />
        </div>

        <div class="sm:col-span-2">
          <span class="block text-xs text-gray-400 mb-1">Description</span>
          <input
            type="text"
            bind:value={editingAbility.description}
            placeholder="What this spell does"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Targeting</span>
          <select
            bind:value={editingAbility.targeting}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            {#each TARGETING_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Power Multiplier (x ATK)</span>
          <input
            type="number"
            step="0.1"
            min="0.1"
            max="10"
            bind:value={editingAbility.powerMultiplier}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Target Count</span>
          <input
            type="number"
            min="1"
            max="9"
            bind:value={editingAbility.targetCount}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Cooldown (turns, 0 = none)</span>
          <input
            type="number"
            min="0"
            max="20"
            bind:value={editingAbility.cooldown}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div class="flex items-center gap-4 pt-5">
          <label class="flex items-center gap-2 text-sm">
            <input type="checkbox" bind:checked={editingAbility.ignoreDefense} class="w-4 h-4" />
            Ignore DEF
          </label>
        </div>

        {#if editingAbility.targeting === 'heal_lowest_ally'}
          <div>
            <span class="block text-xs text-gray-400 mb-1">Heal Threshold (0-1, heals allies below this % HP)</span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="1"
              bind:value={editingAbility.healThreshold}
              class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
            />
          </div>
        {/if}
      </div>

      <!-- Ability VFX Sprites -->
      <div class="sm:col-span-2 mt-1">
        <span class="block text-xs text-gray-400 mb-3 font-bold">Ability VFX Sprites (optional)</span>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="bg-slate-900 rounded-lg p-3">
            <SingleSpritePicker
              label="Caster Overlay"
              value={editingAbility.casterSprite}
              onUpdate={(v) => {
                if (editingAbility) editingAbility = { ...editingAbility, casterSprite: v };
              }}
            />
            <p class="text-[10px] text-gray-600 mt-1">Shown on the character casting the ability</p>
          </div>
          <div class="bg-slate-900 rounded-lg p-3">
            <SingleSpritePicker
              label="Target Overlay"
              value={editingAbility.targetSprite}
              onUpdate={(v) => {
                if (editingAbility) editingAbility = { ...editingAbility, targetSprite: v };
              }}
            />
            <p class="text-[10px] text-gray-600 mt-1">Shown on each target hit by the ability</p>
          </div>
        </div>
      </div>

      <!-- Allowed Roles -->
      <div class="mt-3">
        <span class="block text-xs text-gray-400 mb-2">Allowed Roles</span>
        <div class="flex gap-2 flex-wrap">
          {#each ROLES as role}
            <button
              onclick={() => toggleRole(role)}
              class="px-3 py-1 rounded text-sm capitalize transition-colors
                {editingAbility.allowedRoles.includes(role)
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}"
            >
              {role}
            </button>
          {/each}
        </div>
      </div>

      <!-- Preview -->
      <div class="mt-3 p-3 bg-slate-900 rounded text-xs">
        <span class="text-gray-400">Preview:</span>
        <span class="ml-2">
          {editingAbility.name || '???'} -
          {editingAbility.powerMultiplier}x ATK,
          {editingAbility.targetCount} target(s),
          {getTargetingLabel(editingAbility.targeting)}
          {#if editingAbility.cooldown && editingAbility.cooldown > 0}
            <span class="text-cyan-400 ml-1">[CD: {editingAbility.cooldown}t]</span>
          {/if}
          {#if editingAbility.ignoreDefense}
            <span class="text-red-400 ml-1">[Ignores DEF]</span>
          {/if}
        </span>
      </div>

      <div class="flex gap-2 mt-3">
        <button
          onclick={handleSave}
          disabled={!editingAbility.name.trim() || editingAbility.allowedRoles.length === 0}
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

  <!-- Spell List -->
  <div class="space-y-1">
    {#each filteredAbilities as ability (ability.id)}
      <div class="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded hover:bg-slate-750 group">
        <span class="font-medium text-purple-300 flex-1">{ability.name}</span>

        <span class="text-xs {TARGETING_COLORS[ability.targeting] ?? 'text-gray-400'}">
          {getTargetingLabel(ability.targeting)}
        </span>

        <span class="text-xs text-gray-400">
          {ability.powerMultiplier}x ATK
        </span>

        <span class="text-xs text-gray-500">
          {ability.targetCount} target(s)
        </span>

        {#if ability.cooldown && ability.cooldown > 0}
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-900 text-cyan-300 border border-cyan-700">
            CD {ability.cooldown}t
          </span>
        {:else}
          <span class="text-[10px] text-gray-600">no CD</span>
        {/if}

        {#if ability.ignoreDefense}
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900 text-red-300 border border-red-700">
            No DEF
          </span>
        {/if}

        <span class="text-xs text-gray-600">
          [{ability.allowedRoles.join(', ')}]
        </span>

        {#if ability.casterSprite || ability.targetSprite}
          <span class="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-900 text-indigo-300 border border-indigo-700">
            VFX
          </span>
        {/if}

        {#if isBuiltIn(ability.id)}
          <span class="text-xs text-gray-600 italic">built-in</span>
        {/if}

        <button
          onclick={() => startEdit(ability)}
          class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded opacity-60 group-hover:opacity-100"
        >
          Edit
        </button>
        <button
          onclick={() => handleDelete(ability.id)}
          class="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded opacity-60 group-hover:opacity-100"
        >
          Del
        </button>
      </div>
    {/each}
  </div>

  {#if filteredAbilities.length === 0}
    <p class="text-gray-500 text-center py-4">
      {abilities.length === 0 ? 'No spells defined. Create one or reset to defaults!' : 'No spells match your filters.'}
    </p>
  {/if}
</div>
