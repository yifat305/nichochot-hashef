/* ============================================================
   פאנל ניהול הזמנות.

   ⚠️ הקוד רץ בדפדפן, ולכן הקוד 2809 גלוי לכל מי שיפתח את מקור
   העמוד. זו חסימה נוחה, לא אבטחה. אבטחה אמיתית מחייבת שרת.

   ההזמנות נשמרות ב-localStorage — כלומר בדפדפן שבו הן נשלחו.
   כדי לראות את כל ההזמנות מכל המכשירים צריך מסד נתונים.
   ============================================================ */

const app = document.getElementById('admin');
let unlocked = sessionStorage.getItem('nichochot-admin') === 'ok';
let query = '';
let sort = 'date';
let filter = 'all';

/* מצבי הזמנה */
const STATUS = {
  new:      { label: 'חדשה',   cls: 'st-new' },
  progress: { label: 'בתהליך', cls: 'st-prog' },
  done:     { label: 'בוצעה',  cls: 'st-done' },
};

/* ---------- עזר ---------- */
const load = () => {
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY) || '[]'); }
  catch { return []; }
};
const save = list => localStorage.setItem(ORDERS_KEY, JSON.stringify(list));

const heDate = iso => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};
const dayName = iso => {
  if (!iso) return '';
  const days = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return 'יום ' + days[new Date(iso + 'T00:00').getDay()];
};
const isPast = iso => iso && iso < new Date().toISOString().slice(0, 10);
const statusOf = o => o.status || 'new';

function setStatus(id, status) {
  const all = load();
  const o = all.find(x => x.id === id);
  if (!o) return;
  o.status = status;
  o.statusAt = new Date().toISOString();
  save(all);
  panel();
}

/* ---------- שמירה ביומן ---------- */
const pad = n => String(n).padStart(2, '0');

/** ברירת מחדל: אירוע של 4 שעות מהשעה שנבחרה */
function eventWindow(o) {
  const start = new Date(`${o.date}T${o.time || '19:00'}`);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmt = d =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  return { start: fmt(start), end: fmt(end) };
}

const calTitle = o => `${o.type} — ${o.name} (${o.guests} סועדים)`;

function googleCalUrl(o) {
  const { start, end } = eventWindow(o);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: calTitle(o),
    dates: `${start}/${end}`,
    details: o.text,
    location: o.place || '',
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** קובץ ics — לאאוטלוק, לאפל ולכל יומן שאינו גוגל */
function icsFor(o) {
  const { start, end } = eventWindow(o);
  const esc = s => String(s).replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nichochot-hashef//HE',
    'BEGIN:VEVENT',
    `UID:${o.id}@nichochot-hashef`,
    `DTSTAMP:${start}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${esc(calTitle(o))}`,
    `LOCATION:${esc(o.place || '')}`,
    `DESCRIPTION:${esc(o.text)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
}

/* ---------- מסך כניסה ---------- */
function lockScreen() {
  app.innerHTML = `
    <div class="gate">
      <img class="gate-logo" src="img/brand/logo.webp" alt="ניחוחות השף">
      <h1>ניהול הזמנות</h1>
      <form class="gate-form" id="gateForm">
        <input type="password" id="pin" inputmode="numeric" autocomplete="off"
               placeholder="קוד כניסה" aria-label="קוד כניסה">
        <button type="submit">כניסה</button>
      </form>
      <p class="gate-err" id="gateErr" hidden>קוד שגוי</p>
    </div>`;

  document.getElementById('gateForm').addEventListener('submit', e => {
    e.preventDefault();
    const pin = document.getElementById('pin');
    if (pin.value === ADMIN_PIN) {
      sessionStorage.setItem('nichochot-admin', 'ok');
      unlocked = true;
      panel();
    } else {
      document.getElementById('gateErr').hidden = false;
      pin.value = '';
      pin.focus();
    }
  });
  document.getElementById('pin').focus();
}

/* ---------- הפאנל ---------- */
function panel() {
  const all = load();

  const filtered = all.filter(o => {
    if (filter !== 'all' && statusOf(o) !== filter) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return [o.name, o.place, o.type, heDate(o.date)].join(' ').toLowerCase().includes(q);
  });

  filtered.sort((a, b) =>
    sort === 'date'
      ? (a.date || '9999').localeCompare(b.date || '9999')
      : sort === 'name'
        ? a.name.localeCompare(b.name, 'he')
        : b.savedAt.localeCompare(a.savedAt));

  const upcoming = all.filter(o => !isPast(o.date)).length;
  const revenue = all.reduce((s, o) => s + o.total, 0);
  const counts = {
    all: all.length,
    new: all.filter(o => statusOf(o) === 'new').length,
    progress: all.filter(o => statusOf(o) === 'progress').length,
    done: all.filter(o => statusOf(o) === 'done').length,
  };

  app.innerHTML = `
    <header class="ad-top">
      <img class="ad-logo" src="img/brand/logo.webp" alt="ניחוחות השף">
      <div class="ad-stats">
        <div><b>${all.length}</b><span>הזמנות</span></div>
        <div><b>${upcoming}</b><span>עתידיות</span></div>
        <div><b>${revenue.toLocaleString('he-IL')} ${CURRENCY}</b><span>סך הכל</span></div>
      </div>
      <button type="button" class="ad-out" id="logout">יציאה</button>
    </header>

    <div class="ad-filters">
      ${[['all', 'הכל'], ['new', 'חדשות'], ['progress', 'בתהליך'], ['done', 'בוצעו']]
        .map(([k, l]) => `<button type="button" data-filter="${k}" class="${filter === k ? 'on' : ''} f-${k}">
          ${l}<em>${counts[k]}</em></button>`).join('')}
    </div>

    <div class="ad-bar">
      <input type="search" id="q" value="${query}" placeholder="חיפוש לפי שם, מיקום, סוג או תאריך">
      <div class="ad-sort">
        ${[['date', 'לפי תאריך'], ['name', 'לפי שם'], ['new', 'האחרונות']]
          .map(([k, l]) => `<button type="button" data-sort="${k}" class="${sort === k ? 'on' : ''}">${l}</button>`)
          .join('')}
      </div>
    </div>

    ${filtered.length === 0
      ? `<p class="ad-empty">${all.length ? 'אין הזמנות שתואמות לסינון הזה.' : 'עדיין אין הזמנות שמורות.'}</p>`
      : `<div class="ad-list">${filtered.map(card).join('')}</div>`}

    ${all.length ? `<div class="ad-tools">
      <button type="button" id="exportBtn">ייצוא לקובץ</button>
      <button type="button" id="copyAllBtn">העתקת הכל</button>
      <button type="button" id="clearBtn" class="danger">מחיקת כל ההזמנות</button>
    </div>` : ''}`;

  document.getElementById('logout').addEventListener('click', () => {
    sessionStorage.removeItem('nichochot-admin');
    unlocked = false;
    lockScreen();
  });

  const q = document.getElementById('q');
  q.addEventListener('input', e => {
    query = e.target.value;
    const pos = e.target.selectionStart;
    panel();
    const nq = document.getElementById('q');
    nq.focus();
    nq.setSelectionRange(pos, pos);
  });

  app.querySelectorAll('[data-sort]').forEach(b =>
    b.addEventListener('click', () => { sort = b.dataset.sort; panel(); }));

  app.querySelectorAll('[data-filter]').forEach(b =>
    b.addEventListener('click', () => { filter = b.dataset.filter; panel(); }));

  app.querySelectorAll('[data-status]').forEach(b =>
    b.addEventListener('click', e => {
      e.stopPropagation();
      const [id, st] = b.dataset.status.split('|');
      /* לחיצה נוספת על אותו מצב מבטלת אותו */
      setStatus(id, statusOf(load().find(x => x.id === id)) === st ? 'new' : st);
    }));

  app.querySelectorAll('[data-ics]').forEach(b =>
    b.addEventListener('click', () => {
      const o = load().find(x => x.id === b.dataset.ics);
      const blob = new Blob([icsFor(o)], { type: 'text/calendar;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${o.name}-${o.date}.ics`;
      a.click();
      URL.revokeObjectURL(a.href);
    }));

  app.querySelectorAll('[data-open]').forEach(b =>
    b.addEventListener('click', () => {
      const body = document.getElementById('body-' + b.dataset.open);
      body.hidden = !body.hidden;
      b.classList.toggle('open', !body.hidden);
    }));

  app.querySelectorAll('[data-copy]').forEach(b =>
    b.addEventListener('click', async () => {
      const o = all.find(x => x.id === b.dataset.copy);
      try {
        await navigator.clipboard.writeText(o.text);
        b.textContent = 'הועתק ✓';
        setTimeout(() => (b.textContent = 'העתקת ההזמנה'), 1800);
      } catch {
        b.textContent = 'ההעתקה נחסמה';
        setTimeout(() => (b.textContent = 'העתקת ההזמנה'), 1800);
      }
    }));

  app.querySelectorAll('[data-del]').forEach(b =>
    b.addEventListener('click', () => {
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1';
        b.textContent = 'למחוק? לחצו שוב';
        setTimeout(() => { b.dataset.armed = '0'; b.textContent = 'מחיקה'; }, 3000);
        return;
      }
      save(load().filter(x => x.id !== b.dataset.del));
      panel();
    }));

  const exp = document.getElementById('exportBtn');
  if (exp) exp.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(load(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `הזמנות-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  /* גיבוי שעובד גם היכן שהורדות חסומות */
  const cpAll = document.getElementById('copyAllBtn');
  if (cpAll) cpAll.addEventListener('click', async () => {
    const txt = load()
      .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'))
      .map(o => o.text)
      .join('\n\n' + '─'.repeat(30) + '\n\n');
    try {
      await navigator.clipboard.writeText(txt);
      cpAll.textContent = 'הועתק ✓';
    } catch {
      cpAll.textContent = 'ההעתקה נחסמה';
    }
    setTimeout(() => (cpAll.textContent = 'העתקת הכל'), 1800);
  });

  const clr = document.getElementById('clearBtn');
  if (clr) clr.addEventListener('click', () => {
    if (clr.dataset.armed !== '1') {
      clr.dataset.armed = '1';
      clr.textContent = 'למחוק הכל? לחצו שוב';
      setTimeout(() => { clr.dataset.armed = '0'; clr.textContent = 'מחיקת כל ההזמנות'; }, 3000);
      return;
    }
    save([]);
    panel();
  });
}

/* ---------- כרטיס הזמנה ---------- */
function card(o) {
  const past = isPast(o.date);
  const st = statusOf(o);
  return `
    <article class="ad-card${past ? ' past' : ''} ${STATUS[st].cls}">
      <div class="ad-marks">
        <button type="button" class="mark mark-prog${st === 'progress' ? ' on' : ''}"
                data-status="${o.id}|progress" title="בתהליך" aria-label="סימון כבתהליך">
          <span class="mk-dot"></span>
        </button>
        <button type="button" class="mark mark-done${st === 'done' ? ' on' : ''}"
                data-status="${o.id}|done" title="בוצעה" aria-label="סימון כבוצעה">
          <span class="mk-v"></span>
        </button>
      </div>

      <button type="button" class="ad-head" data-open="${o.id}">
        <span class="ad-when">
          <b>${heDate(o.date)}</b>
          <i>${dayName(o.date)}${o.time ? ` · ${o.time}` : ''}</i>
        </span>
        <span class="ad-who">
          <b>${esc(o.name)}</b>
          <i>${esc(o.type)} · ${esc(o.place)}</i>
        </span>
        <span class="ad-sum">
          <b>${o.total.toLocaleString('he-IL')} ${CURRENCY}</b>
          <i>${o.guests} סועדים</i>
        </span>
        <span class="ad-badge">${STATUS[st].label}</span>
        <span class="ad-chev" aria-hidden="true"></span>
      </button>

      <div class="ad-body" id="body-${o.id}" hidden>
        <dl class="ad-facts">
          ${fact('מועד', o.program)}
          ${fact('חבילה', `${o.pkg} — ${o.pkgPrice} ${CURRENCY} לסועד`)}
          ${fact('עריכת שולחן', o.setting)}
          ${fact('מלצרים', o.waiters ? 'כן' : 'לא')}
          ${fact('שתייה', o.drinks ? 'כן' : 'לא')}
          ${o.addons.length ? fact('תוספות', o.addons.join(', ')) : ''}
          ${fact('מחיר לסועד', `${o.perGuest} ${CURRENCY}`)}
          ${o.units ? fact('תוספות לפי כמות', `${o.units.toLocaleString('he-IL')} ${CURRENCY}`) : ''}
          ${fact('נשמר', new Date(o.savedAt).toLocaleString('he-IL'))}
        </dl>

        <div class="ad-menu">
          ${Object.entries(o.lines).map(([label, items]) => `
            <div class="ad-grp">
              <h4>${esc(label)}</h4>
              <p>${items.map(esc).join(' · ')}</p>
            </div>`).join('')}
        </div>

        <div class="ad-acts">
          ${o.date ? `
            <a class="act-cal" href="${googleCalUrl(o)}" target="_blank" rel="noopener">שמירה ביומן גוגל</a>
            <button type="button" data-ics="${o.id}">קובץ יומן (ics)</button>` : ''}
          <button type="button" data-copy="${o.id}">העתקת ההזמנה</button>
          <button type="button" class="danger" data-del="${o.id}" data-armed="0">מחיקה</button>
        </div>
      </div>
    </article>`;
}

const fact = (k, v) => `<div><dt>${k}</dt><dd>${esc(String(v))}</dd></div>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- הפעלה ---------- */
unlocked ? panel() : lockScreen();
