<script>
  // A buy-back's price: RSI's once Load Details has read it, else an estimate from
  // today's store price (marked "est."). `p` is { text, title, est } (OHApp.bb).
  let { p } = $props();
</script>

<span class="val" class:est={p.est} title={p.title || undefined}
  >{p.text}{#if p.est}<small class="est-l">est.</small>{/if}</span
>
