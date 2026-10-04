<script>
  // One line of CHANGELOG markdown (bold, code, links), from inlineParts() in ./release.js.
  import Markdown from './Markdown.svelte';

  let { parts } = $props();
</script>

{#each parts as p, i (i)}{#if p.t === 'text'}{p.text}{:else if p.t === 'a'}<a
      href={p.href}
      target="_blank"
      rel="noopener">{p.text}</a
    >{:else if p.t === 'strong'}<strong><Markdown parts={p.parts} /></strong
    >{:else}<code><Markdown parts={p.parts} /></code>{/if}{/each}
