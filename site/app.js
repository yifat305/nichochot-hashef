/* ============================================================
   Image-Sequence scroll experience
   כל מתכון = במה אחת. הבמות נבנות מתוך RECIPES שב-recipes.js
   ============================================================ */

const FPS      = 12;
const FRAME_MS = 1000 / FPS;
const SCRUB_AT = 0.6;   // מכאן הגלילה שולטת ידנית בפריימים
const STEPS    = 5;     // המחוון מחולק ל-5 שלבים — כמות הפריימים לא נחשפת
const GLAZE    = 148;   // הפריים שבו נשפך זיגוג המייפל — שם המשפט נעלם

/* סט הפריימים לפי פרופורציות המסך */
const SET = (innerWidth / innerHeight) < 0.95 ? 'tall' : 'wide';

class Stage {
  constructor(recipe) {
    this.r = recipe;
    this.frames = new Array(recipe.frames);
    this.loaded = 0;
    this.cur = 0;
    this.drawn = -1;
    this.started = false;
    this.ready = false;
    this.looping = false;
    this.last = 0;
    this.visible = true;

    this.build();
    this.bind();
  }

  /* ---------- DOM ---------- */
  build() {
    const base = `recipes/${this.r.id}`;
    const s = document.createElement('section');
    s.className = 'stage';
    s.innerHTML = `
      <div class="sticky">
        <img class="still" src="${base}/poster.webp" alt="${this.r.title}">
        <canvas class="film" aria-hidden="true"></canvas>
        <div class="shade"></div>
        <img class="brand-logo" src="img/brand/logo.webp" alt="ניחוחות השף — קייטרינג ואירוח">
        <div class="ui">
          <h1 class="title">${this.r.title}</h1>
          <button class="play" type="button">
            <svg class="ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="28"/></svg>
            <span class="play-ico" aria-hidden="true"></span>
            <span class="play-label">נגן</span>
          </button>
        </div>
        <p class="tagline">
          <span>לא רק מגישים אוכל.</span>
          <span>מגישים חוויה.</span>
        </p>
        <div class="hud">${'<i></i>'.repeat(STEPS)}</div>
        <div class="cue"></div>
      </div>`;
    document.getElementById('app').appendChild(s);

    this.el     = s;
    this.canvas = s.querySelector('.film');
    this.ctx    = this.canvas.getContext('2d', { alpha: false });
    this.still  = s.querySelector('.still');
    this.ui     = s.querySelector('.ui');
    this.btn    = s.querySelector('.play');
    this.label  = s.querySelector('.play-label');
    this.ring   = s.querySelector('.ring circle');
    this.hud    = s.querySelector('.hud');
    this.segs   = [...s.querySelectorAll('.hud i')];
    this.tag    = s.querySelector('.tagline');
    this.cue    = s.querySelector('.cue');
  }

  bind() {
    this.btn.addEventListener('click', () => this.start());

    new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.started && this.visible) this.last = performance.now();
    }, { threshold: 0 }).observe(this.el);
  }

  /* ---------- טעינת הרצף ---------- */
  src(i) {
    return `recipes/${this.r.id}/${SET}/f_${String(i + 1).padStart(4, '0')}.webp`;
  }

  loadFrame(i) {
    return new Promise(res => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = img.onerror = () => {
        this.frames[i] = img;
        this.loaded++;
        this.ring.style.strokeDashoffset = String(176 * (1 - this.loaded / this.r.frames));
        res();
      };
      img.src = this.src(i);
    });
  }

  async preload() {
    /* קודם 24 פריימים כדי להתחיל מהר, אחר כך השאר ברקע */
    await Promise.all(Array.from({ length: 24 }, (_, i) => this.loadFrame(i)));
    this.ready = true;

    const queue = [];
    for (let i = 24; i < this.r.frames; i++) queue.push(i);
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (queue.length) await this.loadFrame(queue.shift());
    }));
  }

  /* ---------- ציור ---------- */
  size() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width  = Math.round(this.canvas.clientWidth  * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.drawn = -1;
  }

  draw(i) {
    const img = this.frames[i];
    if (!img || !img.naturalWidth || i === this.drawn) return;
    this.drawn = i;
    const cw = this.canvas.width, ch = this.canvas.height;
    const k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  /* הפריים הקרוב שכבר נטען — למקרה שגוללים מהר בזמן טעינה */
  nearest(i) {
    if (this.frames[i]?.naturalWidth) return i;
    for (let d = 1; d < this.r.frames; d++) {
      if (this.frames[i - d]?.naturalWidth) return i - d;
      if (this.frames[i + d]?.naturalWidth) return i + d;
    }
    return -1;
  }

  /* ---------- הפעלה ---------- */
  async start() {
    if (this.started) return;
    this.started = true;

    this.btn.classList.add('loading');
    this.label.textContent = 'טוען…';

    const all = this.preload();
    await new Promise(r => {
      const c = () => (this.ready ? r() : setTimeout(c, 50));
      c();
    });

    this.size();
    this.draw(0);
    this.canvas.classList.add('on');
    this.still.classList.add('off');
    this.ui.classList.add('hide');
    this.cue.classList.add('on');

    this.looping = true;
    this.last = performance.now();
    all.then(() => { this.label.textContent = 'נגן'; this.btn.classList.remove('loading'); });
  }

  /* ---------- פריים בכל רפרוף מסך ---------- */
  tick(t) {
    if (!this.started || !this.visible || !this.looping) return;
    if (t - this.last < FRAME_MS) return;
    this.last = t;
    this.cur = (this.cur + 1) % this.r.frames;   // לופ אינסופי
    const f = this.nearest(this.cur);
    if (f >= 0) this.draw(f);

    /* המשפט חי לאורך ההכנה ונמוג ברגע שהמייפל נשפך */
    this.tag.classList.toggle('on', !this.scrubbing && this.cur > 2 && this.cur < GLAZE);
  }

  /* ---------- גלילה ---------- */
  onScroll() {
    const rect = this.el.getBoundingClientRect();
    const total = this.el.offsetHeight - innerHeight;
    const p = Math.min(1, Math.max(0, -rect.top / total));

    this.cue.classList.toggle('on', this.started && p < 0.12);

    if (this.started && p >= SCRUB_AT) {
      /* גלילה = שליטה ידנית ברצף */
      this.scrubbing = true;
      this.looping = false;
      this.hud.classList.add('on');
      this.tag.classList.remove('on');
      const sp = (p - SCRUB_AT) / (1 - SCRUB_AT);
      const i = Math.min(this.r.frames - 1, Math.round(sp * (this.r.frames - 1)));
      this.cur = i;
      const f = this.nearest(i);
      if (f >= 0) this.draw(f);
      /* המחוון מתמלא לאורך 5 שלבים במקום למנות פריימים */
      this.segs.forEach((seg, k) => {
        seg.style.setProperty('--f', Math.min(1, Math.max(0, sp * STEPS - k)).toFixed(3));
      });
    } else {
      this.hud.classList.remove('on');
      this.scrubbing = false;
      if (this.started && !this.looping) { this.looping = true; this.last = performance.now(); }
    }
  }
}

/* ============================================================ */
const stages = RECIPES.map(r => new Stage(r));

let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { stages.forEach(s => s.onScroll()); queued = false; });
}, { passive: true });

addEventListener('resize', () => {
  stages.forEach(s => { s.size(); const f = s.nearest(s.cur); if (f >= 0) s.draw(f); s.onScroll(); });
});

(function loop(t) {
  requestAnimationFrame(loop);
  stages.forEach(s => s.tick(t));
})(0);

stages.forEach(s => { s.size(); s.onScroll(); });
