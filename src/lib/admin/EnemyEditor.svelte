<script lang="ts">
  import type { Role, Rarity } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { EnemyTemplate } from './adminTypes';
  import { createBlankEnemy } from './adminTypes';

  interface Props {
    enemies: EnemyTemplate[];
    onSave: (enemy: EnemyTemplate) => void;
    onDelete: (id: string) => void;
  }

  let { enemies, onSave, onDelete }: Props = $props();

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

  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  let editingEnemy: EnemyTemplate | null = $state(null);

  function calcStat(base: number, level: number, ascension: number, mult: number = 1): number {
    const levelMult = 1 + (level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascMult = 1 + ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    return Math.floor(base * levelMult * ascMult * mult);
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
    const ability = ROLE_ABILITIES[role];
    editingEnemy = {
      ...editingEnemy,
      role,
      abilityName: ability.name,
      abilityDescription: ability.desc,
    };
  }
</script>

<div class="space-y-4">
  <!-- Toolbar -->
  <div class="flex gap-3 items-center">
    <button
      onclick={startNew}
      class="px-4 py-2 bg-green-600 hover:bg-green-700 rounded font-bold text-sm"
    >
      + New Enemy
    </button>
    <span class="text-gray-400 text-sm">{enemies.length} enemies</span>
  </div>

  <!-- Edit Form -->
  {#if editingEnemy}
    <div class="bg-slate-800 rounded-lg p-4 border border-red-900">
      <h3 class="font-bold mb-3 text-red-400">
        {enemies.some((e) => e.id === editingEnemy?.id) ? 'Edit' : 'New'} Enemy
      </h3>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label class="block text-xs text-gray-400 mb-1">Name</label>
          <input
            type="text"
            bind:value={editingEnemy.name}
            placeholder="Enemy name"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">ID</label>
          <input
            type="text"
            value={editingEnemy.id}
            disabled
            class="w-full px-3 py-2 bg-slate-900 rounded text-sm text-gray-500"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Role</label>
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
          <label class="block text-xs text-gray-400 mb-1">Rarity</label>
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
          <label class="block text-xs text-gray-400 mb-1">Level (1-100)</label>
          <input
            type="number"
            bind:value={editingEnemy.level}
            min="1"
            max="100"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Ascension (0-6)</label>
          <input
            type="number"
            bind:value={editingEnemy.ascension}
            min="0"
            max="6"
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Ability Name</label>
          <input
            type="text"
            bind:value={editingEnemy.abilityName}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>

        <div>
          <label class="block text-xs text-gray-400 mb-1">Ability Description</label>
          <input
            type="text"
            bind:value={editingEnemy.abilityDescription}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
      </div>

      <!-- Stat Overrides -->
      <div class="mt-3">
        <label class="block text-xs text-gray-400 mb-1">Stat Multipliers (optional, default 1.0)</label>
        <div class="grid grid-cols-4 gap-2">
          <div>
            <label class="text-xs text-gray-500">HP x</label>
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
            <label class="text-xs text-gray-500">ATK x</label>
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
            <label class="text-xs text-gray-500">DEF x</label>
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
            <label class="text-xs text-gray-500">SPD x</label>
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
    {#each enemies as enemy (enemy.id)}
      {@const base = ROLE_BASE_STATS[enemy.role]}
      <div class="flex items-center gap-3 px-3 py-2 bg-slate-800 rounded hover:bg-slate-750 group">
        <span class="w-6 text-center font-bold {RARITY_COLORS[enemy.rarity]} capitalize text-xs">
          {enemy.rarity.slice(0, 1).toUpperCase()}
        </span>

        <span class="w-20 text-xs px-2 py-0.5 rounded bg-slate-700 text-center capitalize">
          {enemy.role}
        </span>

        <span class="flex-1 font-medium text-red-300">{enemy.name}</span>

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

  {#if enemies.length === 0}
    <p class="text-gray-500 text-center py-8">No enemies. Create enemy templates for dungeons!</p>
  {/if}
</div>
