<script lang="ts">
  import type { Role, Rarity, SpriteSource, SpriteSheetConfig } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { AbilityDefinition } from '../game/abilities';
  import type { EnemyTemplate } from './adminTypes';
  import { createBlankEnemy } from './adminTypes';
  import SpritePicker from './SpritePicker.svelte';

  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  interface Props {
    enemies: EnemyTemplate[];
    abilities: AbilityDefinition[];
    onSave: (enemy: EnemyTemplate) => void;
    onDelete: (id: string) => void;
  }

  let { enemies, abilities, onSave, onDelete }: Props = $props();

  const ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer', 'summoner'];
  const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  let editingEnemy: EnemyTemplate | null = $state(null);
  let searchQuery = $state('');
  let filterRole = $state('');
  let filterRarity = $state('');
  let filterBoss = $state('');

  let filteredEnemies = $derived(
    enemies.filter((e) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!e.name.toLowerCase().includes(q) && !e.role.includes(q)) return false;
      }
      if (filterRole && e.role !== filterRole) return false;
      if (filterRarity && e.rarity !== filterRarity) return false;
      if (filterBoss === 'boss' && !e.isBoss) return false;
      if (filterBoss === 'normal' && e.isBoss) return false;
      return true;
    })
  );

  function abilitiesForRole(role: Role): AbilityDefinition[] {
    return abilities.filter((a) => a.allowedRoles.includes(role));
  }

  function calcStat(base: number, level: number, ascension: number, mult: number = 1): number {
    const levelMult = 1 + (level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascMult = 1 + ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    return Math.floor(base * levelMult * ascMult * mult);
  }

  function getAbilityName(abilityId: string): string {
    return abilities.find((a) => a.id === abilityId)?.name ?? abilityId;
  }

  function startNew() {
    editingEnemy = createBlankEnemy();
  }

  function startEdit(enemy: EnemyTemplate) {
    editingEnemy = { ...enemy, statOverrides: { ...enemy.statOverrides } };
  }

  function handleSave() {
    if (!editingEnemy || !editingEnemy.name.trim()) return;
    onSave(editingEnemy);
    editingEnemy = null;
  }

  function handleCancel() {
    editingEnemy = null;
  }

  function handleDelete(id: string) {
    if (confirm('Delete this enemy template?')) {
      onDelete(id);
      if (editingEnemy?.id === id) editingEnemy = null;
    }
  }

  function onRoleChange(role: Role) {
    if (!editingEnemy) return;
    const available = abilitiesForRole(role);
    editingEnemy = {
      ...editingEnemy,
      role,
      abilityId: available.length > 0 ? available[0].id : editingEnemy.abilityId,
    };
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex gap-3 items-center flex-wrap">
    <button
      onclick={startNew}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Enemy
    </button>
    <span class="text-gray-400 text-sm">{filteredEnemies.length}/{enemies.length} enemies</span>
  </div>

  <!-- Search / Filters -->
  <div class="flex gap-2 items-end flex-wrap">
    <div class="flex-1 min-w-[120px]">
      <span class="block text-[10px] text-gray-500 mb-0.5">Search</span>
      <input
        type="text"
        bind:value={searchQuery}
        placeholder="Name or role..."
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
    <div class="w-28">
      <span class="block text-[10px] text-gray-500 mb-0.5">Rarity</span>
      <select bind:value={filterRarity} class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm">
        <option value="">All</option>
        {#each RARITIES as r}
          <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
        {/each}
      </select>
    </div>
    <div class="w-24">
      <span class="block text-[10px] text-gray-500 mb-0.5">Type</span>
      <select bind:value={filterBoss} class="w-full px-2 py-1.5 bg-slate-700 rounded text-sm">
        <option value="">All</option>
        <option value="boss">Boss</option>
        <option value="normal">Normal</option>
      </select>
    </div>
  </div>

  <!-- Edit Form -->
  {#if editingEnemy}
    {@const availableAbilities = abilitiesForRole(editingEnemy.role)}
    <div class="bg-slate-800 rounded-lg p-4 border border-red-900">
      <h3 class="font-bold mb-3 text-red-400">
        {enemies.some((e) => e.id === editingEnemy?.id) ? 'Edit' : 'New'} Enemy
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <span class="block text-xs text-gray-400 mb-1">Name</span>
          <input
            type="text"
            bind:value={editingEnemy.name}
            placeholder="Enemy name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">ID</span>
          <input
            type="text"
            value={editingEnemy.id}
            disabled
            class="w-full px-3 py-2 bg-slate-900 rounded text-sm text-gray-500"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Role</span>
          <select
            value={editingEnemy.role}
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
            bind:value={editingEnemy.rarity}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          >
            {#each RARITIES as r}
              <option value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
            {/each}
          </select>
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Level (1-100)</span>
          <input
            type="number"
            bind:value={editingEnemy.level}
            min="1"
            max="100"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <span class="block text-xs text-gray-400 mb-1">Ascension (0-6)</span>
          <input
            type="number"
            bind:value={editingEnemy.ascension}
            min="0"
            max="6"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <!-- Boss toggle -->
        <div class="sm:col-span-2 flex items-center gap-3">
          <label class="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={editingEnemy.isBoss ?? false}
              onchange={(e) => {
                if (!editingEnemy) return;
                editingEnemy = { ...editingEnemy, isBoss: e.currentTarget.checked, abilityIds: e.currentTarget.checked ? (editingEnemy.abilityIds ?? [editingEnemy.abilityId]) : undefined };
              }}
              class="w-4 h-4 accent-red-500"
            />
            <span class="text-sm font-bold text-red-400">BOSS</span>
          </label>
          <span class="text-xs text-gray-500">Boss occupies 3x3, can use multiple abilities</span>
        </div>

        <!-- Spell(s) -->
        {#if editingEnemy.isBoss}
          <div class="sm:col-span-2">
            <span class="block text-xs text-gray-400 mb-1">Boss Abilities ({(editingEnemy.abilityIds ?? []).length})</span>
            <div class="space-y-1">
              {#each editingEnemy.abilityIds ?? [] as abilityId, i}
                <div class="flex gap-2 items-center">
                  <select
                    value={abilityId}
                    onchange={(e) => {
                      if (!editingEnemy) return;
                      const ids = [...(editingEnemy.abilityIds ?? [])];
                      ids[i] = e.currentTarget.value;
                      editingEnemy = { ...editingEnemy, abilityIds: ids };
                    }}
                    class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-sm"
                  >
                    {#each abilities as ab}
                      <option value={ab.id}>{ab.name} ({ab.allowedRoles.join(', ')}) - {ab.powerMultiplier}x ATK</option>
                    {/each}
                  </select>
                  <button
                    onclick={() => {
                      if (!editingEnemy) return;
                      const ids = [...(editingEnemy.abilityIds ?? [])];
                      ids.splice(i, 1);
                      editingEnemy = { ...editingEnemy, abilityIds: ids };
                    }}
                    class="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs"
                  >X</button>
                </div>
              {/each}
              <button
                onclick={() => {
                  if (!editingEnemy) return;
                  const ids = [...(editingEnemy.abilityIds ?? [])];
                  ids.push(abilities[0]?.id ?? '');
                  editingEnemy = { ...editingEnemy, abilityIds: ids };
                }}
                class="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
              >+ Add Ability</button>
            </div>
          </div>
        {:else}
          <div class="sm:col-span-2">
            <span class="block text-xs text-gray-400 mb-1">Spell</span>
            {#if availableAbilities.length > 0}
              <select
                bind:value={editingEnemy.abilityId}
                class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              >
                {#each availableAbilities as ab}
                  <option value={ab.id}>
                    {ab.name} - {ab.powerMultiplier}x ATK, {ab.targetCount} target(s)
                  </option>
                {/each}
              </select>
            {:else}
              <select
                bind:value={editingEnemy.abilityId}
                class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
              >
                {#each abilities as ab}
                  <option value={ab.id}>{ab.name} ({ab.allowedRoles.join(', ')})</option>
                {/each}
              </select>
            {/if}
          </div>
        {/if}

        <!-- Summoner config -->
        {#if editingEnemy.role === 'summoner'}
          <div class="sm:col-span-2">
            <span class="block text-xs text-gray-400 mb-1">Summon Targets (enemy IDs this summoner can summon)</span>
            <div class="space-y-1">
              {#each editingEnemy.summonIds ?? [] as summonId, i}
                <div class="flex gap-2 items-center">
                  <select
                    value={summonId}
                    onchange={(e) => {
                      if (!editingEnemy) return;
                      const ids = [...(editingEnemy.summonIds ?? [])];
                      ids[i] = e.currentTarget.value;
                      editingEnemy = { ...editingEnemy, summonIds: ids };
                    }}
                    class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-sm"
                  >
                    {#each enemies.filter(e => e.id !== editingEnemy?.id) as enemy}
                      <option value={enemy.id}>{enemy.name} ({enemy.role})</option>
                    {/each}
                  </select>
                  <button
                    onclick={() => {
                      if (!editingEnemy) return;
                      const ids = [...(editingEnemy.summonIds ?? [])];
                      ids.splice(i, 1);
                      editingEnemy = { ...editingEnemy, summonIds: ids };
                    }}
                    class="px-2 py-1 bg-red-800 hover:bg-red-700 rounded text-xs"
                  >X</button>
                </div>
              {/each}
              <button
                onclick={() => {
                  if (!editingEnemy) return;
                  const ids = [...(editingEnemy.summonIds ?? [])];
                  const otherEnemies = enemies.filter(e => e.id !== editingEnemy?.id);
                  if (otherEnemies.length > 0) {
                    ids.push(otherEnemies[0].id);
                    editingEnemy = { ...editingEnemy, summonIds: ids };
                  }
                }}
                class="px-3 py-1 bg-slate-600 hover:bg-slate-500 rounded text-xs"
              >+ Add Summon</button>
            </div>
            <div class="mt-2">
              <span class="text-xs text-gray-400">Max Active Summons (1-3)</span>
              <input
                type="number"
                min="1"
                max="3"
                value={editingEnemy.maxSummons ?? 1}
                onchange={(e) => {
                  if (!editingEnemy) return;
                  editingEnemy = { ...editingEnemy, maxSummons: parseInt(e.currentTarget.value) || 1 };
                }}
                class="ml-2 w-16 px-2 py-1 bg-slate-700 rounded text-sm"
              />
            </div>
          </div>
        {/if}
      </div>

      <!-- Sprite -->
      <div class="mt-3">
        <SpritePicker
          sprites={editingEnemy.sprites}
          onUpdate={(s) => { if (editingEnemy) editingEnemy = { ...editingEnemy, sprites: s }; }}
        />
      </div>

      <!-- Stat Overrides -->
      <div class="mt-3">
        <span class="block text-xs text-gray-400 mb-1">Stat Multipliers (default 1.0)</span>
        <div class="grid grid-cols-4 gap-2">
          <div>
            <span class="text-xs text-gray-500">HP x</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={editingEnemy.statOverrides?.hpMult ?? 1}
              onchange={(e) => {
                if (!editingEnemy) return;
                editingEnemy = {
                  ...editingEnemy,
                  statOverrides: { ...editingEnemy.statOverrides, hpMult: parseFloat(e.currentTarget.value) || 1 },
                };
              }}
              class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
            />
          </div>
          <div>
            <span class="text-xs text-gray-500">ATK x</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={editingEnemy.statOverrides?.atkMult ?? 1}
              onchange={(e) => {
                if (!editingEnemy) return;
                editingEnemy = {
                  ...editingEnemy,
                  statOverrides: { ...editingEnemy.statOverrides, atkMult: parseFloat(e.currentTarget.value) || 1 },
                };
              }}
              class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
            />
          </div>
          <div>
            <span class="text-xs text-gray-500">DEF x</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={editingEnemy.statOverrides?.defMult ?? 1}
              onchange={(e) => {
                if (!editingEnemy) return;
                editingEnemy = {
                  ...editingEnemy,
                  statOverrides: { ...editingEnemy.statOverrides, defMult: parseFloat(e.currentTarget.value) || 1 },
                };
              }}
              class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
            />
          </div>
          <div>
            <span class="text-xs text-gray-500">SPD x</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="10"
              value={editingEnemy.statOverrides?.spdMult ?? 1}
              onchange={(e) => {
                if (!editingEnemy) return;
                editingEnemy = {
                  ...editingEnemy,
                  statOverrides: { ...editingEnemy.statOverrides, spdMult: parseFloat(e.currentTarget.value) || 1 },
                };
              }}
              class="w-full px-2 py-1 bg-slate-700 rounded text-sm"
            />
          </div>
        </div>
      </div>

      <!-- Computed Stats Preview -->
      {#if editingEnemy}
        {@const base = ROLE_BASE_STATS[editingEnemy.role]}
        {@const ov = editingEnemy.statOverrides}
        <div class="mt-3 p-3 bg-slate-900 rounded text-xs">
          <span class="text-gray-400">Final Stats (Lv{editingEnemy.level}, A{editingEnemy.ascension}):</span>
          <span class="ml-2">
            HP:{calcStat(base.hp, editingEnemy.level, editingEnemy.ascension, ov?.hpMult)}
            ATK:{calcStat(base.atk, editingEnemy.level, editingEnemy.ascension, ov?.atkMult)}
            DEF:{calcStat(base.def, editingEnemy.level, editingEnemy.ascension, ov?.defMult)}
            SPD:{Math.floor(base.spd * (ov?.spdMult ?? 1))}
          </span>
        </div>
      {/if}

      <div class="flex gap-2 mt-3">
        <button
          onclick={handleSave}
          disabled={!editingEnemy?.name.trim()}
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

  <!-- Enemy List -->
  <div class="space-y-1">
    {#each filteredEnemies as enemy (enemy.id)}
      {@const base = ROLE_BASE_STATS[enemy.role]}
      <div class="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded hover:bg-slate-750 group">
        {#if isSheet(enemy.sprites?.idle)}
          {@const cfg = enemy.sprites.idle}
          {@const zoom = enemy.sprites?.spriteScale ?? 1}
          {@const fScale = (48 / cfg.frameWidth) * zoom}
          {@const offsetX = (48 - cfg.frameWidth * fScale) / 2}
          {@const offsetY = (48 - cfg.frameHeight * fScale) / 2}
          <div class="w-12 h-12 rounded bg-slate-900 overflow-hidden flex-shrink-0"
            style="background-image: url({cfg.src}); background-size: {cfg.framesPerRow * cfg.frameWidth * fScale}px auto; background-position: {offsetX}px {offsetY}px;">
          </div>
        {:else if (typeof enemy.sprites?.idle === 'string') || enemy.sprite}
          {@const zoom = enemy.sprites?.spriteScale ?? 1}
          <img src={(typeof enemy.sprites?.idle === 'string' ? enemy.sprites.idle : undefined) ?? enemy.sprite} alt="" class="w-12 h-12 rounded object-contain bg-slate-900 flex-shrink-0"
            style={zoom !== 1 ? `transform: scale(${zoom})` : ''} />
        {:else}
          <span class="w-12 h-12 rounded bg-slate-700 flex items-center justify-center text-xs text-gray-500 flex-shrink-0">--</span>
        {/if}

        <span class="w-6 text-center font-bold {RARITY_COLORS[enemy.rarity]} capitalize text-xs">
          {enemy.rarity.slice(0, 1).toUpperCase()}
        </span>

        <span class="w-20 text-xs px-2 py-0.5 rounded bg-slate-700 text-center capitalize">
          {enemy.role}
        </span>

        <span class="flex-1 font-medium text-red-300">
          {enemy.name}
          {#if enemy.isBoss}
            <span class="ml-1 px-1.5 py-0.5 bg-red-800 text-red-200 text-xs rounded font-bold">BOSS</span>
          {/if}
        </span>

        <span class="text-xs text-purple-400">
          {#if enemy.isBoss && enemy.abilityIds?.length}
            {enemy.abilityIds.length} abilities
          {:else}
            {getAbilityName(enemy.abilityId)}
          {/if}
        </span>

        <span class="text-xs text-gray-500">
          Lv{enemy.level} A{enemy.ascension}
        </span>

        <span class="text-xs text-gray-600">
          HP:{calcStat(base.hp, enemy.level, enemy.ascension, enemy.statOverrides?.hpMult)}
        </span>

        <button
          onclick={() => startEdit(enemy)}
          class="px-2 py-1 text-xs bg-slate-600 hover:bg-slate-500 rounded opacity-60 group-hover:opacity-100"
        >
          Edit
        </button>
        <button
          onclick={() => handleDelete(enemy.id)}
          class="px-2 py-1 text-xs bg-red-800 hover:bg-red-700 rounded opacity-60 group-hover:opacity-100"
        >
          Del
        </button>
      </div>
    {/each}
  </div>

  {#if filteredEnemies.length === 0}
    <p class="text-gray-500 text-center py-4">
      {enemies.length === 0 ? 'No enemies. Create enemy templates for dungeons!' : 'No enemies match your filters.'}
    </p>
  {/if}
</div>
