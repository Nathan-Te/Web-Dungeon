<script lang="ts">
  import type { CharacterDefinition, Rarity } from '../game/types';
  import type { GachaConfig } from '../admin/adminTypes';
  import type { PlayerSave } from './playerStore';

  interface Props {
    playerSave: PlayerSave;
    characters: CharacterDefinition[];
    gachaConfig: GachaConfig;
    onPull: (characterId: string) => void;
  }

  let { playerSave, characters, gachaConfig, onPull }: Props = $props();

  const RARITY_COLORS: Record<Rarity, string> = {
    common: 'border-gray-400 bg-gray-800',
    rare: 'border-blue-400 bg-blue-900',
    epic: 'border-purple-400 bg-purple-900',
    legendary: 'border-yellow-400 bg-yellow-900',
  };

  const RARITY_TEXT: Record<Rarity, string> = {
    common: 'text-gray-300',
    rare: 'text-blue-400',
    epic: 'text-purple-400',
    legendary: 'text-yellow-400',
  };

  let pullResult: CharacterDefinition | null = $state(null);
  let isNew = $state(false);
  let isAnimating = $state(false);

  function performPull() {
    if (playerSave.daily.gachaPulled || gachaConfig.characterPool.length === 0) return;

    isAnimating = true;
    pullResult = null;

    // Determine rarity by weighted random
    const roll = Math.random();
    let cumulative = 0;
    let selectedRarity: Rarity = 'common';
    for (const rarity of ['legendary', 'epic', 'rare', 'common'] as Rarity[]) {
      cumulative += gachaConfig.rates[rarity] ?? 0;
      if (roll < cumulative) {
        selectedRarity = rarity;
        break;
      }
    }

    // Filter pool by rarity
    const poolForRarity = gachaConfig.characterPool
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined && c.rarity === selectedRarity);

    // Fallback: if no characters of that rarity exist, pick from entire pool
    const pool = poolForRarity.length > 0
      ? poolForRarity
      : gachaConfig.characterPool
          .map((id) => characters.find((c) => c.id === id))
          .filter((c): c is CharacterDefinition => c !== undefined);

    if (pool.length === 0) {
      isAnimating = false;
      return;
    }

    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Delay to show animation
    setTimeout(() => {
      pullResult = picked;
      isNew = !playerSave.collection.some((c) => c.characterId === picked.id);
      isAnimating = false;
      onPull(picked.id);
    }, 1200);
  }

  function getSpriteUrl(char: CharacterDefinition): string | null {
    const idle = char.sprites?.idle;
    if (!idle) return null;
    if (typeof idle === 'string') return idle;
    return idle.src; // sprite sheet - show the sheet image
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-yellow-400 text-center">Daily Gacha</h2>

  {#if gachaConfig.characterPool.length === 0}
    <div class="text-center text-gray-500 py-8">
      The gacha pool is empty. Ask an admin to configure it.
    </div>
  {:else if pullResult}
    <!-- Pull Result -->
    <div class="flex flex-col items-center gap-4">
      <div class="text-sm text-gray-400">You obtained:</div>
      <div class="relative rounded-xl border-4 p-6 flex flex-col items-center gap-3 {RARITY_COLORS[pullResult.rarity]}
        animate-[fadeInScale_0.5s_ease-out]">
        {#if isNew}
          <span class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-green-600 rounded-full text-xs font-bold">
            NEW!
          </span>
        {:else}
          <span class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-slate-600 rounded-full text-xs">
            Duplicate (+1)
          </span>
        {/if}
        <div class="w-24 h-24 flex items-center justify-center">
          {#if getSpriteUrl(pullResult)}
            <img src={getSpriteUrl(pullResult)} alt={pullResult.name} class="w-full h-full object-contain" />
          {:else}
            <span class="text-5xl font-bold text-white/30">{pullResult.name[0]}</span>
          {/if}
        </div>
        <div class="text-lg font-bold">{pullResult.name}</div>
        <div class="capitalize text-sm {RARITY_TEXT[pullResult.rarity]}">{pullResult.rarity}</div>
        <div class="capitalize text-xs text-gray-400">{pullResult.role}</div>
      </div>
    </div>
  {:else}
    <!-- Pull Button -->
    <div class="flex flex-col items-center gap-4">
      {#if playerSave.daily.gachaPulled}
        <div class="text-center text-gray-400 py-4">
          You already used your daily pull. Come back tomorrow!
        </div>
      {:else}
        <div class="text-sm text-gray-400">You have 1 free pull available today</div>
        <button
          onclick={performPull}
          disabled={isAnimating}
          class="px-8 py-4 bg-gradient-to-b from-yellow-500 to-amber-700 hover:from-yellow-400 hover:to-amber-600
            disabled:opacity-50 rounded-xl text-xl font-bold shadow-lg shadow-amber-900/50 transition-all
            {isAnimating ? 'animate-pulse scale-95' : 'hover:scale-105'}"
        >
          {isAnimating ? 'Pulling...' : 'Pull!'}
        </button>
      {/if}

      <!-- Rates Info -->
      <div class="bg-slate-800 rounded-lg p-4 w-full max-w-sm">
        <h4 class="text-xs text-gray-500 mb-2 text-center">Pull Rates</h4>
        <div class="grid grid-cols-4 gap-2 text-center">
          {#each (['common', 'rare', 'epic', 'legendary'] as Rarity[]) as rarity}
            <div>
              <div class="text-xs capitalize {RARITY_TEXT[rarity]}">{rarity}</div>
              <div class="text-sm font-bold">{((gachaConfig.rates[rarity] ?? 0) * 100).toFixed(0)}%</div>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  @keyframes fadeInScale {
    0% { opacity: 0; transform: scale(0.5); }
    100% { opacity: 1; transform: scale(1); }
  }
</style>
