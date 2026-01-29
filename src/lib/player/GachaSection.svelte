<script lang="ts">
  import type { CharacterDefinition, Rarity, Role } from '../game/types';
  import type { GachaConfig } from '../admin/adminTypes';
  import type { PlayerSave } from './playerStore';
  import SpritePreview from '../components/SpritePreview.svelte';

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

  const ROLE_ICONS: Record<Role, string> = {
    tank: 'T', warrior: 'W', archer: 'A', mage: 'M',
    assassin: 'X', healer: 'H', summoner: 'S',
  };

  let pullResult: CharacterDefinition | null = $state(null);
  let isNew = $state(false);
  let isAnimating = $state(false);
  let showResult = $state(false);

  // Carousel state
  let carouselItems: CharacterDefinition[] = $state([]);
  let carouselOffset = $state(0);
  let carouselTimer: ReturnType<typeof setInterval> | null = null;
  let currentCarouselChar = $derived(carouselItems.length > 0 ? carouselItems[Math.min(carouselOffset, carouselItems.length - 1)] : null);

  /** Build a randomized carousel strip of characters from the pool */
  function buildCarouselStrip(finalChar: CharacterDefinition): CharacterDefinition[] {
    const pool = gachaConfig.characterPool
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined);
    if (pool.length === 0) return [finalChar];

    const strip: CharacterDefinition[] = [];
    // 20 random characters then the final one
    for (let i = 0; i < 20; i++) {
      strip.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    strip.push(finalChar);
    return strip;
  }

  function performPull() {
    if (playerSave.daily.gachaPulled || gachaConfig.characterPool.length === 0) return;

    isAnimating = true;
    pullResult = null;
    showResult = false;

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

    // Start carousel
    carouselItems = buildCarouselStrip(picked);
    carouselOffset = 0;

    let step = 0;
    const totalSteps = carouselItems.length - 1;
    let speed = 60; // start fast

    function advanceCarousel() {
      if (step >= totalSteps) {
        // Landed on final
        if (carouselTimer) { clearInterval(carouselTimer); carouselTimer = null; }
        pullResult = picked;
        isNew = !playerSave.collection.some((c) => c.characterId === picked.id);
        isAnimating = false;
        showResult = true;
        onPull(picked.id);
        return;
      }
      step++;
      carouselOffset = step;
      // Slow down as we approach the end
      const progress = step / totalSteps;
      speed = 60 + Math.floor(progress * progress * 400); // decelerate
      if (carouselTimer) clearInterval(carouselTimer);
      carouselTimer = setInterval(advanceCarousel, speed);
    }

    carouselTimer = setInterval(advanceCarousel, speed);
  }
</script>

<div class="space-y-6">
  <h2 class="text-xl font-bold text-yellow-400 text-center">Daily Gacha</h2>

  {#if gachaConfig.characterPool.length === 0}
    <div class="text-center text-gray-500 py-8">
      The gacha pool is empty. Ask an admin to configure it.
    </div>
  {:else if showResult && pullResult}
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
        <SpritePreview sprites={pullResult.sprites} fallback={pullResult.name[0]} class="w-24 h-24" />
        <div class="text-lg font-bold">{pullResult.name}</div>
        <div class="capitalize text-sm {RARITY_TEXT[pullResult.rarity]}">{pullResult.rarity}</div>
        <div class="capitalize text-xs text-gray-400">{pullResult.role}</div>
      </div>
    </div>
  {:else if isAnimating && carouselItems.length > 0}
    <!-- Carousel animation -->
    <div class="flex flex-col items-center gap-4">
      <div class="text-sm text-gray-400 animate-pulse">Pulling...</div>
      {#if currentCarouselChar}
        <div class="w-28 h-36 overflow-hidden rounded-xl border-4 border-yellow-500 bg-slate-800 relative">
          <div class="w-full h-full flex flex-col items-center justify-center gap-1 p-2
            animate-[slotFlip_0.1s_ease-out]" style="animation-iteration-count: 1;">
            <SpritePreview sprites={currentCarouselChar.sprites} fallback={ROLE_ICONS[currentCarouselChar.role]} class="w-16 h-16" />
            <span class="text-xs font-bold truncate w-full text-center">{currentCarouselChar.name}</span>
            <span class="text-[10px] capitalize {RARITY_TEXT[currentCarouselChar.rarity]}">{currentCarouselChar.rarity}</span>
          </div>
        </div>
      {/if}
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
            hover:scale-105"
        >
          Pull!
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
  @keyframes slotFlip {
    0% { transform: translateY(-100%); opacity: 0.3; }
    100% { transform: translateY(0); opacity: 1; }
  }
</style>
