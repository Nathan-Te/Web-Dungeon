<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { Role, SpriteSet, SpriteSource, SpriteSheetConfig, AnimState } from '../game/types';

  interface Props {
    name: string;
    role: Role;
    currentHp: number;
    maxHp: number;
    isAlive: boolean;
    isPlayer: boolean;
    sprites?: SpriteSet;
    animState?: AnimState;
  }

  let { name, role, currentHp, maxHp, isAlive, isPlayer, sprites, animState = 'idle' }: Props = $props();

  const roleColors: Record<Role, string> = {
    tank: 'bg-blue-600',
    warrior: 'bg-red-600',
    archer: 'bg-green-600',
    mage: 'bg-purple-600',
    assassin: 'bg-gray-700',
    healer: 'bg-yellow-600',
  };

  const roleIcons: Record<Role, string> = {
    tank: 'T',
    warrior: 'W',
    archer: 'A',
    mage: 'M',
    assassin: 'X',
    healer: 'H',
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

  /** CSS filter effect per animation state */
  let animClass = $derived(
    animState === 'attack' ? 'scale-110 brightness-125' :
    animState === 'castAbility' ? 'scale-105 hue-rotate-30' :
    animState === 'death' ? 'rotate-12 brightness-50' :
    ''
  );

  // --- Sprite sheet animation ---
  let currentFrame = $state(0);
  let frameTimer: ReturnType<typeof setInterval> | null = null;
  let holdingLastFrame = $state(false);

  function startFrameAnimation(cfg: SpriteSheetConfig, isDeath: boolean) {
    stopFrameAnimation();
    currentFrame = 0;
    holdingLastFrame = false;
    const duration = sprites?.frameDuration ?? 150;

    if (isDeath) {
      // Death: play through once, then hold the last frame
      frameTimer = setInterval(() => {
        if (currentFrame < cfg.frameCount - 1) {
          currentFrame++;
        } else {
          // Reached last frame — hold it
          holdingLastFrame = true;
          if (frameTimer) {
            clearInterval(frameTimer);
            frameTimer = null;
          }
        }
      }, duration);
    } else {
      // Normal: loop
      frameTimer = setInterval(() => {
        currentFrame = (currentFrame + 1) % cfg.frameCount;
      }, duration);
    }
  }

  function stopFrameAnimation() {
    if (frameTimer) {
      clearInterval(frameTimer);
      frameTimer = null;
    }
    currentFrame = 0;
    holdingLastFrame = false;
  }

  // Watch for sheet config changes
  $effect(() => {
    if (sheetConfig) {
      startFrameAnimation(sheetConfig, animState === 'death');
    } else {
      stopFrameAnimation();
    }
  });

  onDestroy(() => {
    stopFrameAnimation();
  });

</script>

{#if hasSprite}
  <!-- Sprite layout: image dominant, info strip below -->
  <div class="flex flex-col items-center {isAlive ? '' : 'opacity-30 grayscale'}">
    <div class="w-[5.5rem] h-[5.5rem] rounded-lg border-2 overflow-hidden bg-slate-900
      {isPlayer ? 'border-blue-400' : 'border-red-400'}">
      {#if sheetConfig}
        <!-- Animated sprite sheet: scale sheet so one frame fills the container -->
        {@const scale = 88 / sheetConfig.frameWidth}
        {@const totalCols = sheetConfig.framesPerRow}
        {@const totalRows = Math.ceil(sheetConfig.frameCount / sheetConfig.framesPerRow)}
        {@const scaledW = totalCols * sheetConfig.frameWidth * scale}
        {@const scaledH = totalRows * sheetConfig.frameHeight * scale}
        {@const col = currentFrame % sheetConfig.framesPerRow}
        {@const row = Math.floor(currentFrame / sheetConfig.framesPerRow)}
        {@const posX = col * sheetConfig.frameWidth * scale}
        {@const posY = row * sheetConfig.frameHeight * scale}
        <div
          class="w-full h-full transition-transform duration-200 {animClass}"
          style="background-image: url({sheetConfig.src}); background-size: {scaledW}px {scaledH}px; background-position: -{posX}px -{posY}px;"
        ></div>
      {:else if staticSrc}
        <!-- Static image -->
        <img
          src={staticSrc}
          alt={name}
          class="w-full h-full object-contain transition-all duration-200 {animClass}"
        />
      {/if}
    </div>
    <div class="w-24 -mt-0.5">
      <div class="text-center text-[11px] font-bold truncate leading-tight">{name}</div>
      <div class="h-1.5 bg-gray-900 rounded-full overflow-hidden mx-0.5">
        <div class="h-full transition-all duration-300 {hpColor}" style="width: {hpPercent}%"></div>
      </div>
      <div class="text-center text-[10px] text-gray-300 leading-tight">{currentHp}/{maxHp}</div>
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
