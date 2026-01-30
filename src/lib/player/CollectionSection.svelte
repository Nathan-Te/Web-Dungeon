<script lang="ts">
  import type { CharacterDefinition, Role, Rarity, BaseStats, SpriteSource, SpriteSheetConfig } from '../game/types';
  import { ROLE_BASE_STATS, COMBAT_CONSTANTS } from '../game/types';
  import type { GachaConfig } from '../admin/adminTypes';
  import type { PlayerSave, OwnedCharacter } from './playerStore';
  import { getXpForLevel } from './playerStore';
  import SpritePreview from '../components/SpritePreview.svelte';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    gachaConfig?: GachaConfig;
    roleStats?: Partial<Record<Role, BaseStats>>;
    rarityMultipliers?: Partial<Record<Rarity, number>>;
    levelThresholds?: number[];
    onAscend: (characterId: string) => void;
  }

  let { playerSave, characters, gachaConfig, roleStats, rarityMultipliers, levelThresholds, onAscend }: Props = $props();

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

  let selectedCharId: string | null = $state(null);

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

  let selectedChar = $derived(selectedCharId ? getCharDef(selectedCharId) : null);
  let selectedOwned = $derived(selectedCharId ? ownedMap.get(selectedCharId) : undefined);
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-blue-400 text-center">Collection</h2>

  {#if playerSave.collection.length === 0}
    <div class="text-center text-gray-500 py-8">
      Your collection is empty. Pull characters from the Gacha!
    </div>
  {:else}
    <!-- Character Grid -->
    <div class="flex gap-3 flex-wrap justify-center">
      {#each playerSave.collection as owned}
        {@const def = getCharDef(owned.characterId)}
        {#if def}
          <button
            onclick={() => selectedCharId = selectedCharId === owned.characterId ? null : owned.characterId}
            class="relative w-28 h-36 rounded-lg border-2 flex flex-col items-center justify-center gap-0.5 transition-all overflow-hidden
              {RARITY_BORDER[def.rarity]}
              {selectedCharId === owned.characterId ? 'ring-2 ring-white scale-105' : 'hover:brightness-125'}
              bg-slate-800"
          >
            {#if canAscend(owned)}
              <span class="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[9px] font-bold text-black z-10">!</span>
            {/if}
            <SpritePreview sprites={def.sprites} fallback={ROLE_ICONS[def.role]} class="w-20 h-20" />
            <span class="text-[10px] font-medium truncate w-full text-center px-1">{def.name}</span>
            <span class="text-[9px] text-yellow-400">{'*'.repeat(owned.ascension)}Lv{owned.level}</span>
          </button>
        {/if}
      {/each}
    </div>

    <!-- Character Detail -->
    {#if selectedChar && selectedOwned}
      {@const stats = getStats(selectedOwned, selectedChar)}
      {@const cost = getAscensionCost(selectedOwned.ascension)}
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
              <span class="text-gray-400 capitalize">{selectedChar.role}</span>
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
