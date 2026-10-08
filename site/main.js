// The landing page's scripts (moved out of index.html so the site can send a
// strict Content-Security-Policy, open-hangar#201).
// Screenshot tour: thumbnails swap the big image + caption.
(function () {
  var img = document.getElementById('tour-img');
  var cap = document.getElementById('tour-caption');
  var tabs = document.querySelectorAll('.tour-thumbs button');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      tabs.forEach(function (t) {
        t.setAttribute('aria-selected', String(t === tab));
      });
      img.src = tab.dataset.src;
      img.alt = tab.dataset.title + ': ' + tab.dataset.text;
      cap.innerHTML = '';
      var strong = document.createElement('strong');
      strong.textContent = tab.dataset.title;
      strong.textContent += ':';
      cap.append(strong, ' ' + tab.dataset.text);
    });
  });
})();

// Wire up store links + status, and put the visitor's own browser first.
(function () {
  var ua = navigator.userAgent;
  var mine = /Edg\//.test(ua)
    ? 'edge'
    : /Firefox\//.test(ua)
      ? 'firefox'
      : /Chrome\//.test(ua)
        ? 'chrome'
        : null;
  var LABELS = { review: 'In Review', planned: 'Soon™' };
  var box = document.getElementById('installs');
  var allLive = true;
  box.querySelectorAll('.install').forEach(function (a) {
    var url = a.getAttribute('data-url');
    var status = a.getAttribute('data-status') || 'planned';
    // Only real store links (https) become hrefs (CodeQL #285).
    if (status === 'live' && url && /^https:\/\//.test(url)) {
      a.href = url;
      a.classList.add('live');
    } else {
      // A store that isn't live yet says so under its name.
      a.classList.add('soon', 'status-' + status);
      a.setAttribute('aria-disabled', 'true');
      var note = document.createElement('span');
      note.className = 'b-note';
      note.textContent = LABELS[status] || 'Coming Soon';
      a.querySelector('.b-name').after(note);
      if (status === 'review') allLive = false;
    }
    if (a.getAttribute('data-browser') === mine) {
      a.classList.add('mine');
      box.prepend(a);
    }
  });
  // Drop the "submitted / in review" line once nothing is pending.
  if (allLive) document.getElementById('status-line').remove();
})();

// Open beta notice until the November 10 release: a small card in the corner, shown
// until it's closed (remembered in this browser). Remove after the release.
(function () {
  var note = document.getElementById('beta-note');
  var close = document.getElementById('beta-close');
  if (!note || !close) return;
  var KEY = 'ohBetaNoteClosed';
  var closed = false;
  try {
    closed = localStorage.getItem(KEY) === '1';
  } catch (e) {
    /* storage blocked: show it */
  }
  if (closed || Date.now() > Date.parse('2026-11-11')) return;
  note.hidden = false;
  close.addEventListener('click', function () {
    note.hidden = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch (e) {
      /* fine: it just shows again next visit */
    }
  });
})();
