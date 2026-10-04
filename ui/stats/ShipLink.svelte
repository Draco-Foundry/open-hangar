<script>
  // A ship name that opens the ship's details window (the classic [data-ship] handler).
  let { name, text = name } = $props();
</script>

<button type="button" class="ship-link" data-ship={name}>{text}</button>
