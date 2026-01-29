<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Role, SpriteSet, SpriteSource, SpriteSheetConfig, AnimState, HitEffect } from '../game/types';

  interface Props {
    name: string;
    role: Role;
    currentHp: number;
    maxHp: number;
    isAlive: boolean;
    isPlayer: boolean;
    sprites?: SpriteSet;
    animState?: AnimState;
    hitEffect?: HitEffect;
    isBoss?: boolean;
  }

  let { name, role, currentHp, maxHp, isAlive, isPlayer, sprites, animState = 'idle', hitEffect, isBoss = false }: Props = $props();

  /** Cell size in px — bosses get 3x the space */
  let cellSize = $derived(isBoss ? 264 : 88);

  const roleColors: Record<Role, string> = {
    tank: 'bg-blue-600',
    warrior: 'bg-red-600',
    archer: 'bg-green-600',
    mage: 'bg-purple-600',
    assassin: 'bg-gray-700',
    healer: 'bg-yellow-600',
    summoner: 'bg-teal-600',
  };

  const roleIcons: Record<Role, string> = {
    tank: 'T',
    warrior: 'W',
    archer: 'A',
    mage: 'M',
    assassin: 'X',
    healer: 'H',
    summoner: 'S',
  };

  let hpPercent = $derived(Math.max(0, (currentHp / maxHp) * 100));
  let hpColor = $derived(
    hpPercent > 50 ? 'bg-green-500' : hpPercent > 25 ? 'bg-yellow-500' : 'bg-red-500'
  );

  /** Check if a SpriteSource is a sprite sheet config */
  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  /** Resolve the sprite source for the current animation state, falling back idle → undefined */
  let spriteSource = $derived<SpriteSource | undefined>(
    sprites
      ? (sprites[animState] ?? sprites.idle ?? undefined)
      : undefined
  );

  /** Is the resolved sprite a sheet? */
  let sourceIsSheet = $derived(isSheet(spriteSource));

  /** Static image URL (only if not a sheet) */
  let staticSrc = $derived(
    spriteSource && !sourceIsSheet ? (spriteSource as string) : undefined
  );

  /** Sheet config (only if is a sheet) */
  let sheetConfig = $derived(
    sourceIsSheet ? (spriteSource as SpriteSheetConfig) : undefined
  );

  /** Has any sprite (static or sheet) */
  let hasSprite = $derived(spriteSource !== undefined);

  /** Sprite zoom scale (zooms content inside fixed-size cell) */
  let spriteZoom = $derived(sprites?.spriteScale ?? 1);

  /** CSS filter effect per animation state */
  let animClass = $derived(
    animState === 'attack' ? 'scale-110 brightness-125' :
    animState === 'castAbility' ? 'scale-105 hue-rotate-30' :
    animState === 'death' ? 'rotate-12 brightness-50' :
    ''
  );

  /** Hit effect overlay color */
  let hitOverlayClass = $derived(
    hitEffect === 'damage' ? 'hit-flash-damage' :
    hitEffect === 'heal' ? 'hit-flash-heal' :
    ''
  );

  // --- Sprite sheet animation ---
  let currentFrame = $state(0);
  let frameTimer: ReturnType<typeof setInterval> | null = null;

  // Plain (non-reactive) flag — invisible to Svelte's $effect tracking,
  // so it won't cause re-runs but reliably prevents death anim restart.
  let deathAnimClaimed = false;

  function startFrameAnimation(cfg: SpriteSheetConfig, isDeath: boolean) {
    clearFrameTimer();
    currentFrame = 0;
    const duration = sprites?.frameDuration ?? 150;

    if (isDeath) {
      // Death: play through once, then hold the last frame
      frameTimer = setInterval(() => {
        if (currentFrame < cfg.frameCount - 1) {
          currentFrame++;
        } else {
          // Reached last frame — hold it permanently
          clearFrameTimer();
        }
      }, duration);
    } else {
      // Normal: loop
      frameTimer = setInterval(() => {
        currentFrame = (currentFrame + 1) % cfg.frameCount;
      }, duration);
    }
  }

  function clearFrameTimer() {
    if (frameTimer) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
  }

  // Watch for sheet config / animState changes
  $effect(() => {
    if (sheetConfig) {
      const isDeath = animState === 'death';
      if (isDeath && deathAnimClaimed) return; // Already started death, don't restart
      if (isDeath) deathAnimClaimed = true;
      else deathAnimClaimed = false;
      startFrameAnimation(sheetConfig, isDeath);
    } else {
      deathAnimClaimed = false;
      clearFrameTimer();
      currentFrame = 0;
    }
  });

  onDestroy(() => {
    clearFrameTimer();
  });

</script>

{#if hasSprite}
  <!-- Sprite layout: image dominant, info strip below -->
  <div class="flex flex-col items-center {isAlive ? '' : 'opacity-30 grayscale'}">
    <div class="relative rounded-lg border-2 overflow-hidden bg-slate-900
      {isPlayer ? 'border-blue-400' : 'border-red-400'}
      {isBoss ? 'border-4 border-red-600' : ''}"
      style="width: {cellSize}px; height: {cellSize}px;">
      {#if hitOverlayClass}
        <div class="absolute inset-0 z-10 pointer-events-none rounded-lg {hitOverlayClass}"></div>
      {/if}
      {#if sheetConfig}
        <!-- Animated sprite sheet: scale sheet so one frame fills the container, apply zoom -->
        {@const baseScale = cellSize / sheetConfig.frameWidth}
        {@const scale = baseScale * spriteZoom}
        {@const totalCols = sheetConfig.framesPerRow}
        {@const totalRows = Math.ceil(sheetConfig.frameCount / sheetConfig.framesPerRow)}
        {@const scaledW = totalCols * sheetConfig.frameWidth * scale}
        {@const scaledH = totalRows * sheetConfig.frameHeight * scale}
        {@const col = currentFrame % sheetConfig.framesPerRow}
        {@const row = Math.floor(currentFrame / sheetConfig.framesPerRow)}
        {@const posX = col * sheetConfig.frameWidth * scale}
        {@const posY = row * sheetConfig.frameHeight * scale}
        {@const offsetX = (cellSize - sheetConfig.frameWidth * scale) / 2}
        {@const offsetY = (cellSize - sheetConfig.frameHeight * scale) / 2}
        <div
          class="w-full h-full transition-transform duration-200 {animClass}"
          style="background-image: url({sheetConfig.src}); background-size: {scaledW}px {scaledH}px; background-position: {offsetX - posX}px {offsetY - posY}px;"
        ></div>
      {:else if staticSrc}
        <!-- Static image with zoom -->
        <img
          src={staticSrc}
          alt={name}
          class="w-full h-full object-contain transition-all duration-200 {animClass}"
          style="transform: scale({spriteZoom})"
        />
      {/if}
    </div>
    <div style="width: {isBoss ? cellSize : 96}px" class="-mt-0.5">
      <div class="text-center font-bold truncate leading-tight {isBoss ? 'text-base text-red-300' : 'text-[11px]'}">
        {#if isBoss}<span class="text-red-500">BOSS </span>{/if}{name}
      </div>
      <div class="bg-gray-900 rounded-full overflow-hidden mx-0.5 {isBoss ? 'h-3' : 'h-1.5'}">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
      <div class="text-center text-gray-300 leading-tight {isBoss ? 'text-sm' : 'text-[10px]'}">{currentHp}/{maxHp}</div>
    </div>
  </div>
{:else}
  <!-- No-sprite layout: role icon card (enlarged) -->
  <div
    class="relative w-24 h-28 rounded-lg border-2 transition-all duration-200
      {isPlayer ? 'border-blue-400' : 'border-red-400'}
      {roleColors[role]}
      {isAlive ? 'opacity-100' : 'opacity-30 grayscale'}"
  >
    {#if hitOverlayClass}
      <div class="absolute inset-0 z-10 pointer-events-none rounded-lg {hitOverlayClass}"></div>
    {/if}
    <div class="absolute top-0.5 left-0 right-0 text-center text-xs font-bold truncate px-1">
      {name}
    </div>

    <div class="absolute top-6 left-0 right-0 text-center text-3xl font-bold">
      {roleIcons[role]}
    </div>

    <div class="absolute bottom-7 left-1 right-1">
      <div class="h-2.5 bg-gray-900 rounded-full overflow-hidden">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
    </div>

    <div class="absolute bottom-1 left-0 right-0 text-center text-xs">
      {currentHp}/{maxHp}
    </div>
  </div>
{/if}

<style>
  .hit-flash-damage {
    animation: flash-red 0.4s ease-out;
  }
  .hit-flash-heal {
    animation: flash-green 0.4s ease-out;
  }

  @keyframes flash-red {
    0% { background-color: rgba(239, 68, 68, 0.7); }
    100% { background-color: transparent; }
  }
  @keyframes flash-green {
    0% { background-color: rgba(34, 197, 94, 0.7); }
    100% { background-color: transparent; }
  }
</style>
