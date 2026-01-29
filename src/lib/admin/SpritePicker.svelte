<script lang="ts">
  import type { SpriteSet, AnimState } from '../game/types';

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

  let activeSlot: AnimState = $state('idle');
  let urlInputs: Record<AnimState, string> = $state({ idle: '', attack: '', castAbility: '', death: '' });

  function getSlotSrc(slot: AnimState): string | undefined {
    return sprites?.[slot];
  }

  function setSlotValue(slot: AnimState, value: string | undefined) {
    const updated: SpriteSet = { ...(sprites ?? {}) };
    if (value) {
      updated[slot] = value;
    } else {
      delete updated[slot];
    }
    // If all empty, set to undefined
    if (!updated.idle && !updated.attack && !updated.castAbility && !updated.death) {
      onUpdate(undefined);
    } else {
      onUpdate(updated);
    }
  }

  function handleFileUpload(e: Event, slot: AnimState) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 256 * 1024) {
      alert('Image too large. Max 256KB. Use a smaller image or paste a URL instead.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setSlotValue(slot, reader.result as string);
      urlInputs[slot] = '';
    };
    reader.readAsDataURL(file);
  }

  function handleUrlChange(slot: AnimState) {
    const url = urlInputs[slot].trim();
    setSlotValue(slot, url || undefined);
  }

  function clearSlot(slot: AnimState) {
    setSlotValue(slot, undefined);
    urlInputs[slot] = '';
  }

  function clearAll() {
    onUpdate(undefined);
    urlInputs = { idle: '', attack: '', castAbility: '', death: '' };
  }

  /** Copy idle sprite to all empty slots */
  function fillFromIdle() {
    const idleSrc = sprites?.idle;
    if (!idleSrc) return;
    const updated: SpriteSet = { ...(sprites ?? {}) };
    if (!updated.attack) updated.attack = idleSrc;
    if (!updated.castAbility) updated.castAbility = idleSrc;
    if (!updated.death) updated.death = idleSrc;
    onUpdate(updated);
  }
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
      {@const src = getSlotSrc(slot.key)}
      <button
        onclick={() => (activeSlot = slot.key)}
        class="flex flex-col items-center gap-0.5 p-1 rounded transition-colors
          {activeSlot === slot.key ? 'bg-slate-700 ring-1 ring-slate-500' : 'hover:bg-slate-800'}"
      >
        <div class="w-14 h-14 rounded border-2 overflow-hidden bg-slate-900 flex items-center justify-center {slot.color}">
          {#if src}
            <img {src} alt={slot.label} class="w-full h-full object-contain" />
          {:else}
            <span class="text-[10px] text-gray-600">empty</span>
          {/if}
        </div>
        <span class="text-[10px] {activeSlot === slot.key ? 'text-white font-bold' : 'text-gray-400'}">
          {slot.label}
        </span>
      </button>
    {/each}
  </div>

  <!-- Active slot editor -->
  <div class="bg-slate-800 rounded p-2 space-y-2">
    <div class="flex items-center justify-between">
      <span class="text-xs font-medium capitalize">{activeSlot} sprite</span>
      {#if getSlotSrc(activeSlot)}
        <button onclick={() => clearSlot(activeSlot)} class="px-2 py-0.5 text-[10px] bg-red-900 hover:bg-red-800 rounded">
          Remove
        </button>
      {/if}
    </div>

    <!-- URL input -->
    <input
      type="text"
      bind:value={urlInputs[activeSlot]}
      placeholder="Image URL (https://...)"
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
    <span class="text-xs text-gray-600">Max 256KB per file. Supports PNG, JPEG, GIF, WebP, SVG.</span>
  </div>
</div>
