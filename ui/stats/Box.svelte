<script>
  // One figure with its label underneath (the classic .stat-box).
  let { big, lbl, cls = '' } = $props();
</script>

<div class="stat-box {cls}"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
