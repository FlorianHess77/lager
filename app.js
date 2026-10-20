'use strict';
/* =====================================================================
   Lager – Räume, Plätze und alles, was darin liegt.
   Läuft komplett im Browser, Daten bleiben in IndexedDB auf dem Gerät.
   ===================================================================== */
const APP_VER = 'lager-1.2.0';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const collator = new Intl.Collator('de', { sensitivity: 'base', numeric: true });
const byName = (a, b) => collator.compare(a.name, b.name);
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
const plural = (n, one, many) => `${n.toLocaleString('de-AT')} ${n === 1 ? one : many}`;
const fmtDate = t => t ? new Date(t).toLocaleDateString('de-AT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/* ---------------- Farben, Symbole, Startvorschläge ---------------- */
const COLORS = [
  ['Salbei', '#A8D5BA'], ['Himmel', '#9CC9F0'], ['Flieder', '#C7B8F5'], ['Rosa', '#F5B3C2'],
  ['Ocker', '#F2C98A'], ['Minze', '#8EE0D2'], ['Limette', '#D4E88A'], ['Pfirsich', '#F7B58C'], ['Stein', '#C9CFD8'],
];
const EMOJIS = ['🏠','🛋️','🍳','🛏️','🛁','🚿','🧺','🔧','🛠️','🪚','🚗','🏍️','🚲','📦','🗄️','🧰','🪜','🍷','🥫','🧊','🎄','🧸','👕','👟','📚','💻','🖨️','🎮','🎸','🏕️','🌱','🪴','🧹','🔌','💡','🐶','🐱','🎨','🧵','🏋️','⚽','🎿','🧳','🪑','🚪','🏢','🏡','🧪','🔋','🪵'];
const STARTER = [
  ['Keller', '🍷', '#C9CFD8'], ['Küche', '🍳', '#F7B58C'], ['Werkstatt', '🔧', '#F2C98A'], ['Garage', '🚗', '#9CC9F0'],
  ['Wohnzimmer', '🛋️', '#A8D5BA'], ['Schlafzimmer', '🛏️', '#C7B8F5'], ['Bad', '🛁', '#8EE0D2'], ['Vorzimmer', '🚪', '#C9CFD8'],
  ['Abstellraum', '🧹', '#D4E88A'], ['Dachboden', '🧳', '#F5B3C2'], ['Büro', '💻', '#9CC9F0'], ['Kinderzimmer', '🧸', '#F5B3C2'],
  ['Gartenhütte', '🌱', '#D4E88A'],
];

/* ---------------- Symbole (SVG) ---------------- */
const I = {
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z M13.5 6.5l4 4"/></svg>',
  share: '<svg viewBox="0 0 24 24"><path d="M12 3v12 M7 8l5-5 5 5 M5 13v7h14v-7"/></svg>',
  move: '<svg viewBox="0 0 24 24"><path d="M3 8h13 M12 4l4 4-4 4 M21 16H8 M12 12l-4 4 4 4"/></svg>',
  lend: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6 M16 11h6 M19 8l3 3-3 3"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  cam: '<svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  img: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4 4"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></svg>',
  mic: '<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0 M12 18v3"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11 M7 10l5 5 5-5 M5 20h14"/></svg>',
  ul: '<svg viewBox="0 0 24 24"><path d="M12 20V9 M7 14l5-5 5 5 M5 4h14"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>',
  sort: '<svg viewBox="0 0 24 24"><path d="M7 4v16 M3 8l4-4 4 4 M17 20V4 M13 16l4 4 4-4"/></svg>',
  back2: '<svg viewBox="0 0 24 24"><path d="M9 14 4 9l5-5 M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  dots: '<svg viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/></svg>',
  expand: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6 M20 4l-7 7 M10 20H4v-6 M4 20l7-7"/></svg>',
  pin: '<svg viewBox="0 0 24 24" class="pin"><path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" fill="currentColor" stroke="none" opacity=".9"/><circle cx="12" cy="9.5" r="2.6" fill="var(--card)"/></svg>',
};
const LOGO = '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="2" y="2" width="44" height="44" rx="10" fill="#FFD23F"/><g fill="none" stroke="#1D2433" stroke-width="3" stroke-linejoin="round"><path d="M9 20h8v-6h12v6h10v18H9z"/><path d="M9 28h16v-5h11v5h3"/></g></svg>';

/* =====================================================================
   Datenbank (IndexedDB, Rückfall: Arbeitsspeicher)
   ===================================================================== */
const DB = {
  db: null, mem: null,
  open() {
    return new Promise(res => {
      let req;
      try { req = indexedDB.open('lager', 1); } catch { this.mem = {}; return res(); }
      req.onupgradeneeded = () => {
        const d = req.result;
        for (const s of ['rooms', 'items', 'photos']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' });
      };
      req.onsuccess = () => { this.db = req.result; res(); };
      req.onerror = req.onblocked = () => { this.mem = {}; res(); };
    });
  },
  _m(s) { return (this.mem[s] ||= new Map()); },
  tx(store, mode, fn) {
    return new Promise((res, rej) => {
      const t = this.db.transaction(store, mode); const st = t.objectStore(store);
      let out; const r = fn(st); if (r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out); t.onerror = t.onabort = () => rej(t.error);
    });
  },
  all(s) { return this.mem ? Promise.resolve([...this._m(s).values()]) : this.tx(s, 'readonly', st => st.getAll()); },
  get(s, id) { return this.mem ? Promise.resolve(this._m(s).get(id)) : this.tx(s, 'readonly', st => st.get(id)); },
  put(s, o) { if (this.mem) { this._m(s).set(o.id, o); return Promise.resolve(); } return this.tx(s, 'readwrite', st => st.put(o)); },
  del(s, id) { if (this.mem) { this._m(s).delete(id); return Promise.resolve(); } return this.tx(s, 'readwrite', st => st.delete(id)); },
  keys(s) { return this.mem ? Promise.resolve([...this._m(s).keys()]) : this.tx(s, 'readonly', st => st.getAllKeys()); },
  clear(s) { if (this.mem) { this._m(s).clear(); return Promise.resolve(); } return this.tx(s, 'readwrite', st => st.clear()); },
};

const S = { rooms: [], items: [] };
const roomById = id => S.rooms.find(r => r.id === id);
const itemById = id => S.items.find(i => i.id === id);
const itemsIn = id => S.items.filter(i => i.roomId === id);
const isLow = it => it.min != null && it.min !== '' && Number(it.qty) <= Number(it.min);

async function loadAll() {
  S.rooms = (await DB.all('rooms')).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  S.items = await DB.all('items');
}
async function saveRoom(r) { await DB.put('rooms', r); const i = S.rooms.findIndex(x => x.id === r.id); i < 0 ? S.rooms.push(r) : (S.rooms[i] = r); S.rooms.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)); }
async function saveItem(it) {
  it.updated = Date.now();
  await DB.put('items', it);
  const i = S.items.findIndex(x => x.id === it.id); i < 0 ? S.items.push(it) : (S.items[i] = it);
  const room = roomById(it.roomId);
  if (room && it.place && !(room.places || []).some(p => p.toLowerCase() === it.place.toLowerCase())) {
    room.places = [...(room.places || []), it.place]; await saveRoom(room);
  }
  if (!lsGet('lager.persist')) { lsSet('lager.persist', '1'); navigator.storage?.persist?.().catch(() => {}); }
}
async function removeItem(id, keepPhotos) {
  const it = itemById(id); if (!it) return;
  await DB.del('items', id); S.items = S.items.filter(x => x.id !== id);
  if (!keepPhotos) for (const p of it.photos || []) await delPhoto(p);
}

/* ---------------- Fotos ---------------- */
const urlCache = new Map();
async function photoUrl(id, kind = 'thumb') {
  const k = id + ':' + kind; if (urlCache.has(k)) return urlCache.get(k);
  const p = await DB.get('photos', id); if (!p) return null;
  const u = URL.createObjectURL(p[kind] || p.full); urlCache.set(k, u); return u;
}
async function delPhoto(id) {
  await DB.del('photos', id);
  for (const k of ['thumb', 'full']) { const u = urlCache.get(id + ':' + k); if (u) { URL.revokeObjectURL(u); urlCache.delete(id + ':' + k); } }
}
async function decode(blob) {
  try { return await createImageBitmap(blob, { imageOrientation: 'from-image' }); }
  catch {
    return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = URL.createObjectURL(blob); });
  }
}
function toBlob(src, max, q, square) {
  const w0 = src.width, h0 = src.height;
  let sx = 0, sy = 0, sw = w0, sh = h0;
  if (square) { const m = Math.min(w0, h0); sx = (w0 - m) / 2; sy = (h0 - m) / 2; sw = sh = m; }
  const sc = Math.min(1, max / Math.max(sw, sh));
  const c = document.createElement('canvas'); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
  const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return new Promise(r => c.toBlob(b => r(b), 'image/jpeg', q));
}
async function storePhoto(blobOrCanvas) {
  const src = blobOrCanvas instanceof Blob ? await decode(blobOrCanvas) : blobOrCanvas;
  const full = await toBlob(src, 1600, .84), thumb = await toBlob(src, 360, .78, true);
  src.close?.();
  const id = uid(); await DB.put('photos', { id, full, thumb }); return id;
}
async function hydrate(root = document) {
  for (const img of $$('img[data-ph]', root)) {
    const u = await photoUrl(img.dataset.ph, img.dataset.kind || 'thumb');
    if (u) img.src = u; else img.remove();
  }
}
const thumb = (it, cls = 'th') => {
  const r = roomById(it.roomId);
  return `<span class="${cls}" style="--c:${r?.color || '#C9CFD8'}">${it.photos?.length ? `<img data-ph="${it.photos[0]}" alt="">` : esc((it.name || '?').trim().charAt(0).toUpperCase())}</span>`;
};

/* =====================================================================
   Suche – tolerant gegenüber Umlauten, Mehrzahl und Tippfehlern
   ===================================================================== */
function norm(s) {
  return String(s || '').toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
function lev(a, b, max) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]; let mn = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v); if (v < mn) mn = v;
    }
    if (mn > max) return max + 1; prev = cur;
  }
  return prev[b.length];
}
const FIELDS = [['name', 30], ['tags', 18], ['place', 12], ['room', 10], ['lent', 8], ['note', 6]];
function scoreItem(it, terms) {
  const room = roomById(it.roomId);
  const f = { name: norm(it.name), tags: norm((it.tags || []).join(' ')), place: norm(it.place), room: norm(room?.name), lent: norm(it.lentTo), note: norm(it.note) };
  let total = 0;
  for (const t of terms) {
    let best = 0;
    for (const [k, w] of FIELDS) {
      const h = f[k]; if (!h) continue;
      const i = h.indexOf(t); if (i < 0) continue;
      let s = w; if (i === 0) s += w * .6; else if (h[i - 1] === ' ') s += w * .3;
      if (s > best) best = s;
    }
    if (!best && t.length >= 4) {
      const max = t.length >= 7 ? 2 : 1;
      for (const [k, w] of FIELDS.slice(0, 4)) {
        for (const word of f[k].split(' ')) {
          if (word.length < 3) continue;
          if (lev(t, word, max) <= max || (word.length > t.length && lev(t, word.slice(0, t.length), 1) <= 1)) { best = Math.max(best, w * .4); break; }
        }
      }
    }
    if (!best) return 0;
    total += best;
  }
  return total;
}
function search(q, filter = 'all', roomId = '') {
  const terms = norm(q).split(' ').filter(Boolean);
  let list = S.items;
  if (roomId) list = list.filter(i => i.roomId === roomId);
  if (filter === 'lent') list = list.filter(i => i.lentTo);
  if (filter === 'low') list = list.filter(isLow);
  if (filter === 'photo') list = list.filter(i => i.photos?.length);
  if (!terms.length) return list.slice().sort(byName).map(it => ({ it, s: 0 }));
  return list.map(it => ({ it, s: scoreItem(it, terms) })).filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || byName(a.it, b.it));
}
function highlight(text, q) {
  const t = esc(text); const terms = String(q || '').trim().split(/\s+/).filter(x => x.length > 1);
  if (!terms.length) return t;
  const re = new RegExp('(' + terms.map(x => esc(x).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return t.replace(re, '<mark>$1</mark>');
}

/* =====================================================================
   Bausteine
   ===================================================================== */
function where(it) { const r = roomById(it.roomId); return (r ? r.name : 'Ohne Raum') + (it.place ? ' › ' + it.place : ''); }
function itemRow(it, opt = {}) {
  const r = roomById(it.roomId);
  const sub = it.lentTo
    ? `<span class="lent">verliehen an ${esc(it.lentTo)}</span>`
    : opt.inRoom ? `<span class="t">${esc(it.note ? it.note.split('\n')[0] : (it.tags || []).join(', ') || '')}</span>`
      : `<span class="sw" style="--c:${r?.color || '#C9CFD8'}"></span><span class="t">${esc(where(it))}</span>`;
  const qty = Number(it.qty ?? 1);
  return `<li><a class="it" href="#/item/${it.id}">${thumb(it)}<span class="it-main"><b>${opt.q ? highlight(it.name, opt.q) : esc(it.name)}</b><small>${sub}</small></span>${qty !== 1 || isLow(it) ? `<span class="qty${isLow(it) ? ' low' : ''}">${qty}</span>` : ''}</a></li>`;
}
function emptyBox(title, text, btn = '') {
  return `<div class="empty"><svg viewBox="0 0 120 90" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><path d="M14 30 60 12l46 18v44L60 86 14 74z" opacity=".35"/><path d="M14 30l46 18 46-18 M60 48v38" opacity=".35"/><path d="M36 21l46 18" stroke-dasharray="4 5" opacity=".35"/></svg><h2>${title}</h2><p>${text}</p>${btn}</div>`;
}

/* =====================================================================
   Ansichten
   ===================================================================== */
const V = {};

/* ---------- Start: Karteikasten ---------- */
// Reiter-Positionen springen hin und her, damit sich benachbarte Reiter nicht verdecken
const TABPOS = [0, 34, 12, 40, 4, 26, 18, 38];
function cardStack() {
  return `<div class="kk">${S.rooms.map((room, i) => {
    const items = itemsIn(room.id); const hasLow = items.some(isLow);
    const prev = items.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 3);
    const more = items.length - prev.length;
    return `<a class="kc${TABPOS[i % TABPOS.length] === 0 ? ' t0' : ''}" href="#/room/${room.id}" style="--c:${room.color};--tx:${TABPOS[i % TABPOS.length]}%;z-index:${i + 1}">
      <span class="kc-tab"><span class="kc-ic">${room.icon || '📦'}</span><span class="kc-name">${esc(room.name)}</span></span>
      <span class="kc-line"></span>
      <span class="kc-meta">${items.length ? plural(items.length, 'Ding', 'Dinge') : 'noch leer'}${hasLow ? '<span class="kc-warn">wird knapp</span>' : ''}</span>
      <span class="kc-prev">${prev.length ? prev.map(it => `<span>${esc(it.name)}</span>`).join('') + (more > 0 ? `<span class="more">+${more}</span>` : '') : '<span class="ghost">Tippe, um einzuräumen</span>'}</span>
    </a>`;
  }).join('')}</div>`;
}
V.home = () => {
  if (!S.rooms.length) return V.welcome();
  const nItems = S.items.length, pieces = S.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const low = S.items.filter(isLow).length, lent = S.items.filter(i => i.lentTo).length;
  const lastBk = Number(lsGet('lager.backupAt') || 0);
  const bkDue = nItems >= 10 && Date.now() - lastBk > 30 * 864e5;
  const notes = [
    low ? `<a class="pill" href="#/lists/low"><span class="dot"></span>${plural(low, 'Ding wird', 'Dinge werden')} knapp</a>` : '',
    lent ? `<a class="pill" href="#/lists/lent"><span class="dot lent"></span>${plural(lent, 'Ding', 'Dinge')} verliehen</a>` : '',
    bkDue ? `<a class="pill" href="#/more"><span class="dot bk"></span>Backup machen</a>` : '',
  ].join('');
  const recent = S.items.slice().sort((a, b) => (b.created || 0) - (a.created || 0)).slice(0, 10);
  return {
    tab: 'home',
    html: `
    <header class="top">
      <div class="brand">${LOGO}<h1>Lager</h1></div>
      <div class="sum"><b>${plural(nItems, 'Ding', 'Dinge')}</b>${pieces !== nItems ? `${pieces.toLocaleString('de-AT')} Stück, ` : ''}${plural(S.rooms.length, 'Raum', 'Räume')}</div>
    </header>
    ${installBanner()}
    <a class="tape" href="#/search?focus=1">${I.search}<span class="ph">Wo ist …?</span></a>
    ${notes ? `<div class="notes">${notes}</div>` : ''}
    <div class="plan-head"><h2>Räume</h2><span class="sub">Tippe auf eine Karte</span></div>
    ${cardStack()}
    <button class="annex" data-a="newRoom">${I.plus}Raum hinzufügen</button>
    ${recent.length ? `<div class="section-h"><h2>Zuletzt eingeräumt</h2><a href="#/lists/all">Alle ansehen</a></div>
    <div class="strip">${recent.map(it => { const r = roomById(it.roomId); return `<a class="card-s" href="#/item/${it.id}">${thumb(it)}<b>${esc(it.name)}</b><small>${r?.icon || ''} ${esc(r?.name || '')}</small></a>`; }).join('')}</div>` : ''}
    `,
  };
};

/* ---------- Willkommen ---------- */
let starterPick = new Set(['Keller', 'Küche', 'Werkstatt']);
V.welcome = () => ({
  tab: 'home',
  html: `<div class="welcome">
    <div class="blue"><svg viewBox="0 0 340 170" stroke-linejoin="round">
      <g stroke="currentColor" stroke-width="2.5">
        <path d="M20 38h86v-20a8 8 0 0 1 8-8h70a8 8 0 0 1 8 8v20h128v120H20z" fill="#C9CFD8"/>
        <path d="M20 78h150v-20a8 8 0 0 1 8-8h76a8 8 0 0 1 8 8v20h98v80H20z" fill="#F7B58C"/>
        <path d="M20 118h40v-20a8 8 0 0 1 8-8h96a8 8 0 0 1 8 8v20h188v40H20z" fill="#F2C98A"/>
      </g>
      <g font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="16" fill="#1D2433">
        <text x="122" y="32">Keller</text><text x="190" y="72">Küche</text><text x="78" y="112">Werkstatt</text></g>
      <rect x="244" y="122" width="58" height="26" fill="#FFD23F" transform="rotate(-6 273 135)"/>
      <text x="254" y="140" font-family="Bricolage Grotesque, sans-serif" font-weight="800" font-size="14" fill="#1D2433" transform="rotate(-6 273 135)">hier!</text>
    </svg></div>
    <h1>Wo liegt eigentlich die Bohrmaschine?</h1>
    <p>Leg dir zuerst für jeden Raum eine Karteikarte an: Tippe an, welche Räume es bei dir gibt. Danach räumst du ein, was drinnen liegt – mit Foto und genauem Platz.</p>
    <div class="chips" style="margin-bottom:22px">${STARTER.map(([n, ic, c]) => `<button class="chip" style="--c:${c}" data-a="starter" data-n="${n}" aria-pressed="${starterPick.has(n)}">${ic} ${n}</button>`).join('')}</div>
    <button class="btn primary block" data-a="createStarter" ${starterPick.size ? '' : 'disabled'}>${starterPick.size ? `${plural(starterPick.size, 'Raum', 'Räume')} anlegen` : 'Räume antippen'}</button>
    <div style="text-align:center;margin-top:8px"><button class="linkbtn" data-a="newRoom">Eigenen Raum anlegen</button> <button class="linkbtn" data-a="importBackup">Backup laden</button></div>
  </div>`,
});

/* ---------- Raum ---------- */
let roomFilter = '';
V.room = (id) => {
  const room = roomById(id); if (!room) return V.missing();
  const items = itemsIn(id);
  const places = [...(room.places || [])];
  for (const it of items) if (it.place && !places.some(p => p.toLowerCase() === it.place.toLowerCase())) places.push(it.place);
  const q = roomFilter;
  const list = q ? search(q, 'all', id).map(x => x.it) : items.slice().sort(byName);
  const groups = places.map(p => ({ p, items: list.filter(it => (it.place || '').toLowerCase() === p.toLowerCase()) }));
  const loose = list.filter(it => !it.place);
  if (loose.length || (!places.length && !q)) groups.push({ p: '', items: loose });
  const shown = q ? groups.filter(g => g.items.length) : groups;
  const nPlaces = places.length;
  const body = !items.length && !places.length
    ? emptyBox(`${esc(room.name)} ist noch leer`, `Tippe unten auf das gelbe Plus, um das erste Ding in ${esc(room.name)} einzuräumen. Mit „Platz“ gibst du an, wo genau: Regal, Kiste, Lade …`, `<button class="btn primary" data-a="addItem" data-room="${id}">${I.plus}Erstes Ding einräumen</button>`)
    : (q && !shown.length ? `<p class="count">Nichts in ${esc(room.name)} passt zu „${esc(q)}“.</p>` : '') +
      shown.map(g => `<section class="shelf">
        <div class="shelf-h"><h2 class="${g.p ? '' : 'none'}">${g.p ? esc(g.p) : 'Ohne festen Platz'}</h2><span class="n">${g.items.length}</span>
          ${g.p ? `<button data-a="placeMenu" data-room="${id}" data-place="${esc(g.p)}" aria-label="Platz ${esc(g.p)} bearbeiten">${I.dots}</button>` : ''}
        </div>
        ${g.items.length ? `<ul class="list">${g.items.map(it => itemRow(it, { inRoom: true, q })).join('')}</ul>` : `<p class="sub" style="margin:0 2px">Hier liegt noch nichts. <button class="linkbtn" style="padding:0" data-a="addItem" data-room="${id}" data-place="${esc(g.p)}">Etwas hineinlegen</button></p>`}
      </section>`).join('');
  return {
    tab: 'home', addRoom: id,
    html: `<header class="hero" style="--c:${room.color}">
      <div class="bar"><a class="icbtn" href="#/" aria-label="Zurück zu den Räumen">${I.back}</a>
        <div class="bar-r"><button class="icbtn" data-a="shareRoom" data-id="${id}" aria-label="Inhaltsliste teilen">${I.share}</button><button class="icbtn" data-a="editRoom" data-id="${id}" aria-label="Raum bearbeiten">${I.edit}</button></div></div>
      <div class="h-ic">${room.icon || '📦'}</div>
      <h1>${esc(room.name)}</h1>
      <p>${items.length ? plural(items.length, 'Ding', 'Dinge') : 'Noch nichts eingeräumt'}${nPlaces ? ` an ${plural(nPlaces, 'Platz', 'Plätzen')}` : ''}</p>
    </header>
    ${items.length > 6 ? `<label class="field-search">${I.search}<input id="roomQ" type="search" placeholder="In ${esc(room.name)} suchen" value="${esc(q)}" autocomplete="off"></label>` : ''}
    <div id="roomBody">${body}</div>`,
    after() {
      const inp = $('#roomQ');
      if (inp) inp.addEventListener('input', () => {
        roomFilter = inp.value; const pos = inp.selectionStart;
        rerender(); const n = $('#roomQ'); if (n) { n.focus(); n.setSelectionRange(pos, pos); }
      });
    },
  };
};

/* ---------- Artikel ---------- */
V.item = (id) => {
  const it = itemById(id); if (!it) return V.missing();
  const room = roomById(it.roomId);
  const qty = Number(it.qty ?? 1);
  const photos = it.photos || [];
  return {
    tab: 'home',
    html: `<div class="pagebar"><button class="icbtn" data-a="goBack" aria-label="Zurück">${I.back}</button><h1></h1><a class="icbtn" href="#/edit/${id}" aria-label="Bearbeiten">${I.edit}</a></div>
    ${photos.length
      ? `<div class="gal${photos.length > 1 ? ' multi' : ''}">${photos.map((p, i) => `<button class="ph" data-a="viewItem" data-id="${id}" data-i="${i}" aria-label="Foto ${i + 1} groß anzeigen"><img data-ph="${p}" data-kind="full" alt="Foto von ${esc(it.name)}"><span class="zoom-ic">${I.expand}</span></button>`).join('')}</div>`
      : `<div class="noimg" style="--c:${room?.color || '#C9CFD8'}">${esc(it.name.trim().charAt(0).toUpperCase())}<button class="btn" data-a="quickPhoto" data-id="${id}">${I.cam}Foto dazu</button></div>`}
    <h1 class="d-name">${esc(it.name)}</h1>
    <a class="where" href="#/room/${it.roomId}" style="--c:${room?.color || '#C9CFD8'}">
      <div class="w-room"><div class="w-k">Raum</div><div class="w-v">${room?.icon || ''} ${esc(room?.name || 'Ohne Raum')}</div></div>
      <div class="w-place">${I.pin}<div class="w-k">Platz</div><div class="w-v">${it.place ? esc(it.place) : '<span class="muted" style="font-weight:500;font-style:italic">kein fester Platz</span>'}</div></div>
    </a>
    ${it.lentTo ? `<div class="lentbox"><div class="grow"><b>Verliehen an ${esc(it.lentTo)}</b><div class="sub">seit ${fmtDate(it.lentAt)}</div></div><button class="btn" data-a="returned" data-id="${id}">Zurück</button></div>` : ''}
    <div class="facts">
      <div class="fact"><div class="k">Menge</div><div class="stepper${isLow(it) ? ' low' : ''}"><button data-a="qty" data-d="-1" data-id="${id}" aria-label="Weniger">−</button><span class="v">${qty}</span><button data-a="qty" data-d="1" data-id="${id}" aria-label="Mehr">+</button></div></div>
      <div class="fact"><div class="k">Melden ab</div><div class="v">${it.min != null && it.min !== '' ? `≤ ${it.min}` : '<span class="muted" style="font-weight:500;font-size:1rem">nie</span>'}</div></div>
    </div>
    ${it.tags?.length ? `<div class="tags">${it.tags.map(t => `<a class="tag" href="#/search?q=${encodeURIComponent(t)}">#${esc(t)}</a>`).join('')}</div>` : ''}
    ${it.note ? `<div class="note-box">${esc(it.note)}</div>` : ''}
    <div class="actions">
      <button class="act" data-a="moveItem" data-id="${id}">${I.move}Umräumen</button>
      <button class="act" data-a="lendItem" data-id="${id}">${I.lend}${it.lentTo ? 'Zurück' : 'Verleihen'}</button>
      <button class="act" data-a="shareItem" data-id="${id}">${I.share}Teilen</button>
      <button class="act" data-a="dupItem" data-id="${id}">${I.copy}Kopie</button>
    </div>
    <p class="meta">Eingeräumt am ${fmtDate(it.created)}${it.updated && it.updated - it.created > 6e4 ? `, zuletzt geändert am ${fmtDate(it.updated)}` : ''}</p>
    <button class="btn danger block" data-a="delItem" data-id="${id}">${I.trash}Löschen</button>`,
  };
};

/* ---------- Bearbeiten / Neu ---------- */
let F = null; // Formularzustand
const DRAFT = 'lager.draft';
function saveDraft() { if (F) lsSet(DRAFT, JSON.stringify(F)); }
V.edit = (id, q) => {
  const key = id || 'new';
  if (!F || F.key !== key) {
    let draft = null; try { draft = JSON.parse(lsGet(DRAFT) || 'null'); } catch {}
    if (draft && draft.key === key) F = draft;
    else if (id) {
      const it = itemById(id); if (!it) return V.missing();
      F = { key, id, name: it.name, roomId: it.roomId, place: it.place || '', qty: it.qty ?? 1, min: it.min ?? '', tags: (it.tags || []).join(', '), note: it.note || '', lentTo: it.lentTo || '', photos: [...(it.photos || [])], added: [], removed: [] };
    } else {
      F = { key, id: null, name: q.get('name') || '', roomId: q.get('room') || lsGet('lager.lastRoom') || S.rooms[0]?.id || '', place: q.get('place') ?? '', qty: 1, min: '', tags: '', note: '', lentTo: '', photos: [], added: [], removed: [] };
      if (!roomById(F.roomId)) F.roomId = S.rooms[0]?.id || '';
      if (!q.has('place') && q.get('room') == null && F.roomId === lsGet('lager.lastRoom')) F.place = lsGet('lager.lastPlace') || '';
    }
  }
  const isNew = !F.id;
  return {
    noNav: true,
    html: `<div class="pagebar"><button class="icbtn" data-a="cancelEdit" aria-label="Abbrechen">${I.x}</button><h1>${isNew ? 'Einräumen' : 'Bearbeiten'}</h1><span style="width:42px"></span></div>
    <form class="form" id="itemForm" autocomplete="off" novalidate>
      <div class="fl"><span class="lbl">Fotos <span class="hint">optional, bis zu 6</span></span><div class="photos" id="fPhotos"></div></div>
      <div class="fl"><label for="fName">Was ist es?</label><input class="inp big" id="fName" name="name" placeholder="z. B. Akkuschrauber" value="${esc(F.name)}" enterkeyhint="next" required></div>
      <div class="fl"><span class="lbl">In welchem Raum?</span><div class="chip-row" id="fRooms"></div></div>
      <div class="fl"><label for="fPlace">Wo genau? <span class="hint">Regal, Kiste, Lade …</span></label><input class="inp" id="fPlace" name="place" placeholder="z. B. Regal links, oberstes Fach" value="${esc(F.place)}" enterkeyhint="next"><div class="chips" id="fPlaces"></div></div>
      <div class="qtyrow">
        <div class="fl"><label for="fQty">Menge</label><div class="num"><button type="button" data-a="fStep" data-f="qty" data-d="-1" aria-label="Weniger">−</button><input class="inp" id="fQty" name="qty" inputmode="numeric" value="${esc(F.qty)}"><button type="button" data-a="fStep" data-f="qty" data-d="1" aria-label="Mehr">+</button></div></div>
        <div class="fl"><label for="fMin">Melden ab <span class="hint">leer = nie</span></label><input class="inp" id="fMin" name="min" inputmode="numeric" placeholder="z. B. 2" value="${esc(F.min)}"></div>
      </div>
      <div class="fl"><label for="fTags">Schlagworte <span class="hint">mit Komma trennen</span></label><input class="inp" id="fTags" name="tags" placeholder="z. B. Werkzeug, Bosch, Akku" value="${esc(F.tags)}"></div>
      <div class="fl"><label for="fNote">Notiz</label><textarea class="inp" id="fNote" name="note" placeholder="Seriennummer, Kaufdatum, Größe …">${esc(F.note)}</textarea></div>
      <div class="fl"><label for="fLent">Verliehen an <span class="hint">optional</span></label><input class="inp" id="fLent" name="lentTo" placeholder="Name" value="${esc(F.lentTo)}"></div>
      <div class="form-foot">
        ${isNew ? '<button type="button" class="btn ghost" data-a="saveNext">+ Nächstes</button>' : ''}
        <button type="submit" class="btn primary">${isNew ? 'Einräumen' : 'Speichern'}</button>
      </div>
    </form>`,
    after() {
      drawPhotos(); drawRoomChips(); drawPlaceChips();
      const form = $('#itemForm');
      form.addEventListener('input', e => {
        const n = e.target.name; if (!n) return; F[n] = e.target.value; saveDraft();
        if (n === 'place') drawPlaceChips();
      });
      form.addEventListener('submit', e => { e.preventDefault(); saveForm(false); });
      if (isNew && !F.name && !q.has('nofocus')) setTimeout(() => $('#fName')?.focus(), 60);
    },
  };
};
async function drawPhotos() {
  const box = $('#fPhotos'); if (!box) return;
  box.innerHTML = F.photos.map((p, i) => `<div class="pt"><img data-ph="${p}" alt="" data-a="viewForm" data-i="${i}">${i === 0 && F.photos.length > 1 ? '<span class="first">Titelbild</span>' : ''}<button type="button" class="x" data-a="fDelPhoto" data-p="${p}" aria-label="Foto entfernen">✕</button></div>`).join('')
    + (F.photos.length < 6 ? `<button type="button" class="add" data-a="fCam">${I.cam}Kamera</button><button type="button" class="add" data-a="fGallery">${I.img}Galerie</button>` : '');
  hydrate(box);
}
function drawRoomChips() {
  const box = $('#fRooms'); if (!box) return;
  box.innerHTML = S.rooms.map(r => `<button type="button" class="chip${r.id === F.roomId ? ' on' : ''}" style="--c:${r.color}" data-a="fRoom" data-id="${r.id}">${r.icon || ''} ${esc(r.name)}</button>`).join('')
    + `<button type="button" class="chip" data-a="newRoom" data-from="form">${I.plus.replace('<svg', '<svg width="16" height="16" stroke="currentColor" stroke-width="2.4" fill="none"')} Neuer Raum</button>`;
  box.querySelector('.on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
}
function drawPlaceChips() {
  const box = $('#fPlaces'); if (!box) return;
  const room = roomById(F.roomId);
  const all = [...new Set([...(room?.places || []), ...itemsIn(F.roomId).map(i => i.place).filter(Boolean)])];
  const cur = F.place.trim().toLowerCase();
  const list = all.filter(p => p.toLowerCase() !== cur && (!cur || norm(p).includes(norm(cur)))).slice(0, 12);
  box.innerHTML = list.map(p => `<button type="button" class="chip" data-a="fPlace" data-p="${esc(p)}">${esc(p)}</button>`).join('');
}
function readNum(v, def) { const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10); return Number.isFinite(n) ? Math.max(0, n) : def; }
async function saveForm(next) {
  const name = F.name.trim();
  if (!name) { toast('Gib dem Ding einen Namen.'); $('#fName')?.focus(); return; }
  if (!roomById(F.roomId)) { toast('Wähle einen Raum.'); return; }
  const old = F.id ? itemById(F.id) : null;
  const it = {
    ...(old || {}), id: F.id || uid(), name, roomId: F.roomId, place: F.place.trim(),
    qty: readNum(F.qty, 1), min: String(F.min).trim() === '' ? null : readNum(F.min, null),
    tags: F.tags.split(',').map(t => t.trim()).filter(Boolean),
    note: F.note.trim(), photos: F.photos.slice(), created: old?.created || Date.now(),
  };
  const lent = F.lentTo.trim();
  if (lent && lent !== old?.lentTo) { it.lentTo = lent; it.lentAt = Date.now(); }
  if (!lent) { it.lentTo = ''; it.lentAt = null; }
  await saveItem(it);
  for (const p of F.removed) await delPhoto(p);
  lsSet('lager.lastRoom', it.roomId); lsSet('lager.lastPlace', it.place);
  const roomId = it.roomId, place = it.place;
  F = null; lsSet(DRAFT, null);
  if (next) {
    toast(`${name} eingeräumt`);
    location.replace(`#/edit/new?room=${roomId}&place=${encodeURIComponent(place)}&n=${Date.now()}`);
  } else {
    toast(old ? 'Gespeichert' : `${name} liegt jetzt in ${roomById(roomId)?.name}${place ? ' › ' + place : ''}`);
    if (old) history.back(); else location.replace(`#/room/${roomId}`);
  }
}
async function cancelEdit() {
  if (F) { for (const p of F.added) await delPhoto(p); }
  F = null; lsSet(DRAFT, null);
  history.length > 1 ? history.back() : (location.hash = '#/');
}

/* ---------- Suche ---------- */
const SQ = { q: '', filter: 'all', room: '' };
V.search = (_, q) => {
  if (q.has('q')) SQ.q = q.get('q');
  const recent = JSON.parse(lsGet('lager.recent') || '[]');
  const filters = [['all', 'Alles'], ['photo', 'Mit Foto'], ['low', 'Wird knapp'], ['lent', 'Verliehen']];
  return {
    tab: 'search',
    html: `<h1 class="big-h">Wo ist …?</h1>
    <div class="tape tape-search">${I.search}<input id="sq" type="search" placeholder="Name, Schlagwort, Platz …" value="${esc(SQ.q)}" autocomplete="off" enterkeyhint="search" aria-label="Suchen">
      <button class="tbtn" data-a="voice" aria-label="Spracheingabe" ${('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) ? '' : 'hidden'}>${I.mic}</button></div>
    <div class="chip-row">${filters.map(([k, l]) => `<button class="chip${SQ.filter === k ? ' on' : ''}" data-a="sFilter" data-f="${k}">${l}</button>`).join('')}
      ${S.rooms.map(r => `<button class="chip${SQ.room === r.id ? ' on' : ''}" style="--c:${r.color}" data-a="sRoom" data-id="${r.id}">${r.icon || ''} ${esc(r.name)}</button>`).join('')}</div>
    <div id="sres"></div>
    <div id="srecent">${recent.length ? `<div class="section-h" style="margin-top:8px"><h2>Zuletzt gesucht</h2></div><div class="recent">${recent.map(r => `<button class="chip" data-a="sRecent" data-q="${esc(r)}">${esc(r)}</button>`).join('')}</div>` : ''}</div>`,
    after() {
      const inp = $('#sq');
      inp.addEventListener('input', () => { SQ.q = inp.value; drawResults(); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { inp.blur(); rememberSearch(); } });
      drawResults();
      if (q.get('focus')) setTimeout(() => inp.focus(), 80);
    },
  };
};
function rememberSearch() {
  const q = SQ.q.trim(); if (q.length < 2) return;
  const r = JSON.parse(lsGet('lager.recent') || '[]').filter(x => x.toLowerCase() !== q.toLowerCase());
  r.unshift(q); lsSet('lager.recent', JSON.stringify(r.slice(0, 8)));
}
function drawResults() {
  const box = $('#sres'); if (!box) return;
  const active = SQ.q.trim() || SQ.filter !== 'all' || SQ.room;
  $('#srecent').hidden = !!active;
  if (!S.items.length) { box.innerHTML = emptyBox('Noch nichts zum Finden', 'Räume zuerst ein paar Dinge ein – dann findest du sie hier in Sekunden wieder.', `<button class="btn primary" data-a="addItem">${I.plus}Ding einräumen</button>`); return; }
  if (!active) { box.innerHTML = `<p class="count">${plural(S.items.length, 'Ding', 'Dinge')} im Lager. Tippe einfach los – Tippfehler und Mehrzahl sind kein Problem.</p>`; return; }
  const res = search(SQ.q, SQ.filter, SQ.room);
  if (!res.length) {
    box.innerHTML = emptyBox(`Nichts gefunden${SQ.q ? ` für „${esc(SQ.q)}“` : ''}`,
      SQ.filter !== 'all' || SQ.room ? 'Ein Filter ist aktiv. Tippe ihn nochmal an, um überall zu suchen.' : 'Vielleicht heißt es anders? Oder es ist noch nicht eingeräumt.',
      SQ.q.trim() ? `<a class="btn primary" href="#/edit/new?name=${encodeURIComponent(SQ.q.trim())}&nofocus=1">${I.plus}„${esc(SQ.q.trim())}“ einräumen</a>` : '');
    return;
  }
  box.innerHTML = `<p class="count">${plural(res.length, 'Treffer', 'Treffer')}</p><ul class="list">${res.slice(0, 200).map(x => itemRow(x.it, { q: SQ.q })).join('')}</ul>`;
  box.onclick = e => { if (e.target.closest('a.it')) rememberSearch(); };
  hydrate(box);
}

/* ---------- Listen ---------- */
V.lists = (kind = 'low') => {
  const tabs = [['low', 'Wird knapp'], ['lent', 'Verliehen'], ['all', 'Alle A–Z']];
  let html = '';
  if (kind === 'low') {
    const l = S.items.filter(isLow).sort(byName);
    html = l.length ? `<p class="count">Diese Dinge haben ihre Meldemenge erreicht. Praktisch als Einkaufszettel.</p><ul class="list">${l.map(it => itemRow(it)).join('')}</ul><div style="margin-top:16px"><button class="btn block" data-a="shareLow">${I.share}Als Einkaufszettel teilen</button></div>`
      : emptyBox('Alles gut gefüllt', 'Gib bei einem Ding eine Meldemenge an (z. B. Klopapier: 4). Fällt die Menge darunter, landet es hier.');
  } else if (kind === 'lent') {
    const l = S.items.filter(i => i.lentTo).sort((a, b) => (a.lentAt || 0) - (b.lentAt || 0));
    html = l.length ? `<ul class="list">${l.map(it => itemRow(it)).join('')}</ul>`
      : emptyBox('Nichts verliehen', 'Wenn du etwas herborgst, tippe beim Ding auf „Verleihen“. So weißt du immer, wer die Leiter hat.');
  } else {
    const l = S.items.slice().sort(byName); let last = '';
    html = l.length ? l.map(it => { const ch = norm(it.name).charAt(0).toUpperCase() || '#'; const h = ch !== last ? `<div class="section-h" style="margin:18px 2px 8px"><h2>${ch}</h2></div>` : ''; last = ch; return h + `<ul class="list">${itemRow(it)}</ul>`; }).join('')
      : emptyBox('Noch leer', 'Sobald du Dinge einräumst, stehen sie hier alphabetisch.');
  }
  return {
    tab: 'lists',
    html: `<h1 class="big-h">Listen</h1><div class="seg">${tabs.map(([k, l]) => `<button class="${k === kind ? 'on' : ''}" data-a="go" data-h="#/lists/${k}">${l}</button>`).join('')}</div>${html}`,
  };
};

/* ---------- Mehr ---------- */
V.more = () => {
  const theme = lsGet('lager.theme') || 'system';
  const pieces = S.items.reduce((s, i) => s + (Number(i.qty) || 0), 0);
  const nPh = S.items.reduce((s, i) => s + (i.photos?.length || 0), 0);
  const bk = Number(lsGet('lager.backupAt') || 0);
  return {
    tab: 'more',
    html: `<h1 class="big-h">Mehr</h1>
    <div class="group"><div class="stats"><div><b>${S.items.length}</b><span>Dinge</span></div><div><b>${pieces}</b><span>Stück</span></div><div><b>${nPh}</b><span>Fotos</span></div></div></div>
    <div class="group"><h3>Darstellung</h3><div style="padding:6px 16px 14px"><div class="seg" style="margin:0">${[['system', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']].map(([k, l]) => `<button class="${k === theme ? 'on' : ''}" data-a="theme" data-t="${k}">${l}</button>`).join('')}</div></div></div>
    <div class="group"><h3>Räume ordnen</h3><p class="p">Bestimmt die Reihenfolge der Karten auf der Startseite.</p>
      ${S.rooms.length ? S.rooms.map((r, i) => `<div class="order-row"><span class="sw" style="--c:${r.color}"></span><span class="grow">${r.icon || ''} ${esc(r.name)}</span><button data-a="roomUp" data-id="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="Nach vorne">↑</button><button data-a="roomDown" data-id="${r.id}" ${i === S.rooms.length - 1 ? 'disabled' : ''} aria-label="Nach hinten">↓</button></div>`).join('') : '<p class="p">Noch keine Räume.</p>'}
    </div>
    <div class="group"><h3>Datensicherung</h3><p class="p">Alles bleibt nur auf diesem Handy gespeichert. ${bk ? `Letztes Backup: ${fmtDate(bk)}.` : 'Du hast noch kein Backup gemacht.'}</p>
      <button class="gi" data-a="exportBackup">${I.dl}<span class="grow">Backup speichern<small>Eine Datei mit allen Räumen, Dingen und Fotos</small></span></button>
      <button class="gi" data-a="importBackup">${I.ul}<span class="grow">Backup laden<small>Ersetzt die Daten auf diesem Gerät</small></span></button>
    </div>
    <div class="group">
      ${isStandalone() ? '' : `<button class="gi" data-a="installApp">${I.phone}<span class="grow">App installieren<small>Startet dann ohne Browserleiste, auch offline</small></span></button>`}
      <button class="gi danger" data-a="wipe">${I.trash}<span class="grow">Alles löschen</span></button>
    </div>
    <p class="meta" style="text-align:center">Lager ${APP_VER.replace('lager-', '')}${DB.mem ? ' · Vorschau ohne dauerhaften Speicher' : ''}</p>`,
  };
};

V.missing = () => ({ tab: 'home', html: emptyBox('Nicht mehr da', 'Dieses Ding oder dieser Raum wurde gelöscht.', '<a class="btn" href="#/">Zu den Räumen</a>') });

/* =====================================================================
   Router
   ===================================================================== */
const scrollMem = new Map();
let curHash = '';
function parseHash() {
  const h = location.hash.slice(1) || '/'; const [path, qs] = h.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
function render() {
  if (curHash) scrollMem.set(curHash, scrollY);
  const prevView = curHash.split('?')[0].split('/')[1] || '';
  curHash = location.hash || '#/';
  const { parts, q } = parseHash();
  const v = parts[0] || 'home';
  if (v !== 'room' && !(prevView === 'room' && v === 'item')) roomFilter = '';
  // Formular verlassen (z. B. mit der Zurück-Taste) = Entwurf verwerfen
  if (v !== 'edit' && (F || prevView === 'edit')) { F = null; lsSet(DRAFT, null); }
  let out;
  switch (v) {
    case 'room': out = V.room(parts[1]); break;
    case 'item': out = V.item(parts[1]); break;
    case 'edit': out = S.rooms.length ? V.edit(parts[1] === 'new' ? null : parts[1], q) : V.welcome(); break;
    case 'search': out = V.search(null, q); break;
    case 'lists': out = V.lists(parts[1]); break;
    case 'more': out = V.more(); break;
    default: out = V.home();
  }
  $('#view').innerHTML = out.html;
  document.body.classList.toggle('no-nav', !!out.noNav);
  for (const a of $$('.nav-i')) a.classList.toggle('on', a.dataset.tab === out.tab);
  $('.nav-add').dataset.room = out.addRoom || '';
  hydrate($('#view'));
  out.after?.();
  const y = scrollMem.get(curHash);
  window.scrollTo(0, y || 0);
}
function rerender() { const y = scrollY; curHash = ''; render(); window.scrollTo(0, y); }
addEventListener('hashchange', render);

/* =====================================================================
   Sheet, Toast, Rückfrage
   ===================================================================== */
let sheetOpen = false, sheetOnClose = null, popWait = null;
function openSheet(title, body, foot = '', onClose) {
  const sh = $('#sheet');
  $('#sheetTitle').textContent = title; $('.sheet-body', sh).innerHTML = body; $('.sheet-foot', sh).innerHTML = foot;
  sh.hidden = false; hydrate(sh);
  if (!sheetOpen) history.pushState({ sheet: 1 }, '');
  sheetOpen = true; sheetOnClose = onClose || null;
}
function hideSheet() { sheetOpen = false; $('#sheet').hidden = true; const cb = sheetOnClose; sheetOnClose = null; cb?.(); }
function closeSheet() {
  if (!sheetOpen) return Promise.resolve();
  hideSheet();
  if (history.state?.sheet) return new Promise(res => { popWait = res; history.back(); });
  return Promise.resolve();
}
addEventListener('popstate', () => {
  if (popWait) { const r = popWait; popWait = null; r(); return; }
  if (sheetOpen) { hideSheet(); return; }
  if (camOpen) { stopCam(); return; }
  if (viewerOpen) { hideViewer(); }
});
async function go(h) { await closeSheet(); if (location.hash === h) rerender(); else location.hash = h; }

let toastT = null;
function toast(msg, action, fn, ms = 3200) {
  const t = $('#toast'); clearTimeout(toastT);
  t.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action)}</button>` : ''}`;
  t.hidden = false;
  if (action) t.querySelector('button').onclick = () => { t.hidden = true; clearTimeout(toastT); fn?.(); };
  toastT = setTimeout(() => { t.hidden = true; }, ms);
}
function ask(title, text, ok = 'OK', danger = false) {
  return new Promise(res => {
    let done = false;
    openSheet(title, `<p class="muted" style="margin:0">${text}</p>`,
      `<button class="btn ${danger ? 'danger' : 'primary'} block" data-a="askOk">${esc(ok)}</button><button class="btn ghost block" data-a="closeSheet">Abbrechen</button>`,
      () => { if (!done) { done = true; res(false); } });
    askResolve = () => { done = true; res(true); };
  });
}
let askResolve = null;

/* =====================================================================
   Raum anlegen / bearbeiten
   ===================================================================== */
function roomSheet(room, fromForm) {
  const R = room ? { ...room } : { name: '', icon: '📦', color: COLORS[S.rooms.length % COLORS.length][1] };
  const body = () => `<div class="form">
      <div class="fl"><label for="rName">Name</label><input class="inp big" id="rName" value="${esc(R.name)}" placeholder="z. B. Keller" enterkeyhint="done"></div>
      <div class="fl"><span class="lbl">Symbol</span><div class="emojis">${EMOJIS.map(e => `<button type="button" class="${e === R.icon ? 'on' : ''}" data-e="${e}">${e}</button>`).join('')}</div></div>
      <div class="fl"><span class="lbl">Farbe der Karte</span><div class="colors">${COLORS.map(([n, c]) => `<button type="button" class="${c === R.color ? 'on' : ''}" style="--c:${c}" data-c="${c}" aria-label="${n}"></button>`).join('')}</div></div>
    </div>`;
  openSheet(room ? 'Raum bearbeiten' : 'Neuer Raum', body(),
    `<button class="btn primary block" data-a="roomSave">${room ? 'Speichern' : 'Raum anlegen'}</button>${room ? `<button class="btn danger block" data-a="roomDel" data-id="${room.id}">${I.trash}Raum löschen</button>` : ''}`);
  const sh = $('#sheet');
  sh.querySelector('.emojis').onclick = e => { const b = e.target.closest('[data-e]'); if (!b) return; R.icon = b.dataset.e; $$('.emojis button', sh).forEach(x => x.classList.toggle('on', x === b)); };
  sh.querySelector('.colors').onclick = e => { const b = e.target.closest('[data-c]'); if (!b) return; R.color = b.dataset.c; $$('.colors button', sh).forEach(x => x.classList.toggle('on', x === b)); };
  const nm = $('#rName'); nm.oninput = () => { R.name = nm.value; };
  nm.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); actions.roomSave(); } };
  if (!room) setTimeout(() => nm.focus(), 250);
  actions.roomSave = async () => {
    const name = R.name.trim(); if (!name) { nm.focus(); toast('Gib dem Raum einen Namen.'); return; }
    if (S.rooms.some(r => r.id !== R.id && r.name.toLowerCase() === name.toLowerCase())) { toast(`${name} gibt es schon.`); return; }
    const r = room ? { ...room, name, icon: R.icon, color: R.color } : { id: uid(), name, icon: R.icon, color: R.color, places: [], order: S.rooms.length ? Math.max(...S.rooms.map(x => x.order ?? 0)) + 1 : 0, created: Date.now() };
    await saveRoom(r);
    await closeSheet();
    if (fromForm && F) { F.roomId = r.id; F.place = ''; saveDraft(); drawRoomChips(); drawPlaceChips(); const p = $('#fPlace'); if (p) p.value = ''; return; }
    if (room) rerender(); else location.hash = `#/room/${r.id}`;
  };
}

/* =====================================================================
   Kamera (in der App – kein Wechsel in die Kamera-App, damit nichts verloren geht)
   ===================================================================== */
let camOpen = false, camStream = null, camTarget = null;
async function openCam(target) {
  camTarget = target;
  if (!navigator.mediaDevices?.getUserMedia) { $('#fileCam').click(); return; }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } }, audio: false });
  } catch (e) {
    if (e?.name === 'NotAllowedError') toast('Kein Kamerazugriff – öffne die Kamera-App stattdessen.');
    $('#fileCam').click(); return;
  }
  const cam = $('#cam'); cam.hidden = false; camOpen = true;
  const v = $('video', cam); v.srcObject = camStream; v.play().catch(() => {});
  history.pushState({ cam: 1 }, '');
}
function stopCam() {
  camOpen = false; $('#cam').hidden = true;
  camStream?.getTracks().forEach(t => t.stop()); camStream = null;
}
function closeCam() { if (!camOpen) return Promise.resolve(); stopCam(); if (history.state?.cam) return new Promise(res => { popWait = res; history.back(); }); return Promise.resolve(); }
async function camShot() {
  const v = $('#cam video'); if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const cam = $('#cam'); cam.classList.remove('flash'); void cam.offsetWidth; cam.classList.add('flash');
  navigator.vibrate?.(20);
  await closeCam();
  await addPhotoFrom(c);
}
async function addPhotoFrom(src) {
  try {
    const id = await storePhoto(src);
    if (camTarget?.itemId) { // Foto direkt beim Ding
      const it = itemById(camTarget.itemId); if (it) { it.photos = [...(it.photos || []), id]; await saveItem(it); rerender(); }
    } else if (F) {
      F.photos.push(id); F.added.push(id); saveDraft(); drawPhotos();
    }
  } catch { toast('Das Foto konnte nicht gelesen werden.'); }
}
for (const sel of ['#filePick', '#fileCam']) {
  $(sel).addEventListener('change', async e => {
    const files = [...e.target.files]; e.target.value = '';
    for (const f of files) await addPhotoFrom(f);
  });
}
$('#filePick').multiple = true;

/* =====================================================================
   Fotos im Vollbild: wischen, mit zwei Fingern zoomen, doppelt tippen
   ===================================================================== */
let viewerOpen = false;
const Z = { s: 1, x: 0, y: 0 }; // Zoom des aktuellen Fotos
function openViewer(ids, start = 0) {
  if (!ids?.length) return;
  const vw = $('#viewer'), track = $('.vw-track', vw);
  track.innerHTML = ids.map(p => `<div class="vw-slide"><img data-ph="${p}" data-kind="full" alt="" draggable="false"></div>`).join('');
  $('.vw-count', vw).hidden = ids.length < 2;
  vw.hidden = false; viewerOpen = true;
  history.pushState({ viewer: 1 }, '');
  hydrate(vw);
  requestAnimationFrame(() => { track.scrollLeft = start * track.clientWidth; updateCount(); });
}
function hideViewer() {
  viewerOpen = false; $('#viewer').hidden = true; $('.vw-track').innerHTML = ''; resetZoom();
}
function closeViewer() {
  if (!viewerOpen) return Promise.resolve();
  hideViewer();
  if (history.state?.viewer) return new Promise(res => { popWait = res; history.back(); });
  return Promise.resolve();
}
function curSlide() { const t = $('.vw-track'); return t.children[Math.round(t.scrollLeft / Math.max(1, t.clientWidth))]; }
function updateCount() {
  const t = $('.vw-track'), n = t.children.length; if (!n) return;
  $('.vw-count').textContent = `${Math.round(t.scrollLeft / Math.max(1, t.clientWidth)) + 1} / ${n}`;
}
function applyZoom(slide) {
  slide = slide || curSlide(); if (!slide) return;
  const W = slide.clientWidth, H = slide.clientHeight;
  Z.s = Math.min(5, Math.max(1, Z.s));
  Z.x = Math.min(0, Math.max(W - Z.s * W, Z.x)); Z.y = Math.min(0, Math.max(H - Z.s * H, Z.y));
  if (Z.s === 1) { Z.x = 0; Z.y = 0; }
  slide.firstElementChild.style.transform = `translate(${Z.x}px,${Z.y}px) scale(${Z.s})`;
  const zoomed = Z.s > 1.01;
  slide.classList.toggle('zoom', zoomed); $('.vw-track').classList.toggle('locked', zoomed);
}
function resetZoom() {
  Z.s = 1; Z.x = 0; Z.y = 0;
  for (const s of $$('.vw-slide')) { s.classList.remove('zoom'); s.firstElementChild.style.transform = ''; }
  $('.vw-track')?.classList.remove('locked');
}
(() => {
  const track = $('.vw-track');
  let g = null, lastTap = 0, scrollT = null;
  const rel = (slide, t) => { const r = slide.getBoundingClientRect(); return { x: t.clientX - r.left, y: t.clientY - r.top }; };
  track.addEventListener('scroll', () => {
    updateCount();
    clearTimeout(scrollT); scrollT = setTimeout(() => { if (Z.s === 1) resetZoom(); }, 120);
  }, { passive: true });
  track.addEventListener('touchstart', e => {
    const slide = curSlide(); if (!slide) return;
    if (e.touches.length === 2) {
      const a = rel(slide, e.touches[0]), b = rel(slide, e.touches[1]);
      g = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), m0: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, s0: Z.s, x0: Z.x, y0: Z.y };
    } else if (e.touches.length === 1) {
      const p = rel(slide, e.touches[0]);
      g = { type: Z.s > 1.01 ? 'pan' : 'tap', p0: p, x0: Z.x, y0: Z.y, moved: false };
    }
  }, { passive: true });
  track.addEventListener('touchmove', e => {
    if (!g) return; const slide = curSlide(); if (!slide) return;
    if (g.type === 'pinch' && e.touches.length === 2) {
      e.preventDefault();
      const a = rel(slide, e.touches[0]), b = rel(slide, e.touches[1]);
      const d = Math.hypot(a.x - b.x, a.y - b.y), m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const s = Math.min(5, Math.max(1, g.s0 * d / Math.max(1, g.d0)));
      const px = (g.m0.x - g.x0) / g.s0, py = (g.m0.y - g.y0) / g.s0; // Bildpunkt unter den Fingern
      Z.s = s; Z.x = m.x - s * px; Z.y = m.y - s * py; applyZoom(slide);
    } else if (g.type === 'pan' && e.touches.length === 1) {
      e.preventDefault();
      const p = rel(slide, e.touches[0]); g.moved = true;
      Z.x = g.x0 + p.x - g.p0.x; Z.y = g.y0 + p.y - g.p0.y; applyZoom(slide);
    } else if (g.type === 'tap') {
      const p = rel(slide, e.touches[0]); if (Math.hypot(p.x - g.p0.x, p.y - g.p0.y) > 10) g.moved = true;
    }
  }, { passive: false });
  track.addEventListener('touchend', e => {
    if (!g) return;
    if (g.type === 'pinch' && e.touches.length < 2) { if (Z.s < 1.05) resetZoom(); g = e.touches.length === 1 ? { type: 'pan', p0: rel(curSlide(), e.touches[0]), x0: Z.x, y0: Z.y, moved: true } : null; return; }
    if (e.touches.length) return;
    if (!g.moved) {
      const now = Date.now();
      if (now - lastTap < 300) { lastTap = 0; toggleZoomAt(g.p0); } else lastTap = now;
    }
    g = null;
  });
  function toggleZoomAt(p) {
    const slide = curSlide(); if (!slide) return;
    if (Z.s > 1.01) { resetZoom(); return; }
    Z.s = 2.5; Z.x = p.x * (1 - Z.s); Z.y = p.y * (1 - Z.s); applyZoom(slide);
  }
  // Maus/Trackpad (Desktop)
  track.addEventListener('dblclick', e => { const slide = curSlide(); if (slide) toggleZoomAt(rel(slide, e)); });
  track.addEventListener('wheel', e => {
    const slide = curSlide(); if (!slide || !e.ctrlKey && Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    e.preventDefault();
    const p = rel(slide, e), s0 = Z.s, s = Math.min(5, Math.max(1, s0 * Math.exp(-e.deltaY / 300)));
    const px = (p.x - Z.x) / s0, py = (p.y - Z.y) / s0;
    Z.s = s; Z.x = p.x - s * px; Z.y = p.y - s * py; applyZoom(slide);
  }, { passive: false });
  let drag = null;
  track.addEventListener('mousedown', e => { if (Z.s > 1.01) { drag = { x: e.clientX, y: e.clientY, x0: Z.x, y0: Z.y }; e.preventDefault(); } });
  addEventListener('mousemove', e => { if (drag) { Z.x = drag.x0 + e.clientX - drag.x; Z.y = drag.y0 + e.clientY - drag.y; applyZoom(); } });
  addEventListener('mouseup', () => { drag = null; });
  addEventListener('keydown', e => {
    if (!viewerOpen) return;
    const t = $('.vw-track');
    if (e.key === 'Escape') closeViewer();
    if (e.key === 'ArrowRight') { resetZoom(); t.scrollBy({ left: t.clientWidth, behavior: 'smooth' }); }
    if (e.key === 'ArrowLeft') { resetZoom(); t.scrollBy({ left: -t.clientWidth, behavior: 'smooth' }); }
  });
  addEventListener('resize', () => { if (viewerOpen) { resetZoom(); } });
})();

/* =====================================================================
   Backup
   ===================================================================== */
const blobToData = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
const dataToBlob = async d => (await fetch(d)).blob();
async function exportBackup() {
  toast('Backup wird erstellt …', null, null, 10000);
  const photos = {};
  for (const id of await DB.keys('photos')) {
    const p = await DB.get('photos', id);
    if (p) photos[id] = { full: await blobToData(p.full), thumb: p.thumb ? await blobToData(p.thumb) : null };
  }
  const data = { app: 'lager', version: 1, exported: new Date().toISOString(), rooms: S.rooms, items: S.items, photos };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const name = `lager-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([blob], name, { type: 'application/json' });
  let shared = false;
  if (navigator.canShare?.({ files: [file] }) && matchMedia('(pointer:coarse)').matches) {
    try { await navigator.share({ files: [file], title: 'Lager-Backup' }); shared = true; } catch (e) { if (e?.name === 'AbortError') { $('#toast').hidden = true; return; } }
  }
  if (!shared) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  lsSet('lager.backupAt', String(Date.now()));
  toast(`Backup gespeichert (${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB)`);
  rerender();
}
$('#fileBackup').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  let data; try { data = JSON.parse(await f.text()); } catch { toast('Diese Datei ist kein Lager-Backup.'); return; }
  if (data?.app !== 'lager' || !Array.isArray(data.rooms) || !Array.isArray(data.items)) { toast('Diese Datei ist kein Lager-Backup.'); return; }
  const ok = await ask('Backup laden?', `Das Backup enthält ${plural(data.rooms.length, 'Raum', 'Räume')} und ${plural(data.items.length, 'Ding', 'Dinge')}. Was jetzt auf diesem Gerät ist, wird ersetzt.`, 'Backup laden', true);
  if (!ok) return;
  await closeSheet();
  toast('Backup wird geladen …', null, null, 20000);
  for (const s of ['rooms', 'items', 'photos']) await DB.clear(s);
  for (const k of [...urlCache.values()]) URL.revokeObjectURL(k); urlCache.clear();
  for (const r of data.rooms) await DB.put('rooms', r);
  for (const it of data.items) await DB.put('items', it);
  for (const [id, p] of Object.entries(data.photos || {})) {
    try {
      const full = await dataToBlob(p.full);
      const th = p.thumb ? await dataToBlob(p.thumb) : await toBlob(await decode(full), 360, .78, true);
      await DB.put('photos', { id, full, thumb: th });
    } catch {}
  }
  await loadAll();
  toast(`Backup geladen: ${plural(S.items.length, 'Ding', 'Dinge')}`);
  location.hash = '#/'; rerender();
});

/* =====================================================================
   Teilen
   ===================================================================== */
async function shareText(title, text) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast('In die Zwischenablage kopiert'); } catch { toast('Teilen ist hier nicht möglich.'); }
}

/* =====================================================================
   Aktionen (Klicks über data-a)
   ===================================================================== */
const actions = {
  closeSheet: () => closeSheet(),
  askOk: async () => { const r = askResolve; askResolve = null; sheetOnClose = null; await closeSheet(); r?.(); },
  go: el => go(el.dataset.h),
  goBack: () => history.length > 1 ? history.back() : (location.hash = '#/'),

  starter: el => { const n = el.dataset.n; starterPick.has(n) ? starterPick.delete(n) : starterPick.add(n); rerender(); },
  createStarter: async () => {
    let o = 0;
    for (const [n, ic, c] of STARTER) if (starterPick.has(n)) await saveRoom({ id: uid(), name: n, icon: ic, color: c, places: [], order: o++, created: Date.now() });
    toast('Räume angelegt. Jetzt einräumen!'); rerender();
  },
  newRoom: el => roomSheet(null, el.dataset.from === 'form'),
  editRoom: el => roomSheet(roomById(el.dataset.id)),
  roomDel: async el => {
    const r = roomById(el.dataset.id); const n = itemsIn(r.id).length;
    await closeSheet();
    const ok = await ask(`${r.name} löschen?`, n ? `Damit werden auch ${plural(n, 'Ding', 'Dinge')} samt Fotos gelöscht. Tipp: Vorher umräumen, falls du sie behalten willst.` : 'Der Raum ist leer.', n ? `Raum und ${plural(n, 'Ding', 'Dinge')} löschen` : 'Raum löschen', true);
    if (!ok) return;
    await closeSheet();
    for (const it of itemsIn(r.id)) await removeItem(it.id);
    await DB.del('rooms', r.id); S.rooms = S.rooms.filter(x => x.id !== r.id);
    toast(`${r.name} gelöscht`); location.hash = '#/';
  },
  roomUp: el => moveRoom(el.dataset.id, -1),
  roomDown: el => moveRoom(el.dataset.id, 1),
  shareRoom: el => {
    const r = roomById(el.dataset.id); const items = itemsIn(r.id).sort(byName);
    const groups = {}; for (const it of items) (groups[it.place || 'Ohne festen Platz'] ||= []).push(it);
    const text = `${r.icon || ''} ${r.name}\n\n` + Object.entries(groups).map(([p, l]) => `${p}\n` + l.map(it => `  • ${it.name}${Number(it.qty) !== 1 ? ` (${it.qty})` : ''}`).join('\n')).join('\n\n');
    shareText(`Inhalt: ${r.name}`, text);
  },
  placeMenu: el => {
    const room = roomById(el.dataset.room), p = el.dataset.place;
    openSheet(p, `<div class="fl"><label for="pName">Name des Platzes</label><input class="inp" id="pName" value="${esc(p)}"></div>`,
      `<button class="btn primary block" data-a="placeRename">Umbenennen</button><button class="btn block" data-a="addItem" data-room="${room.id}" data-place="${esc(p)}">${I.plus}Ding hier einräumen</button><button class="btn danger block" data-a="placeDel">Platz entfernen</button>`);
    actions.placeRename = async () => {
      const nn = $('#pName').value.trim(); if (!nn || nn === p) { closeSheet(); return; }
      for (const it of itemsIn(room.id)) if ((it.place || '').toLowerCase() === p.toLowerCase()) { it.place = nn; await saveItem(it); }
      room.places = (room.places || []).map(x => x.toLowerCase() === p.toLowerCase() ? nn : x).filter((x, i, a) => a.findIndex(y => y.toLowerCase() === x.toLowerCase()) === i);
      await saveRoom(room); await closeSheet(); toast(`Umbenannt in ${nn}`); rerender();
    };
    actions.placeDel = async () => {
      const n = itemsIn(room.id).filter(it => (it.place || '').toLowerCase() === p.toLowerCase());
      for (const it of n) { it.place = ''; await saveItem(it); }
      room.places = (room.places || []).filter(x => x.toLowerCase() !== p.toLowerCase());
      await saveRoom(room); await closeSheet();
      toast(n.length ? `${plural(n.length, 'Ding liegt', 'Dinge liegen')} jetzt ohne festen Platz` : 'Platz entfernt'); rerender();
    };
  },

  addItem: async el => {
    if (!S.rooms.length) { await go('#/'); toast('Leg zuerst einen Raum an.'); return; }
    const room = el.dataset.room || $('.nav-add').dataset.room || '';
    const qs = new URLSearchParams(); if (room) qs.set('room', room); if (el.dataset.place != null && el.dataset.place !== '') qs.set('place', el.dataset.place);
    else if (room) qs.set('place', '');
    qs.set('n', Date.now());
    F = null; lsSet(DRAFT, null);
    go('#/edit/new?' + qs);
  },
  cancelEdit: () => cancelEdit(),
  saveNext: () => saveForm(true),
  fRoom: el => { F.roomId = el.dataset.id; if (!(roomById(F.roomId).places || []).includes(F.place)) { F.place = ''; $('#fPlace').value = ''; } saveDraft(); drawRoomChips(); drawPlaceChips(); },
  fPlace: el => { F.place = el.dataset.p; $('#fPlace').value = F.place; saveDraft(); drawPlaceChips(); },
  fStep: el => { const k = el.dataset.f; F[k] = Math.max(0, readNum(F[k], 0) + Number(el.dataset.d)); $('#fQty').value = F[k]; saveDraft(); },
  fCam: () => { saveDraft(); openCam(null); },
  fGallery: () => { saveDraft(); camTarget = null; $('#filePick').click(); },
  fDelPhoto: el => { const p = el.dataset.p; F.photos = F.photos.filter(x => x !== p); if (F.added.includes(p)) { F.added = F.added.filter(x => x !== p); delPhoto(p); } else F.removed.push(p); saveDraft(); drawPhotos(); },
  quickPhoto: el => openCam({ itemId: el.dataset.id }),
  viewItem: el => openViewer(itemById(el.dataset.id)?.photos, Number(el.dataset.i) || 0),
  viewForm: el => openViewer(F?.photos, Number(el.dataset.i) || 0),
  closeViewer: () => closeViewer(),
  camClose: () => closeCam(),
  camShot: () => camShot(),
  camGallery: async () => { await closeCam(); $('#filePick').click(); },

  qty: async el => {
    const it = itemById(el.dataset.id); it.qty = Math.max(0, Number(it.qty ?? 1) + Number(el.dataset.d));
    await saveItem(it); rerender();
    if (isLow(it) && el.dataset.d === '-1') toast(`${it.name} wird knapp – steht jetzt auf der Liste`);
  },
  delItem: async el => {
    const it = itemById(el.dataset.id); const copy = { ...it };
    await removeItem(it.id, true);
    history.length > 1 ? history.back() : (location.hash = `#/room/${copy.roomId}`);
    let undone = false;
    toast(`${copy.name} gelöscht`, 'Rückgängig', async () => { undone = true; await saveItem(copy); rerender(); }, 6000);
    setTimeout(async () => { if (!undone) for (const p of copy.photos || []) await delPhoto(p); }, 6500);
  },
  dupItem: async el => {
    const it = itemById(el.dataset.id);
    const c = { ...it, id: uid(), name: it.name + ' (Kopie)', photos: [], created: Date.now(), lentTo: '', lentAt: null };
    await saveItem(c); toast('Kopie angelegt – ohne Fotos'); location.hash = `#/edit/${c.id}`;
  },
  moveItem: el => {
    const it = itemById(el.dataset.id); let roomId = it.roomId;
    const draw = () => `<div class="pick" id="mvRooms">${S.rooms.map(r => `<button class="${r.id === roomId ? 'on' : ''}" style="--c:${r.color}" data-id="${r.id}"><span class="sw"></span>${r.icon || ''} ${esc(r.name)}</button>`).join('')}</div>
      <div class="fl" style="margin-top:16px"><label for="mvPlace">Wo genau?</label><input class="inp" id="mvPlace" value="${esc(roomId === it.roomId ? it.place || '' : '')}" placeholder="z. B. Kiste 3"><div class="chips" id="mvPlaces"></div></div>`;
    openSheet(`${it.name} umräumen`, draw(), `<button class="btn primary block" data-a="moveSave">Hierher umräumen</button>`);
    const chips = () => { const r = roomById(roomId); $('#mvPlaces').innerHTML = [...new Set([...(r.places || []), ...itemsIn(roomId).map(i => i.place).filter(Boolean)])].slice(0, 12).map(p => `<button type="button" class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join(''); };
    const wire = () => {
      $('#mvRooms').onclick = e => { const b = e.target.closest('[data-id]'); if (!b) return; roomId = b.dataset.id; $$('#mvRooms button').forEach(x => x.classList.toggle('on', x === b)); $('#mvPlace').value = roomId === it.roomId ? it.place || '' : ''; chips(); };
      $('#mvPlaces').onclick = e => { const b = e.target.closest('[data-p]'); if (b) $('#mvPlace').value = b.dataset.p; };
      chips();
    };
    wire();
    actions.moveSave = async () => { it.roomId = roomId; it.place = $('#mvPlace').value.trim(); await saveItem(it); await closeSheet(); toast(`Liegt jetzt in ${where(it)}`); rerender(); };
  },
  lendItem: el => {
    const it = itemById(el.dataset.id);
    if (it.lentTo) return actions.returned(el);
    const people = [...new Set(S.items.map(i => i.lentTo).filter(Boolean))];
    openSheet(`${it.name} verleihen`, `<div class="fl"><label for="lnName">An wen?</label><input class="inp" id="lnName" placeholder="Name"><div class="chips">${people.map(p => `<button type="button" class="chip" data-p="${esc(p)}">${esc(p)}</button>`).join('')}</div></div>`,
      `<button class="btn primary block" data-a="lendSave">Verleihen</button>`);
    $('#sheet .chips').onclick = e => { const b = e.target.closest('[data-p]'); if (b) $('#lnName').value = b.dataset.p; };
    setTimeout(() => $('#lnName')?.focus(), 250);
    actions.lendSave = async () => { const n = $('#lnName').value.trim(); if (!n) { $('#lnName').focus(); return; } it.lentTo = n; it.lentAt = Date.now(); await saveItem(it); await closeSheet(); toast(`An ${n} verliehen`); rerender(); };
  },
  returned: async el => { const it = itemById(el.dataset.id); const who = it.lentTo; it.lentTo = ''; it.lentAt = null; await saveItem(it); toast(`Von ${who} zurückbekommen`); rerender(); },
  shareItem: el => { const it = itemById(el.dataset.id); shareText(it.name, `${it.name}${Number(it.qty) !== 1 ? ` (${it.qty} Stück)` : ''} liegt in ${where(it)}.`); },
  shareLow: () => { const l = S.items.filter(isLow).sort(byName); shareText('Einkaufszettel', 'Einkaufszettel\n\n' + l.map(i => `☐ ${i.name}`).join('\n')); },

  sFilter: el => { const f = el.dataset.f; SQ.filter = SQ.filter === f && f !== 'all' ? 'all' : f; $$('[data-a="sFilter"]').forEach(b => b.classList.toggle('on', b.dataset.f === SQ.filter)); drawResults(); },
  sRoom: el => { SQ.room = SQ.room === el.dataset.id ? '' : el.dataset.id; $$('[data-a="sRoom"]').forEach(b => b.classList.toggle('on', b.dataset.id === SQ.room)); drawResults(); },
  sRecent: el => { SQ.q = el.dataset.q; $('#sq').value = SQ.q; drawResults(); },
  voice: el => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return;
    const r = new SR(); r.lang = 'de-AT'; r.interimResults = true; r.maxAlternatives = 1;
    el.classList.add('on');
    r.onresult = e => { const t = [...e.results].map(x => x[0].transcript).join(' ').replace(/^(wo ist|wo sind|wo liegt|wo liegen)\s+(der|die|das|mein|meine)?\s*/i, '').replace(/[?.!]$/, ''); SQ.q = t; $('#sq').value = t; drawResults(); };
    r.onend = () => { el.classList.remove('on'); rememberSearch(); };
    r.onerror = () => { el.classList.remove('on'); toast('Spracheingabe nicht verfügbar'); };
    try { r.start(); } catch { el.classList.remove('on'); }
  },

  theme: el => { const t = el.dataset.t; lsSet('lager.theme', t === 'system' ? null : t); if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; setThemeColor(); rerender(); },
  exportBackup: () => exportBackup(),
  importBackup: () => $('#fileBackup').click(),
  wipe: async () => {
    const ok = await ask('Wirklich alles löschen?', 'Alle Räume, Dinge und Fotos auf diesem Gerät werden gelöscht. Das lässt sich nicht rückgängig machen – mach vorher ein Backup.', 'Alles löschen', true);
    if (!ok) return; await closeSheet();
    for (const s of ['rooms', 'items', 'photos']) await DB.clear(s);
    S.rooms = []; S.items = []; urlCache.clear(); location.hash = '#/'; rerender(); toast('Alles gelöscht');
  },
  installApp: async () => {
    if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r?.outcome === 'accepted') toast('Wird installiert …'); rerender(); return; }
    openSheet('App installieren', `<ol style="padding-left:20px;line-height:1.8;margin-top:0"><li>Rechts oben im Browser auf <b>⋮</b> tippen</li><li><b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> wählen</li><li>Bestätigen – fertig. Lager liegt dann am Startbildschirm und öffnet ohne Browserleiste.</li></ol><p class="sub">Am besten in Chrome öffnen.</p>`, `<button class="btn block" data-a="installHide">Nicht mehr anzeigen</button>`);
  },
  installHide: async () => { lsSet('lager.installHide', '1'); await closeSheet(); rerender(); },
};
async function moveRoom(id, d) {
  const i = S.rooms.findIndex(r => r.id === id), j = i + d; if (j < 0 || j >= S.rooms.length) return;
  const a = S.rooms[i], b = S.rooms[j];
  S.rooms.forEach((r, k) => { r.order = k; });
  [a.order, b.order] = [b.order, a.order];
  for (const r of S.rooms) await DB.put('rooms', r);
  S.rooms.sort((x, y) => x.order - y.order); rerender();
}
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  const fn = actions[el.dataset.a]; if (!fn) return;
  e.preventDefault(); fn(el, e);
});

/* =====================================================================
   Installation & Updates
   ===================================================================== */
let installEvt = null;
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if ((parseHash().parts[0] || 'home') === 'home') rerender(); });
addEventListener('appinstalled', () => { installEvt = null; lsSet('lager.installHide', '1'); toast('Installiert – ab jetzt über das Symbol am Startbildschirm öffnen'); rerender(); });
function installBanner() {
  if (isStandalone() || lsGet('lager.installHide') || !/^https?:/.test(location.protocol) || !S.rooms.length) return '';
  return `<div class="inst"><div class="grow"><b>Als App installieren</b><small>Ohne Browserleiste, funktioniert offline.</small></div><button class="btn primary" data-a="installApp">Installieren</button><button class="x" data-a="installHide" aria-label="Ausblenden">✕</button></div>`;
}
function setThemeColor() {
  const t = document.documentElement.dataset.theme;
  const dark = t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name=theme-color]').content = dark ? '#121722' : '#F3F5F0';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', setThemeColor);
function setupSW() {
  if (!('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('sw.js?v=' + APP_VER.replace('lager-', '')).then(reg => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing; if (!nw || !navigator.serviceWorker.controller) return;
      nw.addEventListener('statechange', () => { if (nw.state === 'activated') toast('Neue Version da', 'Neu laden', () => location.reload(), 12000); });
    });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {});
}

/* ---------------- Aufräumen: verwaiste Fotos ---------------- */
async function cleanupPhotos() {
  const used = new Set(S.items.flatMap(i => i.photos || []));
  try { const d = JSON.parse(lsGet(DRAFT) || 'null'); (d?.photos || []).forEach(p => used.add(p)); } catch {}
  for (const id of await DB.keys('photos')) if (!used.has(id)) await DB.del('photos', id);
}

/* ---------------- Start ---------------- */
(async () => {
  await DB.open();
  await loadAll();
  setThemeColor();
  // Hat Android die App beim Fotografieren beendet, steht die Adresse noch auf #/edit –
  // V.edit holt dann den Entwurf aus dem Speicher.
  if (!location.hash.startsWith('#/edit')) lsSet(DRAFT, null);
  render();
  setupSW();
  setTimeout(() => cleanupPhotos().catch(() => {}), 3000);
})();
