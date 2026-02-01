<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Role, SpriteSet, SpriteSource, SpriteSheetConfig, AnimState, HitEffect, DisplaySize } from '../game/types';
  import { DISPLAY_SIZE_PX } from '../game/types';

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
    displaySize?: DisplaySize;
    abilityOverlay?: SpriteSource;
  }

  let { name, role, currentHp, maxHp, isAlive, isPlayer, sprites, animState = 'idle', hitEffect, isBoss = false, displaySize = 'medium', abilityOverlay }: Props = $props();

  /** Resolve cell size from displaySize, falling back to isBoss for backward compat */
  let cellSize = $derived(
    displaySize !== 'medium'
      ? DISPLAY_SIZE_PX[displaySize]
      : isBoss
        ? DISPLAY_SIZE_PX.xlarge
        : DISPLAY_SIZE_PX.medium
  );

  let isLarge = $derived(displaySize === 'large' || displaySize === 'xlarge' || isBoss);

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
    clearOverlayTimer();
  });

  // --- Ability overlay animation ---
  let overlayIsSheet = $derived(isSheet(abilityOverlay));
  let overlaySheetConfig = $derived(overlayIsSheet ? (abilityOverlay as SpriteSheetConfig) : undefined);
  let overlayStaticSrc = $derived(abilityOverlay && !overlayIsSheet ? (abilityOverlay as string) : undefined);

  let overlayFrame = $state(0);
  let overlayTimer: ReturnType<typeof setInterval> | null = null;

  function clearOverlayTimer() {
    if (overlayTimer) { clearInterval(overlayTimer); overlayTimer = null; }
  }

  $effect(() => {
    if (overlaySheetConfig) {
      clearOverlayTimer();
      overlayFrame = 0;
      const dur = overlaySheetConfig.frameCount > 1 ? 100 : 150;
      overlayTimer = setInterval(() => {
        overlayFrame = (overlayFrame + 1) % overlaySheetConfig!.frameCount;
      }, dur);
    } else {
      clearOverlayTimer();
      overlayFrame = 0;
    }
  });

</script>

{#if hasSprite}
  <!-- Sprite layout: floating sprite with subtle info underneath -->
  <div class="flex flex-col items-center {isAlive ? '' : 'opacity-30 grayscale'}">
    <div class="relative overflow-visible"
      style="width: {cellSize}px; height: {cellSize}px;">
      {#if hitOverlayClass}
        <div class="absolute inset-0 z-10 pointer-events-none rounded-full {hitOverlayClass}"></div>
      {/if}
      {#if overlaySheetConfig}
        {@const oCfg = overlaySheetConfig}
        {@const oScale = cellSize / oCfg.frameWidth}
        {@const oTotalCols = oCfg.framesPerRow}
        {@const oTotalRows = Math.ceil(oCfg.frameCount / oCfg.framesPerRow)}
        {@const oScaledW = oTotalCols * oCfg.frameWidth * oScale}
        {@const oScaledH = oTotalRows * oCfg.frameHeight * oScale}
        {@const oCol = overlayFrame % oCfg.framesPerRow}
        {@const oRow = Math.floor(overlayFrame / oCfg.framesPerRow)}
        {@const oPosX = oCol * oCfg.frameWidth * oScale}
        {@const oPosY = oRow * oCfg.frameHeight * oScale}
        {@const oOffX = (cellSize - oCfg.frameWidth * oScale) / 2}
        {@const oOffY = (cellSize - oCfg.frameHeight * oScale) / 2}
        <div
          class="absolute inset-0 z-20 pointer-events-none opacity-80"
          style="background-image: url({oCfg.src}); background-size: {oScaledW}px {oScaledH}px; background-position: {oOffX - oPosX}px {oOffY - oPosY}px;"
        ></div>
      {:else if overlayStaticSrc}
        <div class="absolute inset-0 z-20 pointer-events-none flex items-center justify-center opacity-80">
          <img src={overlayStaticSrc} alt="ability" class="w-full h-full object-contain" />
        </div>
      {/if}
      {#if sheetConfig}
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
          style="background-image: url({sheetConfig.src}); background-size: {scaledW}px {scaledH}px; background-position: {offsetX - posX}px {offsetY - posY}px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));"
        ></div>
      {:else if staticSrc}
        <img
          src={staticSrc}
          alt={name}
          class="w-full h-full object-contain transition-all duration-200 {animClass}"
          style="transform: scale({spriteZoom}); filter: drop-shadow(0 2px 6px rgba(0,0,0,0.6));"
        />
      {/if}
    </div>
    <!-- Info bar: name + HP -->
    <div style="width: {Math.max(cellSize, 72)}px" class="mt-0.5">
      <div class="text-center font-bold truncate leading-tight {isLarge ? 'text-sm text-red-300' : 'text-[10px] text-gray-200'}">
        {#if isBoss}<span class="text-red-500 mr-0.5">BOSS</span>{/if}{name}
      </div>
      <div class="bg-black/60 rounded-full overflow-hidden mx-auto {isLarge ? 'h-2.5' : 'h-1.5'}" style="width: {Math.min(cellSize, 96)}px;">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
      <div class="text-center text-gray-400 leading-tight {isLarge ? 'text-xs' : 'text-[9px]'}">{currentHp}/{maxHp}</div>
    </div>
  </div>
{:else}
  <!-- No-sprite layout: role icon floating -->
  <div class="flex flex-col items-center {isAlive ? '' : 'opacity-30 grayscale'}">
    <div
      class="relative flex items-center justify-center rounded-full transition-all duration-200
        {roleColors[role]}"
      style="width: {cellSize}px; height: {cellSize}px; filter: drop-shadow(0 2px 8px rgba(0,0,0,0.5));"
    >
      {#if hitOverlayClass}
        <div class="absolute inset-0 z-10 pointer-events-none rounded-full {hitOverlayClass}"></div>
      {/if}
      {#if overlayStaticSrc}
        <div class="absolute inset-0 z-20 pointer-events-none flex items-center justify-center opacity-80">
          <img src={overlayStaticSrc} alt="ability" class="w-full h-full object-contain" />
        </div>
      {/if}
      <span class="text-2xl font-bold text-white/90">{roleIcons[role]}</span>
    </div>
    <div style="width: {Math.max(cellSize, 72)}px" class="mt-0.5">
      <div class="text-center font-bold truncate leading-tight text-[10px] text-gray-200">{name}</div>
      <div class="bg-black/60 rounded-full overflow-hidden mx-auto h-1.5" style="width: {Math.min(cellSize, 96)}px;">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
      <div class="text-center text-gray-400 leading-tight text-[9px]">{currentHp}/{maxHp}</div>
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
