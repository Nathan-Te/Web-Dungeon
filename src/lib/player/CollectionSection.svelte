<script lang="ts">
  import type { CharacterDefinition, Role, Rarity, BaseStats, SpriteSource, SpriteSheetConfig } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { GachaConfig } from '../admin/adminTypes';
  import type { AbilityDefinition } from '../game/abilities';
  import type { PlayerSave, OwnedCharacter } from './playerStore';
  import { getXpForLevel } from './playerStore';
  import { calculateCharacterPower } from '../game/expeditionSimulation';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    gachaConfig?: GachaConfig;
    abilities?: AbilityDefinition[];
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    levelThresholds?: number[];
    onAscend: (characterId: string) => void;
  }

  let { playerSave, characters, gachaConfig, abilities, roleStats, rarityMultipliers, levelThresholds, onAscend }: Props = $props();

  const RARITY_BORDER: Record<Rarity, string> = {
    common: 'border-gray-500',
    rare: 'border-blue-500',
    epic: 'border-purple-500',
    legendary: 'border-yellow-500',
  };

  const RARITY_TEXT: Record<Rarity, string> = {
    common: 'text-gray-400',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  const ROLE_TEXT_COLORS: Record<Role, string> = {
    tank: 'text-blue-400', warrior: 'text-orange-400', archer: 'text-green-400', mage: 'text-purple-400',
    assassin: 'text-red-400', healer: 'text-pink-400', summoner: 'text-teal-400',
  };

  const ROLE_LABELS: Record<Role, string> = {
    tank: 'Tank', warrior: 'Warrior', archer: 'Archer', mage: 'Mage',
    assassin: 'Assassin', healer: 'Healer', summoner: 'Summoner',
  };

  const ALL_ROLES: Role[] = ['tank', 'warrior', 'archer', 'mage', 'assassin', 'healer', 'summoner'];
  const ALL_RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
  const RARITY_ORDER: Record<Rarity, number> = { common: 0, rare: 1, epic: 2, legendary: 3 };

  let selectedCharId: string | null = $state(null);

  // Search & filter state
  let searchQuery = $state('');
  let filterRole: Role | 'all' = $state('all');
  let filterRarity: Rarity | 'all' = $state('all');
  type SortKey = 'level' | 'rarity' | 'role' | 'power' | 'name';
  let sortBy: SortKey = $state('level');
  let sortDesc = $state(true);

  let ownedMap = $derived(
    new Map(playerSave.collection.map((o) => [o.characterId, o]))
  );

  function getCharDef(id: string): CharacterDefinition | undefined {
    return characters.find((c) => c.id === id);
  }

  function getStats(owned: OwnedCharacter, def: CharacterDefinition): { hp: number; atk: number; def: number; spd: number } {
    const base = roleStats?.[def.role] ?? ROLE_BASE_STATS[def.role];
    const rarityMult = rarityMultipliers?.[def.rarity] ?? 1;
    const levelMult = 1 + (owned.level - 1) * COMBAT_CONSTANTS.LEVEL_STAT_BONUS;
    const ascMult = 1 + owned.ascension * COMBAT_CONSTANTS.ASCENSION_STAT_BONUS;
    return {
      hp: Math.round(base.hp * rarityMult * levelMult * ascMult),
      atk: Math.round(base.atk * rarityMult * levelMult * ascMult),
      def: Math.round(base.def * rarityMult * levelMult * ascMult),
      spd: Math.round(base.spd * rarityMult * levelMult * ascMult),
    };
  }

  function getAscensionCost(currentAscension: number): number | null {
    const costs = gachaConfig?.ascensionCosts ?? [1, 2, 3, 4, 5, 6];
    if (currentAscension >= costs.length) return null;
    return costs[currentAscension];
  }

  function canAscend(owned: OwnedCharacter): boolean {
    const cost = getAscensionCost(owned.ascension);
    return cost !== null && owned.duplicates >= cost;
  }

  function findAbility(def: CharacterDefinition): AbilityDefinition | undefined {
    if (!abilities || !def.abilityName) return undefined;
    return abilities.find(a => a.name.toLowerCase() === def.abilityName.toLowerCase());
  }

  function formatAbilityEffect(ab: AbilityDefinition, stats: { atk: number }): string {
    if (ab.targeting === 'heal_lowest_ally') {
      const heal = Math.round(stats.atk * ab.powerMultiplier);
      return `Soin : ~${heal} PV (${(ab.powerMultiplier * 100).toFixed(0)}% ATK)`;
    }
    if (ab.targeting === 'summon_unit') {
      return 'Invoque une unité alliée';
    }
    const dmg = Math.round(stats.atk * ab.powerMultiplier);
    const targets = ab.targetCount > 1 ? ` x${ab.targetCount} cibles` : '';
    const ignDef = ab.ignoreDefense ? ', ignore DEF' : '';
    return `Dégâts : ~${dmg} (${(ab.powerMultiplier * 100).toFixed(0)}% ATK)${targets}${ignDef}`;
  }

  // Filtered and sorted collection
  let filteredCollection = $derived.by(() => {
    const query = searchQuery.trim().toLowerCase();
    let list = playerSave.collection
      .map(owned => {
        const def = getCharDef(owned.characterId);
        if (!def) return null;
        const stats = getStats(owned, def);
        const power = calculateCharacterPower(stats, def.role);
        return { owned, def, stats, power };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Text search
    if (query) {
      list = list.filter(({ def }) =>
        def.name.toLowerCase().includes(query) ||
        def.role.toLowerCase().includes(query) ||
        def.abilityName?.toLowerCase().includes(query)
      );
    }

    // Role filter
    if (filterRole !== 'all') {
      list = list.filter(({ def }) => def.role === filterRole);
    }

    // Rarity filter
    if (filterRarity !== 'all') {
      list = list.filter(({ def }) => def.rarity === filterRarity);
    }

    // Sort
    const dir = sortDesc ? -1 : 1;
    list.sort((a, b) => {
      switch (sortBy) {
        case 'level':
          return (a.owned.level - b.owned.level || a.owned.ascension - b.owned.ascension) * dir;
        case 'rarity':
          return (RARITY_ORDER[a.def.rarity] - RARITY_ORDER[b.def.rarity]) * dir;
        case 'role':
          return a.def.role.localeCompare(b.def.role) * dir;
        case 'power':
          return (a.power - b.power) * dir;
        case 'name':
          return a.def.name.localeCompare(b.def.name) * dir;
        default:
          return 0;
      }
    });

    return list;
  });

  let selectedChar = $derived(selectedCharId ? getCharDef(selectedCharId) : null);
  let selectedOwned = $derived(selectedCharId ? ownedMap.get(selectedCharId) : undefined);
</script>

<div class="space-y-4">
  <h2 class="text-xl font-bold text-blue-400 text-center">Collection</h2>

  {#if playerSave.collection.length === 0}
    <div class="text-center text-gray-500 py-8">
      Your collection is empty. Pull characters from the Gacha!
    </div>
  {:else}
    <!-- Search & Filters -->
    <div class="bg-slate-800 rounded-lg p-3 space-y-2">
      <!-- Search bar -->
      <input
        type="text"
        placeholder="Rechercher un personnage..."
        bind:value={searchQuery}
        class="w-full px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-sm text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
      />

      <!-- Filters row -->
      <div class="flex gap-2 flex-wrap items-center">
        <!-- Role filter -->
        <select
          bind:value={filterRole}
          class="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Tous les rôles</option>
          {#each ALL_ROLES as role}
            <option value={role}>{ROLE_LABELS[role]}</option>
          {/each}
        </select>

        <!-- Rarity filter -->
        <select
          bind:value={filterRarity}
          class="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Toutes raretés</option>
          {#each ALL_RARITIES as rarity}
            <option value={rarity} class="capitalize">{rarity}</option>
          {/each}
        </select>

        <!-- Sort -->
        <select
          bind:value={sortBy}
          class="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white focus:border-blue-500 focus:outline-none"
        >
          <option value="level">Tri: Niveau</option>
          <option value="power">Tri: Puissance</option>
          <option value="rarity">Tri: Rareté</option>
          <option value="role">Tri: Rôle</option>
          <option value="name">Tri: Nom</option>
        </select>

        <!-- Sort direction -->
        <button
          onclick={() => sortDesc = !sortDesc}
          class="px-2 py-1.5 bg-slate-900 border border-slate-600 rounded text-xs text-white hover:bg-slate-700"
          title={sortDesc ? 'Décroissant' : 'Croissant'}
        >
          {sortDesc ? '\u{2193}' : '\u{2191}'}
        </button>

        <!-- Results count -->
        <span class="text-[10px] text-gray-500 ml-auto">
          {filteredCollection.length}/{playerSave.collection.length}
        </span>
      </div>
    </div>

    <!-- Character Grid -->
    {#if filteredCollection.length === 0}
      <div class="text-center text-gray-500 py-6 text-sm">
        Aucun personnage trouvé.
      </div>
    {:else}
      <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2 sm:gap-3">
        {#each filteredCollection as { owned, def, power }}
          <button
            onclick={() => selectedCharId = selectedCharId === owned.characterId ? null : owned.characterId}
            class="relative aspect-[7/10] rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all overflow-hidden
              {RARITY_BORDER[def.rarity]}
              {selectedCharId === owned.characterId ? 'ring-2 ring-white scale-105' : 'hover:brightness-125'}
              bg-slate-800"
          >
            {#if canAscend(owned)}
              <span class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-black z-10">!</span>
            {/if}
            <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-14 h-14 sm:w-20 sm:h-20" />
            <span class="text-[10px] font-medium truncate w-full text-center px-1">{def.name}</span>
            <span class="text-[9px] {ROLE_TEXT_COLORS[def.role]}">{ROLE_LABELS[def.role]}</span>
            <span class="text-[9px] text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</span>
            <span class="text-[8px] text-indigo-400 font-medium">{power} PWR</span>
          </button>
        {/each}
      </div>
    {/if}

    <!-- Character Detail -->
    {#if selectedChar && selectedOwned}
      {@const stats = getStats(selectedOwned, selectedChar)}
      {@const cost = getAscensionCost(selectedOwned.ascension)}
      {@const detailPower = calculateCharacterPower(stats, selectedChar.role)}
      <div class="bg-slate-800 rounded-lg p-4 max-w-md mx-auto border {RARITY_BORDER[selectedChar.rarity]}">
        <div class="flex gap-4">
          <!-- Sprite -->
          <div class="w-24 h-24 rounded-lg bg-slate-900 border border-slate-700 overflow-hidden">
            <SpritePreview sprites={selectedChar.sprites} fallback={ROLE_ICONS[selectedChar.role]} class="w-24 h-24" />
          </div>
          <!-- Info -->
          <div class="flex-1 space-y-1">
            <h3 class="font-bold text-lg">{selectedChar.name}</h3>
            <div class="flex gap-2 text-xs">
              <span class="capitalize {RARITY_TEXT[selectedChar.rarity]}">{selectedChar.rarity}</span>
              <span class="{ROLE_TEXT_COLORS[selectedChar.role]}">{ROLE_LABELS[selectedChar.role]}</span>
              <span class="text-indigo-400 font-bold">{detailPower} PWR</span>
            </div>
            <div class="text-sm">
              <span class="text-yellow-400">Ascension {selectedOwned.ascension}</span>
              <span class="text-gray-500 mx-1">|</span>
              <span class="text-gray-300">Level {selectedOwned.level}</span>
            </div>
            {#if getXpForLevel(selectedOwned.level, levelThresholds) !== null}
              {@const xpNeeded = getXpForLevel(selectedOwned.level, levelThresholds)!}
              <div class="text-xs text-gray-400">
                XP: <span class="text-cyan-400 font-medium">{selectedOwned.xp ?? 0}</span>
                <span class="text-gray-500"> / </span>
                <span class="text-cyan-300">{xpNeeded}</span>
              </div>
              <div class="w-full bg-slate-700 rounded-full h-1.5 mt-0.5">
                <div
                  class="bg-cyan-500 h-1.5 rounded-full transition-all"
                  style="width: {Math.min(100, ((selectedOwned.xp ?? 0) / xpNeeded) * 100)}%"
                ></div>
              </div>
            {:else}
              <div class="text-xs text-cyan-400 font-bold">Max Level</div>
            {/if}
            <div class="text-xs text-gray-400">
              Duplicates: {selectedOwned.duplicates}
            </div>
          </div>
        </div>

        <!-- Stats -->
        <div class="mt-4 grid grid-cols-4 gap-2 text-center">
          <div class="bg-slate-900 rounded p-2">
            <div class="text-xs text-gray-500">HP</div>
            <div class="text-sm font-bold text-green-400">{stats.hp}</div>
          </div>
          <div class="bg-slate-900 rounded p-2">
            <div class="text-xs text-gray-500">ATK</div>
            <div class="text-sm font-bold text-red-400">{stats.atk}</div>
          </div>
          <div class="bg-slate-900 rounded p-2">
            <div class="text-xs text-gray-500">DEF</div>
            <div class="text-sm font-bold text-blue-400">{stats.def}</div>
          </div>
          <div class="bg-slate-900 rounded p-2">
            <div class="text-xs text-gray-500">SPD</div>
            <div class="text-sm font-bold text-yellow-400">{stats.spd}</div>
          </div>
        </div>

        <!-- Ability -->
        {#if selectedChar.abilityName}
          {@const ab = findAbility(selectedChar)}
          <div class="mt-4 bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div class="flex items-center gap-2 mb-1">
              <span class="text-xs text-gray-500">Sort</span>
              <span class="text-sm font-bold text-amber-400">{selectedChar.abilityName}</span>
            </div>
            {#if selectedChar.abilityDescription}
              <p class="text-xs text-gray-300 leading-relaxed">{selectedChar.abilityDescription}</p>
            {/if}
            {#if ab}
              <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                <span class="text-emerald-400 font-medium">{formatAbilityEffect(ab, stats)}</span>
                {#if ab.cooldown}
                  <span class="text-gray-500">CD : {ab.cooldown} tours</span>
                {/if}
              </div>
            {/if}
          </div>
        {/if}

        <!-- Ascension -->
        <div class="mt-4">
          {#if cost !== null}
            <div class="flex items-center gap-3">
              <button
                onclick={() => onAscend(selectedOwned!.characterId)}
                disabled={!canAscend(selectedOwned)}
                class="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:opacity-40 disabled:cursor-not-allowed rounded text-sm font-bold"
              >
                Ascend
              </button>
              <span class="text-xs text-gray-400">
                {selectedOwned.duplicates}/{cost} duplicates needed
              </span>
            </div>
          {:else}
            <div class="text-xs text-yellow-400 font-bold">Max Ascension reached!</div>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</div>
