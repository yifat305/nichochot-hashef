/* ============================================================
   טופס ההזמנה.

   תמחור:
   • חבילה                     → מחיר לסועד × מספר סועדים
   • פריט extra בקבוצת pick    → תוספת לסועד
   • תוספת תוכנית (שתייה חריפה) → תוספת לסועד
   • קבוצת qty (פתיחה/קינוח)   → מחיר ליחידה × כמות
   ============================================================ */

const state = {
  program: 'weekday',
  guests: 30,
  pkg: 2,
  picks: {},                  /* key → Set   (mode pick / all) */
  qty:   {},                  /* key → {id:n} (mode qty) */
  addons: new Set(),
  table: { mode: 'preset', preset: null, colors: new Set(), text: '' },
};

const prog   = () => PROGRAMS[state.program];
const money  = n => n.toLocaleString('he-IL') + ' ' + CURRENCY;
const pkgOf  = () => prog().packages.find(p => p.id === state.pkg) || prog().packages[0];
const itemOf = (key, id) => MENU[key].find(i => i.id === id);
const qtyOf  = (key, id) => state.qty[key]?.[id] || 0;

/* ---------- אתחול בחירות לפי התוכנית ---------- */
function initSelections() {
  state.picks = {};
  state.qty = {};
  prog().groups.forEach(g => {
    if (g.mode === 'qty' || g.mode === 'bottles') state.qty[g.key] = {};
    else if (g.mode === 'all') state.picks[g.key] = new Set(MENU[g.key].map(i => i.id));
    else state.picks[g.key] = new Set();
  });
  if (!prog().packages.some(p => p.id === state.pkg)) state.pkg = prog().packages[0].id;
}

/* ---------- חישוב ---------- */
function perGuestExtras() {
  let sum = 0;
  prog().groups.forEach(g => {
    if (g.mode === 'qty' || g.mode === 'bottles') return;
    state.picks[g.key].forEach(id => { sum += itemOf(g.key, id).extra || 0; });
  });
  prog().addons.forEach(a => { if (state.addons.has(a.id)) sum += a.price; });
  return sum;
}

function unitExtras() {
  let sum = 0;
  prog().groups.filter(g => g.mode === 'qty').forEach(g =>
    Object.entries(state.qty[g.key]).forEach(([id, q]) => {
      sum += (itemOf(g.key, id).extra || 0) * q;
    }));
  return sum;
}

function totals() {
  const base = pkgOf().price;
  const per = base + perGuestExtras();
  const units = unitExtras();
  return { base, per, units, total: per * state.guests + units };
}

/* ---------- עזר ---------- */
function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

const media = it => it.img
  ? `<span class="item-img">
       <img src="${it.img}" alt="${it.name}" loading="lazy">
       <span class="zoom" role="button" tabindex="0" data-zoom="${it.id}"
             aria-label="הגדלת התמונה של ${it.name}">
         <svg viewBox="0 0 24 24" aria-hidden="true">
           <circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 L21 21"/>
           <path d="M10.5 7.5v6M7.5 10.5h6"/>
         </svg>
       </span>
     </span>`
  : `<span class="item-img item-noimg" aria-hidden="true"><i>${it.name}</i></span>`;

const body = it => `${media(it)}
  <span class="item-t">${it.name}</span>
  ${it.note ? `<span class="item-n">${it.note}</span>` : ''}`;

/* div ולא button — כדי שאפשר יהיה לקנן בתוכו את כפתור ההגדלה */
function pickCard(key, it) {
  const b = el('div', 'item');
  b.setAttribute('role', 'button');
  b.tabIndex = 0;
  b.dataset.grp = key;
  b.dataset.id = it.id;
  b.innerHTML = `${body(it)}
    ${it.extra ? `<span class="item-x">+${money(it.extra)} לסועד</span>` : ''}
    <span class="item-tick" aria-hidden="true"></span>`;
  return b;
}

/* שורת בקבוקים — לאורך, עם מונה כמות */
function bottleRow(key, it) {
  const r = el('div', 'brow' + (it.unlimited ? ' brow-free on' : ''));
  r.dataset.grp = key;
  r.dataset.id = it.id;
  r.innerHTML = `
    <span class="brow-l">
      <b>${it.name}</b>
      ${it.note ? `<i>${it.note}</i>` : ''}
    </span>
    ${it.unlimited
      ? `<span class="brow-un">ללא הגבלה</span>`
      : `<span class="qty">
          <button type="button" class="qty-b" data-step="-1" aria-label="פחות ${it.name}">−</button>
          <b class="qty-n">0</b>
          <button type="button" class="qty-b" data-step="1" aria-label="עוד ${it.name}">+</button>
        </span>`}`;
  return r;
}

/* מכסה: בקבוק לכל 4 סועדים + ספייר */
const bottlesNeeded = () => Math.ceil(state.guests / GUESTS_PER_BOTTLE);
const bottlesMax    = () => bottlesNeeded() + BOTTLE_SPARE;
const bottlesChosen = () =>
  Object.values(state.qty.drinks || {}).reduce((a, b) => a + b, 0);

/* כשמורידים סועדים המכסה מצטמצמת — מגלחים מהסוף עד שנכנסים בה */
function clampBottles() {
  const q = state.qty.drinks;
  if (!q) return;
  let over = bottlesChosen() - bottlesMax();
  if (over <= 0) return;
  const ids = MENU.drinks.filter(i => !i.unlimited).map(i => i.id).reverse();
  for (const id of ids) {
    if (over <= 0) break;
    const take = Math.min(q[id] || 0, over);
    if (!take) continue;
    q[id] -= take;
    over -= take;
    if (!q[id]) delete q[id];
  }
}

/* מנה לכל סועד + ספייר */
const dessertQty = () => state.guests + DESSERT_SPARE;
const suggestQty = key => key === 'dessert' ? dessertQty() : state.guests;

function qtyCard(key, it) {
  const d = el('div', 'item item-q');
  d.dataset.grp = key;
  d.dataset.id = it.id;
  d.innerHTML = `
    <span class="item-hit" role="button" tabindex="0" aria-label="${it.name} — הוספה לכמות הסועדים">${body(it)}</span>
    <span class="item-x">+${money(it.extra)} ליחידה</span>
    <span class="qty">
      <button type="button" class="qty-b" data-step="-1" aria-label="פחות ${it.name}">−</button>
      <b class="qty-n">0</b>
      <button type="button" class="qty-b" data-step="1" aria-label="עוד ${it.name}">+</button>
    </span>`;
  return d;
}

/* ---------- מקטע התפריט ---------- */
function buildMenu() {
  const host = document.getElementById('menuHost');
  host.textContent = '';

  prog().groups.forEach(g => {
    const box = el('div', 'grp');
    if (g.needs) box.dataset.needs = g.needs;

    if (g.meal) box.appendChild(el('h2', 'meal-title', g.meal));

    /* frac מבודד ל-LTR — אחרת המכסה מוצגת לפני הכמות שנבחרה */
    const badge = g.mode === 'pick'    ? `<em data-count="${g.key}"><span class="frac">0 / ${g.pick}</span></em>`
                : g.mode === 'all'     ? `<em class="opt">הכל כלול</em>`
                : g.mode === 'bottles' ? `<em data-bottles><span class="frac">0 / 0</span> בקבוקים</em>`
                :                        `<em class="opt">רשות · לפי כמות</em>`;
    box.appendChild(el('h3', 'grp-title', `${g.label} ${badge}`));

    if (g.key === 'dessert') {
      box.appendChild(el('div', 'brow-head', `
        <p>מנה לכל סועד <b>+ ${DESSERT_SPARE} ספייר</b>.
           לפי <b data-guestn>${state.guests}</b> סועדים —
           <b data-dessn>${dessertQty()}</b> מנות. לחיצה על תמונה ממלאת את הכמות.</p>
      `));
    }

    if (g.mode === 'bottles') {
      box.appendChild(el('div', 'brow-head', `
        <p>בקבוק אחד לכל ${GUESTS_PER_BOTTLE} סועדים <b>+ ${BOTTLE_SPARE} ספייר</b>.
           לפי <b data-guestn>${state.guests}</b> סועדים —
           עד <b data-need>${bottlesMax()}</b> בקבוקים.</p>
        <button type="button" class="spread" data-spread>פיזור שווה</button>
      `));
    }

    const grid = el('div', g.mode === 'bottles' ? 'brows' : 'items');
    grid.dataset.grp = g.key;
    MENU[g.key].forEach(it =>
      grid.appendChild(g.mode === 'bottles' ? bottleRow(g.key, it)
                     : g.mode === 'qty'     ? qtyCard(g.key, it)
                     : pickCard(g.key, it)));
    box.appendChild(grid);

    if (g.mode === 'pick' && MENU[g.key].length < g.pick) {
      box.appendChild(el('p', 'warn',
        `בקטגוריה זו יש ${MENU[g.key].length} פריטים בלבד — נדרשות ${g.pick} בחירות.`));
    }
    host.appendChild(box);
  });

  /* תוספות התוכנית */
  const addons = prog().addons;
  if (addons.length) {
    host.appendChild(el('h3', 'grp-title', `תוספות <em class="opt">לסועד</em>`));
    const row = el('div', 'addons');
    addons.forEach(a => {
      const b = el('button', 'addon');
      b.type = 'button';
      b.dataset.addon = a.id;
      b.innerHTML = `<span class="addon-n">${a.name}</span>
        <span class="addon-p">+${money(a.price)} לסועד</span>
        <span class="item-tick" aria-hidden="true"></span>`;
      row.appendChild(b);
    });
    host.appendChild(row);
  }
}

/* ---------- מקטע החבילות ---------- */
function buildPacks() {
  const host = document.getElementById('packHost');
  host.textContent = '';
  const p = prog();

  /* קבוצות qty הן בתשלום, וקבוצות needs מיוצגות כבר בשורת השירות */
  const list = p.groups
    .filter(g => g.mode !== 'qty' && !g.needs)
    .map(g => g.mode === 'pick' ? `${g.pick} ${g.label}` : g.label);

  const packs = el('div', 'packs');
  p.packages.forEach(pk => {
    const card = el('button', 'pack');
    card.type = 'button';
    card.dataset.pkg = pk.id;
    card.innerHTML = `
      <span class="pack-n">${pk.name}</span>
      <span class="pack-p"><b>${money(pk.price)}</b><i>לסועד</i></span>
      <ul class="pack-l">
        ${[...new Set(list)].map(x => `<li class="yes">${x}</li>`).join('')}
        <li class="${pk.waiters ? 'yes' : 'no'}">שירות מלצרים</li>
        <li class="${pk.drinks  ? 'yes' : 'no'}">שירות שתייה</li>
        <li class="${pk.setting ? 'yes' : 'no'}">עריכת שולחן${pk.setting ? ' ' + pk.setting : ''}</li>
      </ul>`;
    packs.appendChild(card);
  });
  host.appendChild(packs);
}

/* ---------- בנייה ראשונית ---------- */
function buildOrder() {
  const root = document.getElementById('order');

  root.appendChild(el('div', 'sec-head', `
    <p class="eyebrow">בניית הזמנה</p>
    <h2 class="sec-title">מרכיבים את האירוע</h2>
  `));

  const setup = el('div', 'setup');
  setup.innerHTML = `
    <label class="field">
      <span>מספר סועדים</span>
      <input type="number" id="guests" min="${MIN_GUESTS}" step="1" value="${state.guests}" inputmode="numeric">
      <small>מינימום ${MIN_GUESTS} סועדים</small>
    </label>
    <div class="field">
      <span>מועד האירוע</span>
      <div class="seg" role="group" aria-label="מועד האירוע">
        <button type="button" data-prog="weekday" class="on">${PROGRAMS.weekday.label}</button>
        <button type="button" data-prog="shabbat">${PROGRAMS.shabbat.label}</button>
      </div>
      <small>לשבת תפריט ומחירון נפרדים</small>
    </div>`;
  root.appendChild(setup);

  root.appendChild(el('h3', 'grp-title', 'בחירת חבילה'));
  root.appendChild(el('div', null, '<div id="packHost"></div>'));

  /* עריכת שולחן */
  const tsec = el('section', 'tset');
  tsec.id = 'tableSec';
  tsec.innerHTML = `
    <h3 class="grp-title">עריכת שולחן <em class="opt" data-setting>—</em></h3>
    <div class="tset-tabs">
      <button type="button" data-mode="preset" class="on">עיצובים מוכנים</button>
      <button type="button" data-mode="custom">הרכבה אישית</button>
      <button type="button" data-mode="open">בקשה חופשית</button>
    </div>
    <div class="items tset-panel" data-panel="preset">
      ${TABLES.map(t => `
        <div class="item" role="button" tabindex="0" data-table="${t.id}">
          ${media(t)}
          <span class="item-t">${t.name}</span>
          <span class="item-tick" aria-hidden="true"></span>
        </div>`).join('')}
    </div>
    <div class="tset-panel swatches" data-panel="custom">
      ${COLORS.map(c => `
        <button type="button" class="sw" data-color="${c.id}">
          <span class="sw-dot" style="background:${c.hex}"></span>
          <span class="sw-n">${c.name}</span>
        </button>`).join('')}
    </div>
    <div class="tset-panel" data-panel="open">
      <label class="open-f">
        <span>ספרו לנו איך אתם רוצים שהשולחן ייראה</span>
        <textarea id="tableText" rows="4" placeholder="למשל: מפה לבנה, מפיות בורדו, נרות גבוהים וסידור פרחים נמוך"></textarea>
      </label>
    </div>`;
  root.appendChild(tsec);

  root.appendChild(el('div', null, '<div id="menuHost"></div>'));

  root.addEventListener('click', onClick);
  root.addEventListener('input', e => {
    if (e.target.id === 'tableText') { state.table.text = e.target.value; render(); }
    if (e.target.id === 'guests') {
      state.guests = Math.max(MIN_GUESTS, parseInt(e.target.value || '0', 10) || MIN_GUESTS);
      clampBottles();
      render();
    }
  });
  root.addEventListener('blur', e => {
    if (e.target.id === 'guests') e.target.value = state.guests;
  }, true);
  root.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    if (t.classList.contains('item-hit') || t.classList.contains('zoom') ||
        (t.classList.contains('item') && t.getAttribute('role') === 'button')) {
      e.preventDefault();
      onClick({ target: t });
    }
  });

  /* --- יצירת קשר --- */
  const contact = el('div', 'contact');
  contact.innerHTML = `
    <img class="contact-logo" src="img/brand/logo.webp" alt="ניחוחות השף — קייטרינג ואירוח">
    <div class="contact-side">
      <p>אפשר גם ישירות:</p>
      <div class="contact-row">
        <a href="tel:+${WHATSAPP}" class="contact-a">${PHONE}</a>
        <a href="#" class="contact-a" id="mailBtn">${EMAIL}</a>
      </div>
    </div>`;
  root.appendChild(contact);

  /* ההזמנה נבנית ברגע הלחיצה, כדי שתשקף את הבחירות הנוכחיות */
  contact.querySelector('#mailBtn').addEventListener('click', e => {
    e.preventDefault();
    location.href = `mailto:${EMAIL}`
      + `?subject=${encodeURIComponent('הזמנת קייטרינג — ' + prog().label)}`
      + `&body=${encodeURIComponent(orderText())}`;
  });

  buildLightbox();
  buildSummary();
  initSelections();
  buildPacks();
  buildMenu();
  render();
}

/* ---------- תצוגה מוגדלת ---------- */
function buildLightbox() {
  const lb = el('div', 'lb');
  lb.id = 'lb';
  lb.innerHTML = `
    <button type="button" class="lb-x" aria-label="סגירה">✕</button>
    <figure class="lb-fig">
      <img alt="">
      <figcaption></figcaption>
    </figure>`;
  document.body.appendChild(lb);

  lb.addEventListener('click', e => {
    if (e.target.closest('.lb-fig') && !e.target.closest('.lb-x')) return;
    closeLightbox();
  });
  addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });
}

function openLightbox(it) {
  if (!it || !it.img) return;
  const lb = document.getElementById('lb');
  lb.querySelector('img').src = it.img;
  lb.querySelector('img').alt = it.name;
  lb.querySelector('figcaption').textContent = it.note ? `${it.name} · ${it.note}` : it.name;
  lb.classList.add('on');
  document.body.style.overflow = 'hidden';
  lb.querySelector('.lb-x').focus();
}

function closeLightbox() {
  const lb = document.getElementById('lb');
  if (!lb.classList.contains('on')) return;
  lb.classList.remove('on');
  document.body.style.overflow = '';
}

function buildSummary() {
  const bar = el('div', 'summary');
  bar.id = 'summary';
  bar.innerHTML = `
    <div class="sum-l"><b id="sumTotal">—</b><span id="sumPer">—</span></div>
    <button type="button" class="sum-btn" id="sendBtn">שליחת ההזמנה</button>`;
  document.body.appendChild(bar);
  document.getElementById('sendBtn').addEventListener('click', sendOrder);
}

/* ---------- אירועים ---------- */
function setQty(key, id, n) {
  let v = Math.max(0, Math.min(9999, n));
  if (key === 'drinks') {                       /* לא חורגים מהמכסה */
    const others = bottlesChosen() - qtyOf(key, id);
    v = Math.min(v, Math.max(0, bottlesMax() - others));
  }
  if (v) state.qty[key][id] = v;
  else delete state.qty[key][id];
  render();
}

function onClick(e) {
  const c = s => e.target.closest?.(s);

  /* הגדלת תמונה — לפני כל השאר, כדי שלא תיבחר המנה */
  const z = c('[data-zoom]');
  if (z) {
    const card = z.closest('[data-grp],[data-table]');
    return card.dataset.table
      ? openLightbox(TABLES.find(t => t.id === card.dataset.table))
      : openLightbox(itemOf(card.dataset.grp, card.dataset.id));
  }

  const pr = c('[data-prog]');
  if (pr) {
    if (pr.dataset.prog === state.program) return;
    state.program = pr.dataset.prog;
    pr.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === pr));
    initSelections();
    buildPacks();
    buildMenu();
    return render();
  }

  const pack = c('[data-pkg]');
  if (pack) { state.pkg = Number(pack.dataset.pkg); return render(); }

  const mode = c('[data-mode]');
  if (mode) { state.table.mode = mode.dataset.mode; return render(); }

  const tbl = c('[data-table]');
  if (tbl) {
    const id = tbl.dataset.table;
    state.table.preset = state.table.preset === id ? null : id;
    return render();
  }

  const sw = c('[data-color]');
  if (sw) {
    const s = state.table.colors, id = sw.dataset.color;
    s.has(id) ? s.delete(id) : s.add(id);
    return render();
  }

  const ad = c('[data-addon]');
  if (ad) {
    const id = ad.dataset.addon;
    state.addons.has(id) ? state.addons.delete(id) : state.addons.add(id);
    return render();
  }

  /* פיזור שווה של הבקבוקים המומלצים */
  if (c('[data-spread]')) {
    const items = MENU.drinks.filter(i => !i.unlimited);
    const need = bottlesMax();
    const base = Math.floor(need / items.length);
    let rest = need % items.length;
    state.qty.drinks = {};
    items.forEach(it => {
      const n = base + (rest-- > 0 ? 1 : 0);
      if (n) state.qty.drinks[it.id] = n;
    });
    return render();
  }

  const step = c('.qty-b');
  if (step) {
    const card = step.closest('.item, .brow');
    return setQty(card.dataset.grp, card.dataset.id,
      qtyOf(card.dataset.grp, card.dataset.id) + Number(step.dataset.step));
  }

  const hit = c('.item-hit');
  if (hit) {
    const card = hit.closest('.item');
    const cur = qtyOf(card.dataset.grp, card.dataset.id);
    return setQty(card.dataset.grp, card.dataset.id, cur ? 0 : suggestQty(card.dataset.grp));
  }

  const item = c('.item[data-grp], .chip[data-grp]');
  if (!item || item.classList.contains('item-q')) return;

  const key = item.dataset.grp, id = item.dataset.id;
  const g = prog().groups.find(x => x.key === key);
  const set = state.picks[key];

  if (g.mode === 'all') {                     /* הכל כלול — אפשר להוריד ולהחזיר */
    set.has(id) ? set.delete(id) : set.add(id);
  } else if (set.has(id)) set.delete(id);
  else if (set.size < g.pick) set.add(id);
  else { set.delete(set.values().next().value); set.add(id); }

  render();
}

/* ---------- רינדור ---------- */
function render() {
  const p = pkgOf();

  document.querySelectorAll('[data-pkg]').forEach(b =>
    b.classList.toggle('on', Number(b.dataset.pkg) === state.pkg));

  prog().groups.forEach(g => {
    if (g.mode === 'qty' || g.mode === 'bottles') {
      document.querySelectorAll(`[data-grp="${g.key}"] > .item, [data-grp="${g.key}"] > .brow`)
        .forEach(card => {
          const q = qtyOf(g.key, card.dataset.id);
          const n = card.querySelector('.qty-n');
          /* "ללא הגבלה" תמיד דלוק; perGuest נדלק לפי בחירה; השאר לפי כמות */
          if (!card.classList.contains('brow-free')) card.classList.toggle('on', q > 0);
          if (n) n.textContent = q;
        });

      if (g.mode === 'bottles') {
        const need = bottlesMax(), got = bottlesChosen();
        const b = document.querySelector('[data-bottles]');
        if (b) {
          b.querySelector('.frac').textContent = `${got} / ${need}`;
          b.classList.toggle('full', got >= need);
        }
        const nd = document.querySelector('[data-need]');
        if (nd) nd.textContent = need;
      }
      return;
    }
    const set = state.picks[g.key];
    const cnt = document.querySelector(`[data-count="${g.key}"]`);
    if (cnt) {
      cnt.querySelector('.frac').textContent = `${set.size} / ${g.pick}`;
      cnt.classList.toggle('full', set.size === g.pick);
    }
    document.querySelectorAll(`[data-grp="${g.key}"] > .item, [data-grp="${g.key}"] > .chip`)
      .forEach(b => b.classList.toggle('on', set.has(b.dataset.id)));
  });

  /* קבוצות שתלויות בחבילה (שתייה) */
  document.querySelectorAll('[data-needs]').forEach(box =>
    box.classList.toggle('hide', !p[box.dataset.needs]));

  document.querySelectorAll('[data-addon]').forEach(b =>
    b.classList.toggle('on', state.addons.has(b.dataset.addon)));

  /* עריכת שולחן — מוצגת רק אם החבילה כוללת אותה */
  const tsec = document.getElementById('tableSec');
  tsec.classList.toggle('hide', !p.setting);

  const tb = state.table;
  document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === tb.mode));
  document.querySelectorAll('[data-panel]').forEach(x => x.classList.toggle('show', x.dataset.panel === tb.mode));
  document.querySelectorAll('[data-table]').forEach(b => b.classList.toggle('on', b.dataset.table === tb.preset));
  document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('on', tb.colors.has(b.dataset.color)));

  const sEl = document.querySelector('[data-setting]');
  if (sEl) sEl.textContent = `${p.setting} · ${tableSummary()}`;

  /* מספרים שתלויים בכמות הסועדים */
  document.querySelectorAll('[data-guestn]').forEach(n => n.textContent = state.guests);
  const dn = document.querySelector('[data-dessn]');
  if (dn) dn.textContent = dessertQty();

  const t = totals();
  document.getElementById('sumTotal').textContent = money(t.total);
  document.getElementById('sumPer').textContent =
    `${money(t.per)} × ${state.guests} סועדים` +
    (t.units ? ` · תוספות ${money(t.units)}` : '') +
    (state.program === 'shabbat' ? ' · שבת' : '');
}

/* ---------- טקסט ההזמנה ---------- */
function tableSummary() {
  const tb = state.table;
  if (tb.mode === 'preset') {
    const t = TABLES.find(x => x.id === tb.preset);
    return t ? t.name : 'טרם נבחר';
  }
  if (tb.mode === 'custom') {
    const names = COLORS.filter(c => tb.colors.has(c.id)).map(c => c.name);
    return names.length ? `הרכבה אישית: ${names.join(', ')}` : 'הרכבה אישית — טרם נבחרו צבעים';
  }
  return tb.text.trim() ? `בקשה חופשית: ${tb.text.trim()}` : 'בקשה חופשית — טרם מולאה';
}

function orderText() {
  const p = pkgOf();
  const t = totals();
  const lines = [];
  let meal = null;

  prog().groups.forEach(g => {
    if (g.needs && !p[g.needs]) return;          /* קבוצה שלא כלולה בחבילה */
    if (g.meal && g.meal !== meal) { meal = g.meal; lines.push('', `— ${meal} —`); }

    if (g.mode === 'bottles') {
      const picked = MENU[g.key]
        .filter(i => i.unlimited || qtyOf(g.key, i.id) > 0)
        .map(i => i.unlimited ? `${i.name} — ללא הגבלה` : `${i.name} × ${qtyOf(g.key, i.id)}`);
      lines.push(`${g.label} (${bottlesChosen()}/${bottlesMax()} בקבוקים): ${picked.join(' · ') || 'ללא'}`);
      return;
    }

    if (g.mode === 'qty') {
      const picked = MENU[g.key]
        .filter(i => qtyOf(g.key, i.id) > 0)
        .map(i => i.perGuest
          ? `${i.name} (+${money(i.extra)} לסועד = ${money(i.extra * state.guests)})`
          : `${i.name} × ${qtyOf(g.key, i.id)} = ${money(i.extra * qtyOf(g.key, i.id))}`);
      lines.push(`${g.label}: ${picked.join(' · ') || 'ללא'}`);
      return;
    }
    const names = MENU[g.key]
      .filter(i => state.picks[g.key].has(i.id))
      .map(i => i.extra ? `${i.name} (+${money(i.extra)} לסועד)` : i.name);
    const cap = g.mode === 'pick' ? ` (${names.length}/${g.pick})` : '';
    lines.push(`${g.label}${cap}: ${names.join(', ') || '—'}`);
  });

  const addons = prog().addons.filter(a => state.addons.has(a.id))
    .map(a => `${a.name} (+${money(a.price)} לסועד)`);

  return [
    'הזמנת קייטרינג',
    `מועד: ${prog().label}`,
    `סועדים: ${state.guests}`,
    `חבילה: ${p.name} — ${money(p.price)} לסועד`,
    p.setting ? `עריכת שולחן: ${p.setting} — ${tableSummary()}` : 'עריכת שולחן: ללא',
    `מלצרים: ${p.waiters ? 'כן' : 'לא'} · שתייה: ${p.drinks ? 'כן' : 'לא'}`,
    ...lines,
    addons.length ? ['', `תוספות: ${addons.join(', ')}`] : null,
    '',
    `${money(t.per)} × ${state.guests} סועדים = ${money(t.per * state.guests)}`,
    t.units ? `תוספות לפי כמות: ${money(t.units)}` : null,
    `סה״כ: ${money(t.total)}`,
  ].flat().filter(l => l != null).join('\n');
}

function sendOrder() {
  const missing = prog().groups
    .filter(g => g.mode === 'pick' && state.picks[g.key].size < Math.min(g.pick, MENU[g.key].length))
    .map(g => g.label);

  const btn = document.getElementById('sendBtn');
  if (missing.length) {
    btn.textContent = 'חסרות בחירות: ' + missing.join(', ');
    btn.classList.add('err');
    setTimeout(() => { btn.textContent = 'שליחת ההזמנה'; btn.classList.remove('err'); }, 2600);
    return;
  }
  location.href = `https://wa.me/${WHATSAPP}?text=` + encodeURIComponent(orderText());
}

buildOrder();
