<script lang="ts">
  import { onDestroy } from 'svelte';
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

  const ROLE_COLORS: Record<Role, string> = {
    tank: 'bg-blue-900', warrior: 'bg-orange-900', archer: 'bg-green-900',
    mage: 'bg-purple-900', assassin: 'bg-gray-800', healer: 'bg-emerald-900',
    summoner: 'bg-teal-900',
  };

  let pullResult: CharacterDefinition | null = $state(null);
  let isNew = $state(false);
  let isAnimating = $state(false);
  let showResult = $state(false);

  // Horizontal carousel state (CS:GO case opening style)
  let carouselItems: CharacterDefinition[] = $state([]);
  let carouselX = $state(0); // Current pixel offset of the strip
  let carouselAnimFrame: number | null = null;
  let carouselSpeed = $state(0); // pixels per frame
  let carouselTargetX = $state(0); // where we want to stop
  let carouselLanded = $state(false);

  const CARD_WIDTH = 96; // w-24 = 96px
  const CARD_GAP = 8; // gap-2 = 8px
  const CARD_STEP = CARD_WIDTH + CARD_GAP;
  const STRIP_BEFORE = 60; // random cards before the result
  const STRIP_AFTER = 10; // trailing random cards after the result (visual padding)
  const VIEWPORT_WIDTH = 400; // visible window
  const RESULT_INDEX = STRIP_BEFORE; // index of the result card in the strip

  /** Pool of characters available in gacha */
  let poolCharacters = $derived(
    gachaConfig.characterPool
      .map((id) => characters.find((c) => c.id === id))
      .filter((c): c is CharacterDefinition => c !== undefined)
  );

  /** Build strip: STRIP_BEFORE random + final + STRIP_AFTER random (trailing) */
  function buildCarouselStrip(finalChar: CharacterDefinition): CharacterDefinition[] {
    const pool = poolCharacters.length > 0 ? poolCharacters : [finalChar];
    const strip: CharacterDefinition[] = [];
    for (let i = 0; i < STRIP_BEFORE; i++) {
      strip.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    strip.push(finalChar);
    for (let i = 0; i < STRIP_AFTER; i++) {
      strip.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    return strip;
  }

  function performPull() {
    if (playerSave.daily.gachaPulled || gachaConfig.characterPool.length === 0) return;

    isAnimating = true;
    pullResult = null;
    showResult = false;
    carouselLanded = false;

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
    const poolForRarity = poolCharacters.filter((c) => c.rarity === selectedRarity);
    const pool = poolForRarity.length > 0 ? poolForRarity : poolCharacters;
    if (pool.length === 0) { isAnimating = false; return; }

    const picked = pool[Math.floor(Math.random() * pool.length)];

    // Build strip
    carouselItems = buildCarouselStrip(picked);
    carouselX = 0;

    // Center the result card in the viewport
    const finalCardPos = RESULT_INDEX * CARD_STEP;
    carouselTargetX = finalCardPos - VIEWPORT_WIDTH / 2 + CARD_WIDTH / 2;

    // Start slow, accelerate, then decelerate at the end
    carouselSpeed = 4;

    function animate() {
      if (carouselX >= carouselTargetX) {
        carouselX = carouselTargetX;
        carouselAnimFrame = null;
        carouselLanded = true;

        setTimeout(() => {
          pullResult = picked;
          isNew = !playerSave.collection.some((c) => c.characterId === picked.id);
          isAnimating = false;
          showResult = true;
          onPull(picked.id);
        }, 800);
        return;
      }

      const progress = carouselX / carouselTargetX;

      // Phase 1 (0-15%): slow start, ramp up
      // Phase 2 (15-60%): fast cruise
      // Phase 3 (60-85%): gradual slowdown
      // Phase 4 (85-95%): slow
      // Phase 5 (95-100%): crawl
      if (progress < 0.15) {
        carouselSpeed = 4 + progress / 0.15 * 20;
      } else if (progress < 0.6) {
        carouselSpeed = 24;
      } else if (progress < 0.85) {
        const t = (progress - 0.6) / 0.25;
        carouselSpeed = 24 - t * 14;
      } else if (progress < 0.95) {
        const t = (progress - 0.85) / 0.1;
        carouselSpeed = 10 - t * 6;
      } else {
        const t = (progress - 0.95) / 0.05;
        carouselSpeed = 4 - t * 2.5;
        if (carouselSpeed < 1) carouselSpeed = 1;
      }

      carouselX += carouselSpeed;
      carouselAnimFrame = requestAnimationFrame(animate);
    }

    carouselAnimFrame = requestAnimationFrame(animate);
  }

  onDestroy(() => {
    if (carouselAnimFrame) cancelAnimationFrame(carouselAnimFrame);
  });
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
    <!-- CS:GO-style horizontal carousel -->
    <div class="flex flex-col items-center gap-4">
      <div class="text-sm text-gray-400 animate-pulse">Pulling...</div>

      <!-- Carousel viewport -->
      <div class="relative" style="width: {VIEWPORT_WIDTH}px;">
        <!-- Center marker (triangle + line) -->
        <div class="absolute top-0 left-1/2 -translate-x-1/2 z-10 w-0.5 h-full bg-yellow-400/60"></div>
        <div class="absolute -top-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0
          border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[10px] border-t-yellow-400"></div>
        <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 z-10 w-0 h-0
          border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-b-[10px] border-b-yellow-400"></div>

        <!-- Scrolling strip -->
        <div class="overflow-hidden rounded-xl border-2 border-slate-600 bg-slate-900/80" style="height: 128px;">
          <div class="flex gap-2 items-center h-full" style="transform: translateX(-{carouselX}px); will-change: transform;">
            {#each carouselItems as char, idx}
              {@const isTarget = idx === RESULT_INDEX && carouselLanded}
              <div class="flex-shrink-0 w-24 h-[112px] rounded-lg border-2 flex flex-col items-center overflow-hidden transition-all
                {isTarget ? 'border-yellow-400 ring-2 ring-yellow-400 scale-105' : 'border-slate-600'}
                {ROLE_COLORS[char.role]}">
                <SpritePreview sprites={char.sprites} fallback={ROLE_ICONS[char.role]} class="w-14 h-14 mt-1" />
                <span class="text-[9px] font-bold truncate w-full text-center px-0.5">{char.name}</span>
                <span class="text-[8px] capitalize text-gray-400">{char.role}</span>
                <span class="text-[8px] capitalize {RARITY_TEXT[char.rarity]}">{char.rarity}</span>
              </div>
            {/each}
          </div>
        </div>
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
            hover:scale-105"
        >
          Pull!
        </button>
      {/if}

      <!-- Rates Info -->
      <div class="bg-slate-800 rounded-lg p-4 w-full max-w-md">
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

      <!-- Obtainable Characters -->
      {#if poolCharacters.length > 0}
        <div class="bg-slate-800 rounded-lg p-4 w-full max-w-xl">
          <h4 class="text-xs text-gray-500 mb-3 text-center">Obtainable Characters ({poolCharacters.length})</h4>
          {#each (['legendary', 'epic', 'rare', 'common'] as Rarity[]) as rarity}
            {@const chars = poolCharacters.filter((c) => c.rarity === rarity)}
            {#if chars.length > 0}
              <div class="mb-3">
                <span class="text-[10px] font-bold capitalize {RARITY_TEXT[rarity]} mb-1 block">{rarity} ({chars.length})</span>
                <div class="flex gap-2 flex-wrap">
                  {#each chars as char}
                    <div class="w-20 h-28 rounded-lg border-2 flex flex-col items-center overflow-hidden
                      {RARITY_COLORS[char.rarity]} {ROLE_COLORS[char.role]}">
                      <SpritePreview sprites={char.sprites} fallback={ROLE_ICONS[char.role]} class="w-14 h-14 mt-0.5" />
                      <span class="text-[8px] font-bold truncate w-full text-center px-0.5">{char.name}</span>
                      <span class="text-[7px] capitalize text-gray-400">{char.role}</span>
                    </div>
                  {/each}
                </div>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  @keyframes fadeInScale {
    0% { opacity: 0; transform: scale(0.5); }
    100% { opacity: 1; transform: scale(1); }
  }
</style>
