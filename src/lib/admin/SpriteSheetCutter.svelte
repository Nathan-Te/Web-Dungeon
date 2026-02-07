<script lang="ts">
  let fileInput: HTMLInputElement | undefined = $state(undefined);
  let sourceImage: HTMLImageElement | null = $state(null);
  let imageName = $state('');
  let imageWidth = $state(0);
  let imageHeight = $state(0);

  let totalRows = $state(2);
  let selectedRow = $state(1);

  let previewCanvas: HTMLCanvasElement | undefined = $state(undefined);

  // Result stored as blob URL (no DOM canvas needed)
  let resultUrl: string | null = $state(null);
  let resultWidth = $state(0);
  let resultHeight = $state(0);

  let rowHeight = $derived(imageHeight > 0 && totalRows > 0 ? Math.floor(imageHeight / totalRows) : 0);

  function handleFileUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    imageName = file.name.replace(/\.[^.]+$/, '');
    clearResult();

    const img = new Image();
    img.onload = () => {
      sourceImage = img;
      imageWidth = img.naturalWidth;
      imageHeight = img.naturalHeight;
      if (totalRows < 1) totalRows = 2;
      if (selectedRow > totalRows) selectedRow = 1;
      drawPreview();
    };
    img.src = URL.createObjectURL(file);
  }

  function drawPreview() {
    if (!previewCanvas || !sourceImage || rowHeight <= 0) return;

    const scale = Math.min(1, 500 / imageWidth);
    previewCanvas.width = Math.round(imageWidth * scale);
    previewCanvas.height = Math.round(imageHeight * scale);

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(sourceImage, 0, 0, previewCanvas.width, previewCanvas.height);

    // Row guide lines
    const scaledRowHeight = rowHeight * scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < totalRows; i++) {
      const y = Math.round(i * scaledRowHeight);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(previewCanvas.width, y);
      ctx.stroke();
    }

    // Highlight selected row
    const selectedY = Math.round((selectedRow - 1) * scaledRowHeight);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
    ctx.fillRect(0, selectedY, previewCanvas.width, scaledRowHeight);
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, selectedY, previewCanvas.width, scaledRowHeight);

    // Row number labels
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.font = `${Math.max(10, Math.round(12 * scale))}px monospace`;
    for (let i = 0; i < totalRows; i++) {
      const y = Math.round(i * scaledRowHeight) + Math.round(scaledRowHeight / 2) + 4;
      ctx.fillText(`${i + 1}`, 4, y);
    }
  }

  function clearResult() {
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = null;
  }

  function cutRow() {
    if (!sourceImage || rowHeight <= 0) return;

    // Draw on an offscreen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = imageWidth;
    offscreen.height = rowHeight;

    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    const sy = (selectedRow - 1) * rowHeight;
    ctx.drawImage(sourceImage, 0, sy, imageWidth, rowHeight, 0, 0, imageWidth, rowHeight);

    // Convert to blob URL
    offscreen.toBlob((blob) => {
      if (!blob) return;
      clearResult();
      resultUrl = URL.createObjectURL(blob);
      resultWidth = imageWidth;
      resultHeight = rowHeight;
    }, 'image/png');
  }

  function downloadResult() {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = `${imageName}_row${selectedRow}.png`;
    a.click();
  }

  // Redraw preview when params change
  $effect(() => {
    totalRows;
    selectedRow;
    sourceImage;
    drawPreview();
  });
</script>

<div class="space-y-6">
  <!-- Upload -->
  <div class="bg-slate-800 rounded-lg p-4">
    <h3 class="font-bold mb-3 text-cyan-400">Sprite Sheet Cutter</h3>
    <p class="text-xs text-gray-400 mb-3">
      Charger un sprite sheet, indiquer le nombre de lignes, choisir la ligne a extraire et telecharger le resultat.
    </p>

    <div class="flex gap-3 items-center flex-wrap">
      <button
        onclick={() => fileInput?.click()}
        class="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 rounded text-sm font-bold"
      >
        Charger une image
      </button>
      <input
        bind:this={fileInput}
        type="file"
        accept="image/*"
        onchange={handleFileUpload}
        class="hidden"
      />
      {#if sourceImage}
        <span class="text-xs text-gray-400">
          {imageName} — {imageWidth}x{imageHeight}px
        </span>
      {/if}
    </div>
  </div>

  {#if sourceImage}
    <!-- Config -->
    <div class="bg-slate-800 rounded-lg p-4">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
        <div>
          <span class="block text-xs text-gray-400 mb-1">Nombre de lignes</span>
          <input
            type="number"
            min="1"
            max="50"
            bind:value={totalRows}
            onchange={() => { if (selectedRow > totalRows) selectedRow = totalRows; }}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <span class="block text-xs text-gray-400 mb-1">Ligne a extraire</span>
          <input
            type="number"
            min="1"
            max={totalRows}
            bind:value={selectedRow}
            class="w-full px-3 py-2 bg-slate-700 rounded text-sm"
          />
        </div>
        <div>
          <span class="block text-xs text-gray-400 mb-1">Hauteur par ligne</span>
          <div class="px-3 py-2 bg-slate-900 rounded text-sm text-cyan-400 font-mono">
            {rowHeight}px
          </div>
        </div>
        <div>
          <span class="block text-xs text-gray-400 mb-1">Taille resultat</span>
          <div class="px-3 py-2 bg-slate-900 rounded text-sm text-cyan-400 font-mono">
            {imageWidth}x{rowHeight}px
          </div>
        </div>
      </div>

      <!-- Quick row selector buttons -->
      <div class="flex gap-1 flex-wrap mb-4">
        <span class="text-xs text-gray-500 self-center mr-1">Ligne :</span>
        {#each Array(totalRows) as _, i}
          <button
            onclick={() => { selectedRow = i + 1; cutRow(); }}
            class="w-8 h-8 rounded text-xs font-bold transition-colors
              {selectedRow === i + 1
                ? 'bg-cyan-600 text-white'
                : 'bg-slate-700 text-gray-400 hover:bg-slate-600'}"
          >
            {i + 1}
          </button>
        {/each}
      </div>

      <button
        onclick={cutRow}
        class="px-6 py-2 bg-blue-600 hover:bg-blue-500 rounded font-bold text-sm"
      >
        Decouper la ligne {selectedRow}
      </button>
    </div>

    <!-- Preview -->
    <div class="bg-slate-800 rounded-lg p-4">
      <h4 class="text-xs text-gray-500 mb-2">Apercu (lignes surlignees)</h4>
      <div class="overflow-x-auto">
        <canvas bind:this={previewCanvas} class="rounded border border-slate-600 max-w-full"></canvas>
      </div>
    </div>

    <!-- Result -->
    {#if resultUrl}
      <div class="bg-slate-800 rounded-lg p-4">
        <div class="flex items-center justify-between mb-3">
          <h4 class="text-xs text-gray-500">Resultat — Ligne {selectedRow} ({resultWidth}x{resultHeight}px)</h4>
          <button
            onclick={downloadResult}
            class="px-4 py-2 bg-green-600 hover:bg-green-500 rounded text-sm font-bold"
          >
            Telecharger PNG
          </button>
        </div>
        <div class="overflow-x-auto bg-slate-900 rounded p-2 border border-slate-600">
          <img src={resultUrl} alt="Ligne {selectedRow}" class="max-w-full" style="image-rendering: pixelated;" />
        </div>
      </div>
    {/if}
  {/if}
</div>
