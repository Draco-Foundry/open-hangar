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
        : /Safari\//.test(ua)
          ? 'safari'
          : null;
  var LABELS = { review: 'In review', planned: 'Planned' };
  var box = document.getElementById('installs');
  var allLive = true;
  box.querySelectorAll('.install').forEach(function (a) {
    var url = a.getAttribute('data-url');
    var status = a.getAttribute('data-status') || 'planned';
    var note = a.querySelector('.b-note');
    if (status === 'live' && url) {
      a.href = url;
      a.classList.add('live');
      note.textContent = 'Add to ' + a.querySelector('.b-name').textContent;
    } else {
      a.classList.add('soon', 'status-' + status);
      a.setAttribute('aria-disabled', 'true');
      note.textContent = LABELS[status] || 'Coming soon';
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
