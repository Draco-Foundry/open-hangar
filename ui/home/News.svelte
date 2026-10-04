<script>
  // Latest From RSI: This Week in Star Citizen as the lead, then Comm-Links and
  // patch notes, newest first, each tagged NEWS or PATCH (no filters: the owner
  // wants simply the latest). Older weekly posts are left out (the lead is newest).
  import { live } from '../lib/app.svelte.js';
  import { shortDay } from '../lib/format.js';

  // RSI's list only says "2 days ago" / "1 week ago"; turn that into a rough time so
  // Comm-Links and patch notes can share one list.
  function ago(when) {
    const m = /(\d+|an?|one)\s+(minute|hour|day|week|month|year)/i.exec(String(when || ''));
    if (!m) return Date.now();
    const n = /^\d+$/.test(m[1]) ? +m[1] : 1;
    const unit = { minute: 6e4, hour: 36e5, day: 864e5, week: 6048e5, month: 2592e6, year: 31536e6 }[m[2].toLowerCase()];
    return Date.now() - n * unit;
  }

  const d = $derived.by(() => {
    const lead = live.twisc && live.twisc.lead ? live.twisc : null;
    const news = (live.news || [])
      .filter((n) => !(lead && n.url === lead.url) && !/^This Week in Star Citizen/i.test(n.title))
      .map((n) => ({ tag: 'NEWS', title: n.title, url: n.url, at: ago(n.when), when: n.when }));
    const patch = (live.patches || []).map((p) => ({
      tag: 'PATCH',
      title: p.label ? `${p.title} (${p.label})` : p.title,
      url: p.url,
      at: p.at,
      when: shortDay(p.at),
    }));
    const all = [...news, ...patch].sort((x, y) => y.at - x.at);
    const leadDate = lead ? (lead.title.match(/-\s*(.+)$/) || [])[1] || '' : '';
    return { lead, leadDate, all };
  });
  const list = $derived(d.all.slice(0, 5));
  const showLead = $derived(!!d.lead);
</script>

<section class="oh-p">
  <div class="oh-ph"><h3>Latest From RSI</h3></div>
  {#if showLead}
    <a class="lead" href={d.lead.url} target="_blank" rel="noopener">
      {#if d.lead.image}<img src={d.lead.image} alt="" />{:else}<span class="ph"></span>{/if}
      <span class="lt">
        <span class="h">This Week in Star Citizen {#if d.leadDate}<span class="dt">{d.leadDate}</span>{/if}</span>
        <span class="p">{d.lead.lead}</span>
      </span>
    </a>
  {/if}
  {#each list as n (n.url)}
    <a class="nl" href={n.url} target="_blank" rel="noopener" title={n.title}>
      <span class="tag">{n.tag === 'PATCH' ? 'PATCH' : 'NEWS'}</span>
      <span class="t">{n.title}</span>
      <span class="w">{n.when}</span>
    </a>
  {:else}
    {#if !live.loaded}<p class="oh-muted">{window.OH?.quip?.('loading') || 'Loading…'}</p>{:else if !showLead}<p class="oh-muted">Comm-Link’s quiet right now. Probably a 30k on the relay.</p>{/if}
  {/each}
  <a class="oh-more" href="https://robertsspaceindustries.com/comm-link" target="_blank" rel="noopener">More on RSI ↗</a>
</section>

<style>
  .lead {
    display: grid;
    grid-template-columns: 132px minmax(0, 1fr);
    gap: 14px;
    padding-bottom: 14px;
    margin-bottom: 2px;
    border-bottom: 1px solid var(--line);
    text-decoration: none;
    color: var(--text);
  }
  .lead img,
  .lead .ph {
    width: 132px;
    height: 80px;
    border-radius: var(--r-md);
    object-fit: cover;
    background: var(--panel-2);
  }
  .lt {
    min-width: 0;
    display: grid;
    gap: 4px;
    align-content: start;
  }
  .h {
    font: 600 16px var(--font-head);
    color: var(--head);
  }
  .lead:hover .h {
    color: var(--link);
  }
  .dt {
    font: 600 13px var(--font-body);
    color: var(--muted);
    margin-left: 4px;
  }
  .p {
    font-size: 14px;
    color: var(--muted);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .nl {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    font-size: 14px;
    text-decoration: none;
    color: var(--text);
  }
  .nl + .nl {
    border-top: 1px solid var(--line);
  }
  .nl:hover .t {
    color: var(--link);
  }
  .tag {
    font: 700 10px/1 var(--font-head);
    letter-spacing: 0.07em;
    border-radius: 5px;
    padding: 4px 0;
    background: var(--panel-2);
    color: var(--muted);
    text-align: center;
  }
  .t {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .w {
    color: var(--muted);
    font-size: 13px;
    white-space: nowrap;
  }
  @media (max-width: 480px) {
    .lead {
      grid-template-columns: 96px minmax(0, 1fr);
    }
    .lead img,
    .lead .ph {
      width: 96px;
      height: 60px;
    }
    .w {
      display: none;
    }
  }
</style>
