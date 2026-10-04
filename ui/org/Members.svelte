<script>
  // Members: click a name to open their fleet next to the rest of the org; with two
  // or more members, pick two to compare side by side.
  import { app } from '../lib/app.svelte.js';
  import { ui } from './ui.svelte.js';
  import { share } from './text.js';
  import PairBars from './PairBars.svelte';

  let { f, members } = $props();

  const money = (n) => app().dollars(n);
  const covered = (fl) => fl.roles.filter((r) => r.count).length;
  const shipList = (fl) =>
    fl.ships.map((sh) => (sh.count > 1 ? `${sh.name} ×${sh.count}` : sh.name)).join(', ');

  // The open member vs everyone else.
  const mine = $derived.by(() => {
    const m = members.find((x) => x.name === ui.member);
    if (!m) return null;
    const o = app().org;
    const me = o.fleet([m]);
    const rest = o.fleet(members.filter((x) => x !== m));
    const onlyMe = me.roles.filter(
      (r) => r.count && !rest.roles.find((x) => x.key === r.key).count,
    );
    return {
      name: m.name,
      me,
      rest,
      onlyMe: onlyMe.map((r) => r.label).join(', '),
      boxes: [
        [me.shipCount, 'ships'],
        [money(me.store), 'fleet value'],
        [share(me.store, f.store), 'of org value'],
        [covered(me), 'roles covered'],
      ],
    };
  });

  // The two members picked in the compare bar.
  const cmp = $derived.by(() => {
    const A = members.find((x) => x.name === ui.a);
    const B = members.find((x) => x.name === ui.b);
    if (!A || !B || A === B) return null;
    const o = app().org;
    const fa = o.fleet([A]);
    const fb = o.fleet([B]);
    const namesA = new Set(fa.ships.map((x) => x.name));
    const namesB = new Set(fb.ships.map((x) => x.name));
    const col = (fl, name) => ({
      name,
      rows: [
        ['Ships', fl.shipCount],
        ['Fleet value', money(fl.store)],
        ['LTI', fl.byMember[0] ? fl.byMember[0].lti : 0],
        ['Cargo', `${Math.round(fl.cargo).toLocaleString('en-US')} SCU`],
        ['Crew seats', fl.crew],
        ['Roles covered', covered(fl)],
      ],
    });
    return {
      A: A.name,
      B: B.name,
      fa,
      fb,
      cols: [col(fa, A.name), col(fb, B.name)],
      lists: [
        ['Both Own', [...namesA].filter((n) => namesB.has(n))],
        [`Only ${A.name}`, [...namesA].filter((n) => !namesB.has(n))],
        [`Only ${B.name}`, [...namesB].filter((n) => !namesA.has(n))],
      ],
    };
  });

  const open = (name) => (ui.member = ui.member === name ? null : name);
  const pick = (side, e) => (ui[side] = e.currentTarget.value || null);
</script>

<h3 class="section-title" style="margin-top:22px">Members</h3>
<p class="muted org-intro">Click a member to see their fleet next to the rest of the org.</p>
<table class="org-table">
  <thead>
    <tr>
      <th>Member</th><th class="num">Ships</th><th class="num">LTI</th>
      <th class="num">Fleet Value</th><th class="num">Share</th>
    </tr>
  </thead>
  <tbody>
    {#each f.byMember as m}
      <tr
        class="org-mrow{ui.member === m.name ? ' open' : ''}"
        data-member={m.name}
        onclick={() => open(m.name)}
      >
        <td><button type="button" class="bb-open">{m.name}</button></td>
        <td class="num">{m.ships}</td>
        <td class="num">{m.lti}</td>
        <td class="num">{m.priced ? money(m.store) : '—'}</td>
        <td class="num">{share(m.store, f.store)}</td>
      </tr>
    {/each}
  </tbody>
</table>

{#if mine}
  <div class="org-panel">
    <div class="org-panel-head">
      <strong>{mine.name}</strong> vs the rest of the org<button
        type="button"
        class="org-close"
        data-close="member"
        aria-label="Close"
        onclick={() => (ui.member = null)}>×</button
      >
    </div>
    <div class="stat-grid">
      {#each mine.boxes as [big, lbl]}
        <div class="stat-box"><div class="big">{big}</div><div class="lbl">{lbl}</div></div>
      {/each}
    </div>
    {#if mine.onlyMe}
      <p class="org-intro">Only {mine.name} covers: <strong>{mine.onlyMe}</strong></p>
    {/if}
    <div class="fleet-cols">
      <div>
        <h4 class="modal-h">By Role</h4>
        <PairBars
          a={mine.me.byCareer}
          b={mine.rest.byCareer}
          labelA={mine.name}
          labelB="Rest of org"
        />
      </div>
      <div>
        <h4 class="modal-h">By Size</h4>
        <PairBars
          a={mine.me.bySize}
          b={mine.rest.bySize}
          labelA={mine.name}
          labelB="Rest of org"
        />
      </div>
    </div>
    <h4 class="modal-h">Ships</h4>
    <p class="org-owners">{shipList(mine.me)}</p>
  </div>
{/if}

{#if members.length >= 2}
  <div class="org-compare-bar">
    Compare
    <select
      class="org-cmp"
      data-side="a"
      aria-label="First Member to Compare"
      onchange={(e) => pick('a', e)}
    >
      <option value="">pick a member</option>
      {#each members as m}
        <option value={m.name} selected={m.name === ui.a}>{m.name}</option>
      {/each}
    </select>
    with
    <select
      class="org-cmp"
      data-side="b"
      aria-label="Second Member to Compare"
      onchange={(e) => pick('b', e)}
    >
      <option value="">pick a member</option>
      {#each members as m}
        <option value={m.name} selected={m.name === ui.b}>{m.name}</option>
      {/each}
    </select>
  </div>
{/if}

{#if cmp}
  <div class="org-panel">
    <div class="org-panel-head">
      <strong>{cmp.A}</strong> vs <strong>{cmp.B}</strong><button
        type="button"
        class="org-close"
        data-close="compare"
        aria-label="Close"
        onclick={() => (ui.a = ui.b = null)}>×</button
      >
    </div>
    <div class="cmp-cols">
      {#each cmp.cols as c}
        <div class="cmp-col">
          <h4 class="modal-h">{c.name}</h4>
          {#each c.rows as [k, v]}
            <div class="cmp-kv"><span>{k}</span><b>{v}</b></div>
          {/each}
        </div>
      {/each}
    </div>
    <div class="fleet-cols">
      <div>
        <h4 class="modal-h">By Role</h4>
        <PairBars a={cmp.fa.byCareer} b={cmp.fb.byCareer} labelA={cmp.A} labelB={cmp.B} />
      </div>
      <div>
        <h4 class="modal-h">By Size</h4>
        <PairBars a={cmp.fa.bySize} b={cmp.fb.bySize} labelA={cmp.A} labelB={cmp.B} />
      </div>
    </div>
    {#each cmp.lists as [title, list]}
      <h4 class="modal-h">{title}</h4>
      <p class="org-owners">
        {#if list.length}{list.join(', ')}{:else}<span class="muted">none</span>{/if}
      </p>
    {/each}
  </div>
{/if}
