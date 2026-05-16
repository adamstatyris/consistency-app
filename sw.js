/* Service worker: network pass-through + background reminder checks (Periodic Background Sync).
 * Reminder times use the device timezone string posted from the page (see snapshot builder).
 * True server Push (works when the browser is fully closed) still needs a push backend + subscription — not implemented here.
 */
var CONSISTENCY_SW_CACHE = 'consistency-sw-v3';
var K_SNAPSHOT = 'https://consistency.invalid/reminder-snapshot';
var K_SW_DEDUPE = 'https://consistency.invalid/sw-notif-dedupe';

function notifIconUrl() {
  try {
    return new URL('icons/icon-192.png?v=3', self.registration.scope || self.location).href;
  } catch (e) {
    return undefined;
  }
}

function ymdInTz(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(ms));
}

function hmInTz(ms, tz) {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  var h = '00',
    m = '00';
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p.type === 'hour') h = String(p.value).padStart(2, '0');
    if (p.type === 'minute') m = String(p.value).padStart(2, '0');
  }
  return h + ':' + m;
}

function modInTz(ms, tz) {
  var parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  var h = 0,
    m = 0;
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    if (p.type === 'hour') h = parseInt(p.value, 10) || 0;
    if (p.type === 'minute') m = parseInt(p.value, 10) || 0;
  }
  return h * 60 + m;
}

function slotAllowed(snap, s) {
  if (s.slot === '_tempPush2350') return true;
  if (!snap.notify || snap.paused || snap.stopped) return false;
  if (snap.kid && s.slot.indexOf('hrd:') === 0) return false;
  return true;
}

function readJsonFromCache(cache, key) {
  return cache.match(key).then(function (r) {
    if (!r) return null;
    return r.json();
  });
}

function swProcessReminders() {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return Promise.resolve();
  }
  var nowMs = Date.now();
  return caches.open(CONSISTENCY_SW_CACHE).then(function (cache) {
    return Promise.all([readJsonFromCache(cache, K_SNAPSHOT), readJsonFromCache(cache, K_SW_DEDUPE)]).then(function (arr) {
      var snap = arr[0];
      var swDedupe = arr[1] || {};
      if (!snap || snap.v !== 1 || !snap.tz) return;

      var merged = Object.assign({}, snap.dedupe || {}, swDedupe);
      var today = ymdInTz(nowMs, snap.tz);
      var hm = hmInTz(nowMs, snap.tz);
      var mod = modInTz(nowMs, snap.tz);
      var icon = notifIconUrl();
      var baseOpt = { icon: icon, badge: icon };

      var fires = [];
      var slots = snap.slots || [];

      for (var i = 0; i < slots.length; i++) {
        var s = slots[i];
        if (!slotAllowed(snap, s)) continue;
        if (merged[s.slot] === today) continue;

        var match = false;
        if (s.t === 'exact') {
          match = s.date === today && s.hm === hm;
        } else if (s.t === 'range') {
          match = s.date === today && mod >= s.modLo && mod <= s.modHi;
        }
        if (!match) continue;

        merged[s.slot] = today;
        swDedupe[s.slot] = today;
        fires.push(
          self.registration.showNotification('Consistency', Object.assign({}, baseOpt, { body: s.body || '', tag: s.slot }))
        );
      }

      return Promise.all(fires).then(function () {
        return cache.put(
          K_SW_DEDUPE,
          new Response(JSON.stringify(swDedupe), { headers: { 'Content-Type': 'application/json' } })
        );
      });
    });
  });
}

self.addEventListener('install', function (e) {
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(self.clients.claim().then(function () { return swProcessReminders(); }));
});

self.addEventListener('fetch', function (e) {
  if (e.request.mode === 'navigate' || e.request.destination === 'document') {
    return;
  }
  e.respondWith(fetch(e.request));
});

self.addEventListener('message', function (event) {
  var d = event.data;
  if (!d || d.type !== 'CONSISTENCY_REMINDER_SNAPSHOT') return;
  event.waitUntil(
    caches.open(CONSISTENCY_SW_CACHE).then(function (cache) {
      return cache
        .put(K_SNAPSHOT, new Response(JSON.stringify(d.payload), { headers: { 'Content-Type': 'application/json' } }))
        .then(function () { return swProcessReminders(); });
    })
  );
});

self.addEventListener('periodicsync', function (event) {
  if (event.tag === 'consistency-reminders') {
    event.waitUntil(swProcessReminders());
  }
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c.url && 'focus' in c) return c.focus();
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(new URL('./', self.location).href);
      }
    })
  );
});
