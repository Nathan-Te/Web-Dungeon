<script lang="ts">
  import type { SpriteSet, SpriteSource, SpriteSheetConfig } from '../game/types';

  interface Props {
    sprites?: SpriteSet;
    /** Fallback text when no sprite is available */
    fallback?: string;
    /** CSS class for the container */
    class?: string;
  }

  let { sprites, fallback = '?', class: className = 'w-full h-full' }: Props = $props();

  function isSheet(src: SpriteSource | undefined): src is SpriteSheetConfig {
    return typeof src === 'object' && src !== null && 'src' in src;
  }

  let idle = $derived(sprites?.idle);
  let hasSprite = $derived(idle !== undefined);
  let isStatic = $derived(hasSprite && !isSheet(idle));
  let sheet = $derived(isSheet(idle) ? idle : null);
  let staticSrc = $derived(isStatic && typeof idle === 'string' ? idle : null);
</script>

<div class={className}>
  {#if sheet}
    <!-- Show first frame of sprite sheet -->
    <div class="w-full h-full overflow-hidden"
      style="background-image: url({sheet.src}); background-size: {sheet.framesPerRow * 100}% auto; background-position: 0 0; background-repeat: no-repeat;"
    ></div>
  {:else if staticSrc}
    <img src={staticSrc} alt="" class="w-full h-full object-contain" />
  {:else}
    <span class="w-full h-full flex items-center justify-center text-xl font-bold text-white/30">{fallback}</span>
  {/if}
</div>
