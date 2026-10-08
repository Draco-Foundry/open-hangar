<script>
  // Members: one chip per member (× takes them off the list). Click a name to see the
  // ships they fly and the roles those ships cover. Ships only: no values, and nothing
  // that puts one member's numbers next to another's.
  import { app } from '../lib/app.svelte.js';
  import { ui } from './ui.svelte.js';

  // `ready`: the ship list has loaded, so a member's roles can be worked out.
  let { members, ready } = $props();

  const shipList = (fl) =>
    fl.ships.map((sh) => (sh.count > 1 ? `${sh.name} ×${sh.count}` : sh.name)).join(', ');

  // The open member's ships, the roles they cover, and any role nobody else fills.
  const mine = $derived.by(() => {
    if (!ready) return null;
    const m = members.find((x) => x.name === ui.member);
    if (!m) return null;
    const o = app().org;
    const me = o.fleet([m]);
    const rest = o.fleet(members.filter((x) => x !== m));
    const covers = me.roles.filter((r) => r.count);
    const onlyMe =
      members.length > 1
        ? covers.filter((r) => !rest.roles.find((x) => x.key === r.key).count)
        : [];
    return {
      name: m.name,
      ships: shipList(me),
      covers: covers.map((r) => r.label).join(', '),
      onlyMe: onlyMe.map((r) => r.label).join(', '),
    };
  });

  const open = (name) => (ui.member = ui.member === name ? null : name);
</script>

<div class="org-members">
  {#each members as m}
    <span class="org-member{ui.member === m.name ? ' open' : ''}"
      ><button
        type="button"
        class="org-mname"
        data-member={m.name}
        aria-expanded={ui.member === m.name}
        onclick={() => open(m.name)}>{m.name}</button
      ><button
        type="button"
        class="org-remove"
        data-name={m.name}
        title="Remove"
        aria-label="Remove {m.name}"
        onclick={() => app().org.remove(m.name)}>×</button
      ></span
    >
  {/each}
  <span class="muted org-hint">Click a name to see their ships.</span>
</div>

{#if mine}
  <div class="org-panel org-member-panel">
    <div class="org-panel-head">
      <strong>{mine.name}</strong><button
        type="button"
        class="org-close"
        data-close="member"
        aria-label="Close"
        onclick={() => (ui.member = null)}>×</button
      >
    </div>
    {#if mine.covers}
      <p class="org-intro">Roles: <strong>{mine.covers}</strong></p>
    {/if}
    {#if mine.onlyMe}
      <p class="org-intro">Only {mine.name} covers: <strong>{mine.onlyMe}</strong></p>
    {/if}
    <h4 class="modal-h">Ships</h4>
    <p class="org-owners">{mine.ships}</p>
  </div>
{/if}
