<script>
  // A ship name that opens its details window (the dashboard's data-ship handler).
  let { name, text = name } = $props();
</script>

<button type="button" class="ship-link" data-ship={name}>{text}</button>
