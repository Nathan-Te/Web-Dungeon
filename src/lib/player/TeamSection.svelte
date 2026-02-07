<script lang="ts">
  import type { CharacterDefinition, Role, Rarity, BaseStats } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { PlayerSave, OwnedCharacter, TeamPreset } from './playerStore';
  import { MAX_TEAM_PRESETS, MAX_TEAM_SIZE } from './playerStore';
  import { calculateCharacterPower } from '../game/expeditionSimulation';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    onSaveTeam: (slotIndex: number, name: string, characterIds: string[]) => void;
    onDeleteTeam: (slotIndex: number) => void;
  }

  let { playerSave, characters, roleStats, rarityMultipliers, onSaveTeam, onDeleteTeam }: Props = $props();

  const RARITY_BORDER: Record<Rarity, string> = {
    common: 'border-gray-500',
    rare: 'border-blue-500',
    epic: 'border-purple-500',
    legendary: 'border-yellow-500',
  };

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'bg-blue-900', warrior: 'bg-orange-900', archer: 'bg-green-900',
    mage: 'bg-purple-900', assassin: 'bg-gray-800', healer: 'bg-emerald-900',
    summoner: 'bg-teal-900',
  };

  const ROLE_TEXT_COLORS: Record<Role, string> = {
    tank: 'text-blue-400', warrior: 'text-orange-400', archer: 'text-green-400', mage: 'text-purple-400',
    assassin: 'text-red-400', healer: 'text-pink-400', summoner: 'text-teal-400',
  };

  const ROLE_LABELS: Record<Role, string> = {
    tank: 'Tank', warrior: 'Warrior', archer: 'Archer', mage: 'Mage',
    assassin: 'Assassin', healer: 'Healer', summoner: 'Summoner',
  };

  // Editing state
  let editingSlot: number | null = $state(null);
  let editName: string = $state('');
  let editSelection: string[] = $state([]);

  let ownedMap = $derived(
    new Map(playerSave.collection.map((o) => [o.characterId, o]))
  );

  function getCharDef(id: string): CharacterDefinition | undefined {
    return characters.find((c) => c.id === id);
  }

  function getPreset(index: number): TeamPreset | undefined {
    const preset = playerSave.teams?.[index];
    if (!preset || preset.characterIds.length === 0) return undefined;
    return preset;
  }

  function startEditing(slotIndex: number) {
    const preset = getPreset(slotIndex);
    editingSlot = slotIndex;
    editName = preset?.name || `Team ${slotIndex + 1}`;
    // Filter out characters that are no longer owned
    editSelection = (preset?.characterIds ?? []).filter(id => ownedMap.has(id));
  }

  function cancelEditing() {
    editingSlot = null;
    editSelection = [];
    editName = '';
  }

  function saveEditing() {
    if (editingSlot === null) return;
    onSaveTeam(editingSlot, editName, editSelection);
    editingSlot = null;
    editSelection = [];
    editName = '';
  }

  function toggleCharacter(charId: string) {
    if (editSelection.includes(charId)) {
      editSelection = editSelection.filter(id => id !== charId);
    } else if (editSelection.length < MAX_TEAM_SIZE) {
      editSelection = [...editSelection, charId];
    }
  }

  function handleDelete(slotIndex: number) {
    onDeleteTeam(slotIndex);
  }

  let ownedCharacters = $derived(
    playerSave.collection
      .map((o) => ({ owned: o, def: characters.find((c) => c.id === o.characterId) }))
      .filter((x): x is { owned: OwnedCharacter; def: CharacterDefinition } => x.def !== undefined)
  );

  function getCharPower(owned: OwnedCharacter, def: CharacterDefinition): number {
    const base = roleStats?.[def.role] ?? ROLE_BASE_STATS[def.role];
    const rarityMult = rarityMultipliers?.[def.rarity] ?? 1;
    const levelMult = 1 + (owned.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascMult = 1 + owned.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    const stats = {
      hp: Math.round(base.hp * rarityMult * levelMult * ascMult),
      atk: Math.round(base.atk * rarityMult * levelMult * ascMult),
      def: Math.round(base.def * rarityMult * levelMult * ascMult),
      spd: Math.round(base.spd * rarityMult * levelMult * ascMult),
    };
    return calculateCharacterPower(stats, def.role);
  }

  function getTeamPower(characterIds: string[]): number {
    let total = 0;
    for (const id of characterIds) {
      const owned = ownedMap.get(id);
      const def = getCharDef(id);
      if (!owned || !def) continue;
      const base = roleStats?.[def.role] ?? ROLE_BASE_STATS[def.role];
      const rarityMult = rarityMultipliers?.[def.rarity] ?? 1;
      const levelMult = 1 + (owned.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
      const ascMult = 1 + owned.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
      const stats = {
        hp: Math.round(base.hp * rarityMult * levelMult * ascMult),
        atk: Math.round(base.atk * rarityMult * levelMult * ascMult),
        def: Math.round(base.def * rarityMult * levelMult * ascMult),
        spd: Math.round(base.spd * rarityMult * levelMult * ascMult),
      };
      total += calculateCharacterPower(stats, def.role);
    }
    return total;
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-indigo-400 text-center">Team Management</h2>

  {#if playerSave.collection.length === 0}
    <div class="text-center text-gray-500 py-8">
      Your collection is empty. Pull characters from the Gacha first!
    </div>
  {:else if editingSlot !== null}
    <!-- Editing a team preset -->
    <div class="space-y-4">
      <div class="bg-slate-800 rounded-lg p-4">
        <div class="flex items-center gap-3 mb-4">
          <label for="team-name-input" class="text-sm text-gray-400">Name:</label>
          <input
            id="team-name-input"
            type="text"
            bind:value={editName}
            maxlength="20"
            class="flex-1 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
        </div>

        <h3 class="font-bold mb-3 text-gray-300">
          Select Characters ({editSelection.length}/{MAX_TEAM_SIZE})
        </h3>

        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-3 mb-4">
          {#each ownedCharacters as { owned, def }}
            {@const isSelected = editSelection.includes(owned.characterId)}
            {@const power = getCharPower(owned, def)}
            <button
              onclick={() => toggleCharacter(owned.characterId)}
              class="relative aspect-[7/10] rounded-lg border-2 flex flex-col items-center overflow-hidden transition-all
                {RARITY_BORDER[def.rarity]}
                {isSelected
                  ? 'ring-2 ring-indigo-400 scale-105'
                  : editSelection.length >= MAX_TEAM_SIZE
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:brightness-125'}
                {ROLE_COLORS[def.role]}"
            >
              {#if isSelected}
                <span class="absolute top-0.5 right-0.5 w-5 h-5 bg-indigo-500 rounded-full flex items-center justify-center text-[9px] font-bold text-white z-10">
                  {editSelection.indexOf(owned.characterId) + 1}
                </span>
              {/if}
              <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-14 h-14 sm:w-20 sm:h-20 lg:w-16 lg:h-16 mt-1" />
              <span class="text-[10px] font-medium truncate w-full text-center px-1">{def.name}</span>
              <span class="text-[9px] {ROLE_TEXT_COLORS[def.role]}">{ROLE_LABELS[def.role]}</span>
              <span class="text-[9px] text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</span>
              <span class="text-[8px] text-indigo-400 font-medium">{power} PWR</span>
            </button>
          {/each}
        </div>

        <!-- Selected team preview -->
        {#if editSelection.length > 0}
          <div class="bg-slate-900 rounded-lg p-3 mb-4">
            <div class="flex items-center justify-between mb-2">
              <span class="text-xs text-gray-400">Team Preview</span>
              <span class="text-xs text-indigo-400 font-bold">Power: {getTeamPower(editSelection)}</span>
            </div>
            <div class="flex gap-2 flex-wrap">
              {#each editSelection as charId}
                {@const def = getCharDef(charId)}
                {@const owned = ownedMap.get(charId)}
                {#if def && owned}
                  <div class="flex items-center gap-1.5 bg-slate-800 rounded px-2 py-1 border {RARITY_BORDER[def.rarity]}">
                    <div class="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                      <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-8 h-8" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-[10px] font-medium truncate">{def.name}</div>
                      <div class="text-[8px] text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</div>
                    </div>
                  </div>
                {/if}
              {/each}
            </div>
          </div>
        {/if}

        <div class="flex gap-3">
          <button
            onclick={cancelEditing}
            class="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onclick={saveEditing}
            disabled={editSelection.length === 0}
            class="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-bold"
          >
            Save Team
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Team preset slots overview -->
    <div class="space-y-4">
      {#each Array(MAX_TEAM_PRESETS) as _, slotIndex}
        {@const preset = getPreset(slotIndex)}
        <div class="bg-slate-800 rounded-lg p-4 border {preset ? 'border-indigo-600' : 'border-slate-700'}">
          {#if preset}
            <!-- Filled slot -->
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-indigo-400">{preset.name || `Team ${slotIndex + 1}`}</h3>
              <div class="flex items-center gap-2">
                <span class="text-xs text-gray-500">{preset.characterIds.filter(id => ownedMap.has(id)).length}/{MAX_TEAM_SIZE} characters</span>
                <span class="text-xs text-indigo-400 font-bold">Power: {getTeamPower(preset.characterIds.filter(id => ownedMap.has(id)))}</span>
              </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 mb-3">
              {#each preset.characterIds as charId}
                {@const def = getCharDef(charId)}
                {@const owned = ownedMap.get(charId)}
                {#if def && owned}
                  {@const power = getCharPower(owned, def)}
                  <div class="flex items-center gap-2 bg-slate-900 rounded-lg px-2 sm:px-3 py-2 border {RARITY_BORDER[def.rarity]} min-w-0">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden flex-shrink-0">
                      <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs sm:text-sm font-medium truncate">{def.name}</div>
                      <div class="flex items-center gap-1.5 text-[10px]">
                        <span class="{ROLE_TEXT_COLORS[def.role]}">{ROLE_LABELS[def.role]}</span>
                        <span class="text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</span>
                        <span class="text-indigo-400 font-medium">{power} PWR</span>
                      </div>
                    </div>
                  </div>
                {:else}
                  <div class="flex items-center gap-2 bg-slate-900 rounded-lg px-2 sm:px-3 py-2 border border-red-800 opacity-50">
                    <div class="w-8 h-8 sm:w-10 sm:h-10 rounded bg-slate-700 flex items-center justify-center text-xs text-red-400">?</div>
                    <div class="text-[10px] text-red-400">Missing</div>
                  </div>
                {/if}
              {/each}
            </div>

            <div class="flex gap-2">
              <button
                onclick={() => startEditing(slotIndex)}
                class="flex-1 px-3 py-2 bg-indigo-700 hover:bg-indigo-600 rounded text-sm font-medium"
              >
                Edit
              </button>
              <button
                onclick={() => handleDelete(slotIndex)}
                class="px-3 py-2 bg-red-900 hover:bg-red-800 rounded text-sm text-red-300"
              >
                Delete
              </button>
            </div>
          {:else}
            <!-- Empty slot -->
            <div class="text-center py-4">
              <div class="text-gray-500 text-sm mb-3">Slot {slotIndex + 1} — Empty</div>
              <button
                onclick={() => startEditing(slotIndex)}
                class="px-6 py-2 bg-indigo-800 hover:bg-indigo-700 border border-indigo-600 rounded text-sm font-bold"
              >
                Create Team
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>
