<script lang="ts">
  interface Props {
    sprite: string | undefined;
    onUpdate: (sprite: string | undefined) => void;
  }

  let { sprite, onUpdate }: Props = $props();

  let urlInput = $state('');

  function handleFileUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    // Limit to 256KB for localStorage
    if (file.size > 256 * 1024) {
      alert('Image too large. Max 256KB. Use a smaller image or paste a URL instead.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      onUpdate(result);
      urlInput = '';
    };
    reader.readAsDataURL(file);
  }

  function handleUrlChange() {
    const url = urlInput.trim();
    if (url) {
      onUpdate(url);
    } else {
      onUpdate(undefined);
    }
  }

  function clearSprite() {
    onUpdate(undefined);
    urlInput = '';
  }
</script>

<div class="space-y-2">
  <span class="block text-xs text-gray-400 mb-1">Sprite</span>

  <!-- Preview -->
  {#if sprite}
    <div class="flex items-center gap-3">
      <div class="w-16 h-16 rounded border border-slate-600 overflow-hidden bg-slate-900 flex items-center justify-center">
        <img src={sprite} alt="sprite" class="w-full h-full object-contain" />
      </div>
      <button
        onclick={clearSprite}
        class="px-2 py-1 text-xs bg-red-900 hover:bg-red-800 rounded"
      >
        Remove
      </button>
    </div>
  {/if}

  <!-- URL input -->
  <div class="flex gap-2">
    <input
      type="text"
      bind:value={urlInput}
      placeholder="Image URL (https://...)"
      class="flex-1 px-3 py-1.5 bg-slate-700 rounded text-xs"
      onblur={handleUrlChange}
      onkeydown={(e) => { if (e.key === 'Enter') handleUrlChange(); }}
    />
  </div>

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
  <span class="text-xs text-gray-600">Max 256KB for file upload. URL has no limit.</span>
</div>
