<script lang="ts">
  import type { CharacterDefinition, Role, Rarity, SpriteSource, SpriteSheetConfig } from '../game/types';
  import { ROLE_BASE_STATS } from '../game/types';
  import type { AbilityDefinition } from '../game/abilities';
  import { createBlankCharacter } from './adminTypes';
  import SpritePicker from './SpritePicker.svelte';

  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  interface Props {
    characters: CharacterDefinition[];
    abilities: AbilityDefinition[];
    onSave: (char: CharacterDefinition) => void;
    onDelete: (id: string) => void;
  }

  let { characters, abilities, onSave, onDelete }: Props = $props();

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer', 'summoner'];
  const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

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
  let searchQuery = $state('');

  let filteredCharacters = $derived(
    characters.filter((c) => {
      if (filterRole !== 'all' && c.role !== filterRole) return false;
      if (filterRarity !== 'all' && c.rarity !== filterRarity) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!c.name.toLowerCase().includes(q) && !c.role.includes(q) && !c.abilityName.toLowerCase().includes(q)) return false;
      }
      return true;
    })
  );

  /** Get abilities available for a given role */
  function abilitiesForRole(role: Role): AbilityDefinition[] {
    return abilities.filter((a) => a.allowedRoles.includes(role));
  }

  function startNew() {
    const char = createBlankCharacter();
    // Auto-select first ability for default role
    const available = abilitiesForRole(char.role);
    if (available.length > 0) {
      char.abilityName = available[0].name;
      char.abilityDescription = available[0].description;
    }
    editingChar = char;
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
    const available = abilitiesForRole(role);
    editingChar = {
      ...editingChar,
      role,
      abilityName: available.length > 0 ? available[0].name : '',
      abilityDescription: available.length > 0 ? available[0].description : '',
    };
  }

  function onAbilityChange(abilityId: string) {
    if (!editingChar) return;
    const ability = abilities.find((a) => a.id === abilityId);
    if (ability) {
      editingChar = {
        ...editingChar,
        abilityName: ability.name,
        abilityDescription: ability.description,
      };
    }
  }

  function getSelectedAbilityId(): string {
    if (!editingChar) return '';
    const match = abilities.find(
      (a) => a.name === editingChar!.abilityName && a.allowedRoles.includes(editingChar!.role)
    );
    return match?.id ?? '';
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

    <input
      type="text"
      bind:value={searchQuery}
      placeholder="Search..."
      class="px-2 py-1.5 bg-slate-700 rounded text-sm w-36"
    />

    <span class="text-gray-400 text-sm">{filteredCharacters.length} characters</span>
  </div>

  <!-- Edit Form -->
  {#if editingChar}
    {@const availableAbilities = abilitiesForRole(editingChar.role)}
    {@const allAbilities = abilities}
    <div class="bg-slate-800 rounded-lg p-4 border border-slate-600">
      <h3 class="font-bold mb-3">
        {characters.some((c) => c.id === editingChar?.id) ? 'Edit' : 'New'} Character
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span class="block text-xs text-gray-400 mb-1">Name</span>
          <input
            type="text"
            bind:value={editingChar.name}
            placeholder="Character name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">ID</span>
          <input
            type="text"
            value={editingChar.id}
            disabled
            class="w-full px-3 py-2 bg-slate-900 rounded text-sm text-gray-500"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Role</span>
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
          <span class="block text-xs text-gray-400 mb-1">Rarity</span>
          <select
            bind:value={editingChar.rarity}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            {#each RARITIES as r}
              <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)} ({RARITY_STARS[r]} star)</option>
            {/each}
          </select>
        </div>

        <div class="sm:col-span-2">
          <span class="block text-xs text-gray-400 mb-1">Spell</span>
          {#if availableAbilities.length > 0}
            <select
              value={getSelectedAbilityId()}
              onchange={(e) => onAbilityChange(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
            >
              {#each availableAbilities as ab}
                <option value={ab.id}>
                  {ab.name} - {ab.powerMultiplier}x ATK, {ab.targetCount} target(s)
                </option>
              {/each}
              <!-- Also show all abilities if the current one doesn't match role -->
              {#if !availableAbilities.some((a) => a.name === editingChar.abilityName)}
                <optgroup label="All spells">
                  {#each allAbilities as ab}
                    <option value={ab.id}>{ab.name} ({ab.allowedRoles.join(', ')})</option>
                  {/each}
                </optgroup>
              {/if}
            </select>
          {:else}
            <p class="text-xs text-yellow-500 py-2">No spells defined for {editingChar.role}. Create one in the Spells tab.</p>
          {/if}
          {#if editingChar.abilityDescription}
            <p class="text-xs text-gray-500 mt-1">{editingChar.abilityDescription}</p>
          {/if}
        </div>
      </div>

      <!-- Sprite -->
      <div class="mt-3">
        <SpritePicker
          sprites={editingChar.sprites}
          onUpdate={(s) => { if (editingChar) editingChar = { ...editingChar, sprites: s }; }}
        />
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
        {#if isSheet(char.sprites?.idle)}
          {@const cfg = char.sprites.idle}
          {@const zoom = char.sprites?.spriteScale ?? 1}
          {@const fScale = (48 / cfg.frameWidth) * zoom}
          {@const offsetX = (48 - cfg.frameWidth * fScale) / 2}
          {@const offsetY = (48 - cfg.frameHeight * fScale) / 2}
          <div class="w-12 h-12 rounded bg-slate-900 overflow-hidden flex-shrink-0"
            style="background-image: url({cfg.src}); background-size: {cfg.framesPerRow * cfg.frameWidth * fScale}px auto; background-position: {offsetX}px {offsetY}px;">
          </div>
        {:else if (typeof char.sprites?.idle === 'string') || char.sprite}
          {@const zoom = char.sprites?.spriteScale ?? 1}
          <img src={(typeof char.sprites?.idle === 'string' ? char.sprites.idle : undefined) ?? char.sprite} alt="" class="w-12 h-12 rounded object-contain bg-slate-900 flex-shrink-0"
            style={zoom !== 1 ? `transform: scale(${zoom})` : ''} />
        {:else}
          <span class="w-12 h-12 rounded bg-slate-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">--</span>
        {/if}

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
