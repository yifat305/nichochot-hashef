/* ============================================================
   גרסת הווידאו של חוויית הפתיחה — המראה של HeroFilm.tsx.
   קובץ MP4 אחד במקום 392 פריימים, אותה התנהגות בדיוק:
   לופ → גלילה שולטת בציר הזמן → המשפט נמוג בזיגוג.
   ============================================================ */

const SCRUB_AT = 0.6;
const STEPS = 5;
const GLAZE = 0.755;                       /* 148/196 — רגע שפיכת המייפל */
const SET = innerWidth / innerHeight < 0.95 ? 'tall' : 'wide';

const app = document.getElementById('app');
const s = document.createElement('section');
s.className = 'stage';
s.innerHTML = `
  <div class="sticky">
    <img class="still" src="video/poster.webp" alt="בצק פסטל מרודד על משטח אבן">
    <video class="film" playsinline muted loop preload="none"
           poster="video/poster.webp" src="video/pastel-${SET}.mp4" aria-hidden="true"></video>
    <div class="shade"></div>
    <div class="logo-glow" aria-hidden="true"></div>
    <img class="brand-logo" src="img/brand/logo.webp" alt="ניחוחות השף — קייטרינג ואירוח">
    <div class="ui">
      <h1 class="title">סיגר בשר</h1>
      <button class="play" type="button">
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
app.appendChild(s);

const stage  = s;
const video  = s.querySelector('.film');
const still  = s.querySelector('.still');
const ui     = s.querySelector('.ui');
const btn    = s.querySelector('.play');
const label  = s.querySelector('.play-label');
const tag    = s.querySelector('.tagline');
const hud    = s.querySelector('.hud');
const segs   = [...s.querySelectorAll('.hud i')];
const cue    = s.querySelector('.cue');

let started = false, scrubbing = false;

btn.addEventListener('click', async () => {
  if (started) return;
  btn.classList.add('loading');
  label.textContent = 'טוען…';
  video.load();
  try { await video.play(); } catch { /* ההפעלה נחסמה — הגלילה עדיין שולטת */ }
  started = true;
  btn.classList.remove('loading');
  label.textContent = 'נגן';
  video.classList.add('on');
  still.classList.add('off');
  ui.classList.add('hide');
  cue.classList.add('on');
  onScroll();
});

/* המשפט חי לאורך ההכנה ונמוג ברגע שהמייפל נשפך */
video.addEventListener('timeupdate', () => {
  if (!started || scrubbing || !video.duration) return;
  const p = video.currentTime / video.duration;
  tag.classList.toggle('on', p > 0.015 && p < GLAZE);
});

function onScroll() {
  if (!started) return;
  const total = stage.offsetHeight - innerHeight;
  const p = Math.min(1, Math.max(0, -stage.getBoundingClientRect().top / total));
  cue.classList.toggle('on', p < 0.12);

  if (p >= SCRUB_AT) {
    scrubbing = true;
    if (!video.paused) video.pause();
    hud.classList.add('on');
    tag.classList.remove('on');
    const sp = (p - SCRUB_AT) / (1 - SCRUB_AT);
    if (video.duration) video.currentTime = sp * video.duration;
    segs.forEach((seg, k) =>
      seg.style.setProperty('--f', Math.min(1, Math.max(0, sp * STEPS - k)).toFixed(3)));
  } else {
    scrubbing = false;
    hud.classList.remove('on');
    if (video.paused) video.play().catch(() => {});
  }
}

let queued = false;
addEventListener('scroll', () => {
  if (queued) return;
  queued = true;
  requestAnimationFrame(() => { onScroll(); queued = false; });
}, { passive: true });
addEventListener('resize', onScroll);
