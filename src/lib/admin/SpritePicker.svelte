<script lang="ts">
  import type { SpriteSet, SpriteSource, SpriteSheetConfig, AnimState } from '../game/types';

  interface Props {
    sprites: SpriteSet | undefined;
    onUpdate: (sprites: SpriteSet | undefined) => void;
  }

  let { sprites, onUpdate }: Props = $props();

  const SLOTS: { key: AnimState; label: string; color: string }[] = [
    { key: 'idle', label: 'Idle', color: 'border-green-600' },
    { key: 'attack', label: 'Attack', color: 'border-orange-600' },
    { key: 'castAbility', label: 'Ability', color: 'border-purple-600' },
    { key: 'death', label: 'Death', color: 'border-red-600' },
  ];

  const DEFAULT_FRAME_WIDTH = 256;
  const DEFAULT_FRAME_HEIGHT = 256;
  const DEFAULT_FRAME_COUNT = 8;
  const DEFAULT_FRAMES_PER_ROW = 8;
  const DEFAULT_FRAME_DURATION = 150;

  let activeSlot: AnimState = $state('idle');
  let urlInputs: Record<AnimState, string> = $state({ idle: '', attack: '', castAbility: '', death: '' });

  /** Whether the active slot is in sprite-sheet mode */
  let sheetMode: Record<AnimState, boolean> = $state({ idle: false, attack: false, castAbility: false, death: false });

  /** Sprite sheet config inputs per slot */
  let sheetInputs: Record<AnimState, { frameWidth: number; frameHeight: number; frameCount: number; framesPerRow: number }> = $state({
    idle: { frameWidth: DEFAULT_FRAME_WIDTH, frameHeight: DEFAULT_FRAME_HEIGHT, frameCount: DEFAULT_FRAME_COUNT, framesPerRow: DEFAULT_FRAMES_PER_ROW },
    attack: { frameWidth: DEFAULT_FRAME_WIDTH, frameHeight: DEFAULT_FRAME_HEIGHT, frameCount: DEFAULT_FRAME_COUNT, framesPerRow: DEFAULT_FRAMES_PER_ROW },
    castAbility: { frameWidth: DEFAULT_FRAME_WIDTH, frameHeight: DEFAULT_FRAME_HEIGHT, frameCount: DEFAULT_FRAME_COUNT, framesPerRow: DEFAULT_FRAMES_PER_ROW },
    death: { frameWidth: DEFAULT_FRAME_WIDTH, frameHeight: DEFAULT_FRAME_HEIGHT, frameCount: DEFAULT_FRAME_COUNT, framesPerRow: DEFAULT_FRAMES_PER_ROW },
  });

  const DEFAULT_SPRITE_SCALE = 1.0;

  /** Frame duration (global) */
  let frameDuration = $state(DEFAULT_FRAME_DURATION);
  /** Sprite display scale */
  let spriteScale = $state(DEFAULT_SPRITE_SCALE);

  // Sync frameDuration and spriteScale from props on mount
  $effect(() => {
    if (sprites?.frameDuration) {
      frameDuration = sprites.frameDuration;
    }
    if (sprites?.spriteScale) {
      spriteScale = sprites.spriteScale;
    }
  });

  /** Check if a SpriteSource is a sheet config */
  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  /** Get the preview image URL for a slot */
  function getSlotPreviewSrc(slot: AnimState): string | undefined {
    const src = sprites?.[slot];
    if (!src) return undefined;
    return isSheet(src) ? src.src : src;
  }

  /** Get the raw SpriteSource for a slot */
  function getSlotSource(slot: AnimState): SpriteSource | undefined {
    return sprites?.[slot];
  }

  function emitUpdate(updated: SpriteSet) {
    // If all slots empty, set to undefined
    if (!updated.idle && !updated.attack && !updated.castAbility && !updated.death) {
      onUpdate(undefined);
    } else {
      onUpdate(updated);
    }
  }

  function setSlotValue(slot: AnimState, value: SpriteSource | undefined) {
    const updated: SpriteSet = { ...(sprites ?? {}) };
    if (value) {
      updated[slot] = value;
    } else {
      delete updated[slot];
    }
    // Preserve global settings
    if (frameDuration !== DEFAULT_FRAME_DURATION) {
      updated.frameDuration = frameDuration;
    }
    if (spriteScale !== DEFAULT_SPRITE_SCALE) {
      updated.spriteScale = spriteScale;
    }
    emitUpdate(updated);
  }

  function handleFileUpload(e: Event, slot: AnimState) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const maxSize = sheetMode[slot] ? 2 * 1024 * 1024 : 256 * 1024;
    if (file.size > maxSize) {
      alert(`Image too large. Max ${sheetMode[slot] ? '2MB' : '256KB'}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (sheetMode[slot]) {
        const cfg = sheetInputs[slot];
        setSlotValue(slot, {
          src: dataUrl,
          frameWidth: cfg.frameWidth,
          frameHeight: cfg.frameHeight,
          frameCount: cfg.frameCount,
          framesPerRow: cfg.framesPerRow,
        });
      } else {
        setSlotValue(slot, dataUrl);
      }
      urlInputs[slot] = '';
    };
    reader.readAsDataURL(file);
  }

  function handleUrlChange(slot: AnimState) {
    const url = urlInputs[slot].trim();
    if (!url) {
      setSlotValue(slot, undefined);
      return;
    }
    if (sheetMode[slot]) {
      const cfg = sheetInputs[slot];
      setSlotValue(slot, {
        src: url,
        frameWidth: cfg.frameWidth,
        frameHeight: cfg.frameHeight,
        frameCount: cfg.frameCount,
        framesPerRow: cfg.framesPerRow,
      });
    } else {
      setSlotValue(slot, url);
    }
  }

  /** When toggling sheet mode, convert existing data */
  function toggleSheetMode(slot: AnimState) {
    const current = getSlotSource(slot);
    sheetMode[slot] = !sheetMode[slot];

    if (current) {
      if (sheetMode[slot] && typeof current === 'string') {
        // Convert static → sheet
        const cfg = sheetInputs[slot];
        setSlotValue(slot, {
          src: current,
          frameWidth: cfg.frameWidth,
          frameHeight: cfg.frameHeight,
          frameCount: cfg.frameCount,
          framesPerRow: cfg.framesPerRow,
        });
      } else if (!sheetMode[slot] && isSheet(current)) {
        // Convert sheet → static (keep just the src URL)
        setSlotValue(slot, current.src);
        urlInputs[slot] = current.src.startsWith('data:') ? '' : current.src;
      }
    }
  }

  /** Update sheet config for current slot and re-emit */
  function updateSheetConfig(slot: AnimState) {
    const current = getSlotSource(slot);
    if (!current) return;
    const imgSrc = isSheet(current) ? current.src : (typeof current === 'string' ? current : '');
    if (!imgSrc) return;
    const cfg = sheetInputs[slot];
    setSlotValue(slot, {
      src: imgSrc,
      frameWidth: cfg.frameWidth,
      frameHeight: cfg.frameHeight,
      frameCount: cfg.frameCount,
      framesPerRow: cfg.framesPerRow,
    });
  }

  function updateFrameDuration() {
    if (!sprites) return;
    const updated = { ...sprites, frameDuration: frameDuration };
    onUpdate(updated);
  }

  function updateSpriteScale() {
    if (!sprites) return;
    const updated = { ...sprites, spriteScale: spriteScale };
    if (spriteScale === DEFAULT_SPRITE_SCALE) {
      delete updated.spriteScale;
    }
    onUpdate(updated);
  }

  function clearSlot(slot: AnimState) {
    setSlotValue(slot, undefined);
    urlInputs[slot] = '';
    sheetMode[slot] = false;
  }

  function clearAll() {
    onUpdate(undefined);
    urlInputs = { idle: '', attack: '', castAbility: '', death: '' };
    sheetMode = { idle: false, attack: false, castAbility: false, death: false };
  }

  /** Copy idle sprite to all empty slots */
  function fillFromIdle() {
    const idleSrc = sprites?.idle;
    if (!idleSrc) return;
    const updated: SpriteSet = { ...(sprites ?? {}) };
    if (!updated.attack) updated.attack = idleSrc;
    if (!updated.castAbility) updated.castAbility = idleSrc;
    if (!updated.death) updated.death = idleSrc;
    if (frameDuration !== DEFAULT_FRAME_DURATION) {
      updated.frameDuration = frameDuration;
    }
    emitUpdate(updated);
    // Sync sheet mode flags for filled slots
    if (isSheet(idleSrc)) {
      if (!sprites?.attack) sheetMode.attack = true;
      if (!sprites?.castAbility) sheetMode.castAbility = true;
      if (!sprites?.death) sheetMode.death = true;
    }
  }

  // Initialize sheetMode from existing sprites on mount
  $effect(() => {
    for (const slot of SLOTS) {
      const src = sprites?.[slot.key];
      if (isSheet(src)) {
        sheetMode[slot.key] = true;
        sheetInputs[slot.key] = {
          frameWidth: src.frameWidth,
          frameHeight: src.frameHeight,
          frameCount: src.frameCount,
          framesPerRow: src.framesPerRow,
        };
      }
    }
  });
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <span class="block text-xs text-gray-400 font-bold">Sprites</span>
    <div class="flex gap-1">
      {#if sprites?.idle}
        <button onclick={fillFromIdle} class="px-2 py-0.5 text-[10px] bg-slate-700 hover:bg-slate-600 rounded">
          Fill empty from Idle
        </button>
      {/if}
      {#if sprites}
        <button onclick={clearAll} class="px-2 py-0.5 text-[10px] bg-red-900 hover:bg-red-800 rounded">
          Clear all
        </button>
      {/if}
    </div>
  </div>

  <!-- Slot previews row -->
  <div class="flex gap-2">
    {#each SLOTS as slot}
      {@const previewSrc = getSlotPreviewSrc(slot.key)}
      {@const slotIsSheet = isSheet(getSlotSource(slot.key))}
      <button
        onclick={() => (activeSlot = slot.key)}
        class="flex flex-col items-center gap-0.5 p-1 rounded transition-colors
          {activeSlot === slot.key ? 'bg-slate-700 ring-1 ring-slate-500' : 'hover:bg-slate-800'}"
      >
        <div class="w-14 h-14 rounded border-2 overflow-hidden bg-slate-900 flex items-center justify-center {slot.color}">
          {#if previewSrc}
            {#if slotIsSheet}
              <!-- Show first frame of sprite sheet -->
              {@const cfg = getSlotSource(slot.key) as SpriteSheetConfig}
              <div
                class="w-full h-full"
                style="background-image: url({cfg.src}); background-size: {cfg.framesPerRow * 100}% auto; background-position: 0% 0%;"
              ></div>
            {:else}
              <img src={previewSrc} alt={slot.label} class="w-full h-full object-contain" />
            {/if}
          {:else}
            <span class="text-[10px] text-gray-600">empty</span>
          {/if}
        </div>
        <span class="text-[10px] {activeSlot === slot.key ? 'text-white font-bold' : 'text-gray-400'}">
          {slot.label}
          {#if slotIsSheet}
            <span class="text-yellow-500">S</span>
          {/if}
        </span>
      </button>
    {/each}
  </div>

  <!-- Global frame duration -->
  {#if sprites && (isSheet(sprites.idle) || isSheet(sprites.attack) || isSheet(sprites.castAbility) || isSheet(sprites.death))}
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400">Anim speed:</span>
      <input
        type="number"
        min="50"
        max="1000"
        step="10"
        bind:value={frameDuration}
        onchange={updateFrameDuration}
        class="w-20 px-2 py-1 bg-slate-700 rounded text-xs"
      />
      <span class="text-xs text-gray-500">ms/frame</span>
    </div>
  {/if}

  <!-- Sprite scale -->
  {#if sprites}
    <div class="flex items-center gap-2">
      <span class="text-xs text-gray-400">Zoom:</span>
      <input
        type="range"
        min="0.5"
        max="3"
        step="0.1"
        bind:value={spriteScale}
        oninput={updateSpriteScale}
        class="flex-1 h-1 accent-blue-500"
      />
      <span class="text-xs text-gray-300 w-10 text-right">{spriteScale.toFixed(1)}x</span>
    </div>
  {/if}

  <!-- Active slot editor -->
  <div class="bg-slate-800 rounded p-2 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium capitalize">{activeSlot} sprite</span>
      <div class="flex gap-1 items-center">
        <!-- Sheet mode toggle -->
        <button
          onclick={() => toggleSheetMode(activeSlot)}
          class="px-2 py-0.5 text-[10px] rounded
            {sheetMode[activeSlot] ? 'bg-yellow-700 hover:bg-yellow-600 text-yellow-100' : 'bg-slate-700 hover:bg-slate-600 text-gray-300'}"
        >
          {sheetMode[activeSlot] ? 'Sheet' : 'Static'}
        </button>
        {#if getSlotPreviewSrc(activeSlot)}
          <button onclick={() => clearSlot(activeSlot)} class="px-2 py-0.5 text-[10px] bg-red-900 hover:bg-red-800 rounded">
            Remove
          </button>
        {/if}
      </div>
    </div>

    <!-- URL input -->
    <input
      type="text"
      bind:value={urlInputs[activeSlot]}
      placeholder="{sheetMode[activeSlot] ? 'Sprite sheet' : 'Image'} URL (https://...)"
      class="w-full px-3 py-1.5 bg-slate-700 rounded text-xs"
      onblur={() => handleUrlChange(activeSlot)}
      onkeydown={(e) => { if (e.key === 'Enter') handleUrlChange(activeSlot); }}
    />

    <!-- File upload -->
    <input
      type="file"
      accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
      onchange={(e) => handleFileUpload(e, activeSlot)}
      class="block w-full text-xs text-gray-400
        file:mr-2 file:py-1 file:px-3
        file:rounded file:border-0
        file:text-xs file:font-medium
        file:bg-slate-700 file:text-gray-300
        hover:file:bg-slate-600"
    />
    <span class="text-xs text-gray-600">
      Max {sheetMode[activeSlot] ? '2MB' : '256KB'}. Supports PNG, JPEG, GIF, WebP, SVG.
    </span>

    <!-- Sprite sheet config (only in sheet mode) -->
    {#if sheetMode[activeSlot]}
      <div class="border-t border-slate-700 pt-2 mt-1">
        <span class="text-xs text-yellow-400 font-bold block mb-1">Sprite Sheet Config</span>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <span class="text-[10px] text-gray-500">Frame W (px)</span>
            <input type="number" min="1" max="2048"
              bind:value={sheetInputs[activeSlot].frameWidth}
              onchange={() => updateSheetConfig(activeSlot)}
              class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
          </div>
          <div>
            <span class="text-[10px] text-gray-500">Frame H (px)</span>
            <input type="number" min="1" max="2048"
              bind:value={sheetInputs[activeSlot].frameHeight}
              onchange={() => updateSheetConfig(activeSlot)}
              class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
          </div>
          <div>
            <span class="text-[10px] text-gray-500">Frame Count</span>
            <input type="number" min="1" max="128"
              bind:value={sheetInputs[activeSlot].frameCount}
              onchange={() => updateSheetConfig(activeSlot)}
              class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
          </div>
          <div>
            <span class="text-[10px] text-gray-500">Frames/Row</span>
            <input type="number" min="1" max="128"
              bind:value={sheetInputs[activeSlot].framesPerRow}
              onchange={() => updateSheetConfig(activeSlot)}
              class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
          </div>
        </div>
        <p class="text-[10px] text-gray-600 mt-1">
          Default: 8 frames of 256x256px on a single row.
        </p>
      </div>
    {/if}
  </div>
</div>
