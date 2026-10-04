<script>
  // A community link opening in a new tab, or "Label (soon)" while its URL isn't set
  // (same as link() in src/dashboard.js).
  let { url, label } = $props();
</script>

{#if url}<a href={url} target="_blank" rel="noopener">{label}</a>{:else}<span class="muted"
    >{label} (soon)</span
  >{/if}
