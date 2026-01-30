<script lang="ts">
  import type { SpriteSource, SpriteSheetConfig } from '../game/types';

  interface Props {
    label: string;
    value: SpriteSource | undefined;
    onUpdate: (value: SpriteSource | undefined) => void;
  }

  let { label, value, onUpdate }: Props = $props();

  const DEFAULT_FRAME_WIDTH = 256;
  const DEFAULT_FRAME_HEIGHT = 256;
  const DEFAULT_FRAME_COUNT = 8;
  const DEFAULT_FRAMES_PER_ROW = 8;

  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  let urlInput = $state('');
  let sheetMode = $state(false);
  let sheetInputs = $state({
    frameWidth: DEFAULT_FRAME_WIDTH,
    frameHeight: DEFAULT_FRAME_HEIGHT,
    frameCount: DEFAULT_FRAME_COUNT,
    framesPerRow: DEFAULT_FRAMES_PER_ROW,
  });

  // Initialize from existing value
  $effect(() => {
    if (isSheet(value)) {
      sheetMode = true;
      sheetInputs = {
        frameWidth: value.frameWidth,
        frameHeight: value.frameHeight,
        frameCount: value.frameCount,
        framesPerRow: value.framesPerRow,
      };
      if (!value.src.startsWith('data:')) {
        urlInput = value.src;
      }
    } else if (typeof value === 'string') {
      sheetMode = false;
      if (!value.startsWith('data:')) {
        urlInput = value;
      }
    }
  });

  function getPreviewSrc(): string | undefined {
    if (!value) return undefined;
    return isSheet(value) ? value.src : value;
  }

  function handleUrlChange() {
    const url = urlInput.trim();
    if (!url) {
      onUpdate(undefined);
      return;
    }
    if (sheetMode) {
      onUpdate({
        src: url,
        frameWidth: sheetInputs.frameWidth,
        frameHeight: sheetInputs.frameHeight,
        frameCount: sheetInputs.frameCount,
        framesPerRow: sheetInputs.framesPerRow,
      });
    } else {
      onUpdate(url);
    }
  }

  function handleFileUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const maxSize = sheetMode ? 2 * 1024 * 1024 : 256 * 1024;
    if (file.size > maxSize) {
      alert(`Image too large. Max ${sheetMode ? '2MB' : '256KB'}.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      if (sheetMode) {
        onUpdate({
          src: dataUrl,
          frameWidth: sheetInputs.frameWidth,
          frameHeight: sheetInputs.frameHeight,
          frameCount: sheetInputs.frameCount,
          framesPerRow: sheetInputs.framesPerRow,
        });
      } else {
        onUpdate(dataUrl);
      }
      urlInput = '';
    };
    reader.readAsDataURL(file);
  }

  function toggleSheetMode() {
    sheetMode = !sheetMode;
    if (value) {
      if (sheetMode && typeof value === 'string') {
        onUpdate({
          src: value,
          frameWidth: sheetInputs.frameWidth,
          frameHeight: sheetInputs.frameHeight,
          frameCount: sheetInputs.frameCount,
          framesPerRow: sheetInputs.framesPerRow,
        });
      } else if (!sheetMode && isSheet(value)) {
        onUpdate(value.src);
        urlInput = value.src.startsWith('data:') ? '' : value.src;
      }
    }
  }

  function updateSheetConfig() {
    if (!value) return;
    const imgSrc = isSheet(value) ? value.src : (typeof value === 'string' ? value : '');
    if (!imgSrc) return;
    onUpdate({
      src: imgSrc,
      frameWidth: sheetInputs.frameWidth,
      frameHeight: sheetInputs.frameHeight,
      frameCount: sheetInputs.frameCount,
      framesPerRow: sheetInputs.framesPerRow,
    });
  }

  function clearSprite() {
    onUpdate(undefined);
    urlInput = '';
    sheetMode = false;
  }

  let previewSrc = $derived(getPreviewSrc());
  let isSheetValue = $derived(isSheet(value));
</script>

<div class="space-y-2">
  <div class="flex items-center justify-between">
    <span class="text-xs text-gray-400 font-bold">{label}</span>
    <div class="flex gap-1 items-center">
      <button
        onclick={toggleSheetMode}
        class="px-2 py-0.5 text-[10px] rounded
          {sheetMode ? 'bg-yellow-700 hover:bg-yellow-600 text-yellow-100' : 'bg-slate-700 hover:bg-slate-600 text-gray-300'}"
      >
        {sheetMode ? 'Sheet' : 'Static'}
      </button>
      {#if value}
        <button onclick={clearSprite} class="px-2 py-0.5 text-[10px] bg-red-900 hover:bg-red-800 rounded">
          Remove
        </button>
      {/if}
    </div>
  </div>

  <!-- Preview -->
  {#if previewSrc}
    <div class="flex items-center gap-2">
      <div class="w-14 h-14 rounded border-2 overflow-hidden bg-slate-900 flex items-center justify-center border-indigo-600">
        {#if isSheetValue}
          {@const cfg = value as SpriteSheetConfig}
          <div
            class="w-full h-full"
            style="background-image: url({cfg.src}); background-size: {cfg.framesPerRow * 100}% auto; background-position: 0% 0%;"
          ></div>
        {:else}
          <img src={previewSrc} alt={label} class="w-full h-full object-contain" />
        {/if}
      </div>
      {#if isSheetValue}
        <span class="text-[10px] text-yellow-400">Sprite Sheet</span>
      {:else}
        <span class="text-[10px] text-gray-500">Static image</span>
      {/if}
    </div>
  {/if}

  <!-- URL input -->
  <input
    type="text"
    bind:value={urlInput}
    placeholder="{sheetMode ? 'Sprite sheet' : 'Image'} URL (https://...)"
    class="w-full px-3 py-1.5 bg-slate-700 rounded text-xs"
    onblur={handleUrlChange}
    onkeydown={(e) => { if (e.key === 'Enter') handleUrlChange(); }}
  />

  <!-- File upload -->
  <input
    type="file"
    accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
    onchange={handleFileUpload}
    class="block w-full text-xs text-gray-400
      file:mr-2 file:py-1 file:px-3
      file:rounded file:border-0
      file:text-xs file:font-medium
      file:bg-slate-700 file:text-gray-300
      hover:file:bg-slate-600"
  />
  <span class="text-[10px] text-gray-600">
    Max {sheetMode ? '2MB' : '256KB'}. PNG, JPEG, GIF, WebP, SVG.
  </span>

  <!-- Sprite sheet config -->
  {#if sheetMode}
    <div class="border-t border-slate-700 pt-2 mt-1">
      <span class="text-xs text-yellow-400 font-bold block mb-1">Sprite Sheet Config</span>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <span class="text-[10px] text-gray-500">Frame W (px)</span>
          <input type="number" min="1" max="2048"
            bind:value={sheetInputs.frameWidth}
            onchange={updateSheetConfig}
            class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
        </div>
        <div>
          <span class="text-[10px] text-gray-500">Frame H (px)</span>
          <input type="number" min="1" max="2048"
            bind:value={sheetInputs.frameHeight}
            onchange={updateSheetConfig}
            class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
        </div>
        <div>
          <span class="text-[10px] text-gray-500">Frame Count</span>
          <input type="number" min="1" max="128"
            bind:value={sheetInputs.frameCount}
            onchange={updateSheetConfig}
            class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
        </div>
        <div>
          <span class="text-[10px] text-gray-500">Frames/Row</span>
          <input type="number" min="1" max="128"
            bind:value={sheetInputs.framesPerRow}
            onchange={updateSheetConfig}
            class="w-full px-2 py-1 bg-slate-700 rounded text-xs" />
        </div>
      </div>
      <p class="text-[10px] text-gray-600 mt-1">
        Default: 8 frames of 256x256px on a single row.
      </p>
    </div>
  {/if}
</div>
