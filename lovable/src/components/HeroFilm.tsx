import { useEffect, useRef, useState } from "react";
import { ASSETS } from "@/data/menu";

/**
 * חוויית הפתיחה.
 *
 * תמונת סטילס → לחיצה על "נגן" → הסרטון רץ בלופ → גלילה עוברת
 * לשליטה ידנית על ציר הזמן. המשפט נמוג ברגע שנשפך זיגוג המייפל.
 *
 * המקור היה Image Sequence של 196 פריימים; כאן זה אותו דבר בדיוק
 * דרך currentTime של הווידאו — קובץ אחד במקום 392.
 */

const SCRUB_AT = 0.6; // מכאן הגלילה שולטת בציר הזמן
const STEPS = 5; // מחוון ההתקדמות — 5 שלבים, לא ספירת פריימים
const GLAZE = 0.755; // 148/196 — הרגע שבו המייפל נשפך

export function HeroFilm() {
  const stage = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [tagOn, setTagOn] = useState(false);
  const [fill, setFill] = useState<number[]>(Array(STEPS).fill(0));
  const [portrait, setPortrait] = useState(false);

  useEffect(() => {
    const check = () => setPortrait(window.innerWidth / window.innerHeight < 0.95);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* המשפט חי לאורך ההכנה ונעלם בזיגוג */
  useEffect(() => {
    const v = video.current;
    if (!v || !started) return;
    const onTime = () => {
      if (scrubbing || !v.duration) return;
      const p = v.currentTime / v.duration;
      setTagOn(p > 0.015 && p < GLAZE);
    };
    v.addEventListener("timeupdate", onTime);
    return () => v.removeEventListener("timeupdate", onTime);
  }, [started, scrubbing]);

  /* גלילה — מעבר מלופ לשליטה ידנית */
  useEffect(() => {
    if (!started) return;
    let queued = false;
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const el = stage.current;
        const v = video.current;
        if (!el || !v) return;
        const total = el.offsetHeight - window.innerHeight;
        const p = Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total));

        if (p >= SCRUB_AT) {
          if (!v.paused) v.pause();
          setScrubbing(true);
          setTagOn(false);
          const sp = (p - SCRUB_AT) / (1 - SCRUB_AT);
          if (v.duration) v.currentTime = sp * v.duration;
          setFill(Array.from({ length: STEPS }, (_, k) => Math.min(1, Math.max(0, sp * STEPS - k))));
        } else {
          setScrubbing(false);
          if (v.paused) void v.play().catch(() => {});
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [started]);

  async function start() {
    const v = video.current;
    if (!v || started) return;
    setLoading(true);
    try {
      v.load();
      await v.play();
    } catch {
      /* אם ההפעלה נחסמה, הסרטון עדיין מוצג ונשלט בגלילה */
    }
    setLoading(false);
    setStarted(true);
  }

  const src = portrait ? "pastel-tall.mp4" : "pastel-wide.mp4";

  return (
    <section ref={stage} className="relative h-[300vh] max-md:h-[260vh]">
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden bg-black">
        {/* סטילס הפתיחה */}
        <img
          src={`${ASSETS}/video/poster.webp`}
          alt="בצק פסטל מרודד על משטח אבן"
          className={`absolute inset-0 h-full w-full object-cover transition-all duration-[900ms] ${
            started ? "scale-110 opacity-0" : "scale-[1.03] opacity-100"
          }`}
        />

        <video
          ref={video}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[800ms] ${
            started ? "opacity-100" : "opacity-0"
          }`}
          src={`${ASSETS}/video/${src}`}
          poster={`${ASSETS}/video/poster.webp`}
          loop
          muted
          playsInline
          preload="none"
          aria-hidden="true"
        />

        {/* הצללה לקריאות */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,.35)_0%,transparent_30%,transparent_55%,rgba(0,0,0,.75)_100%)]" />

        {/* הילה כהה מאחורי אזור הלוגו — מפרידה אותו מהפריים בלי מסגרת */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 z-[4] h-[clamp(190px,30vh,290px)] w-[min(760px,90vw)] -translate-x-1/2 bg-[radial-gradient(58%_62%_at_50%_26%,rgba(8,8,9,.62)_0%,rgba(8,8,9,.34)_46%,transparent_74%)]"
        />

        {/* לוגו — הילה כהה צמודה לזהב וחיזוק קל שלו, כי הפריימים בהירים */}
        <img
          src={`${ASSETS}/img/brand/logo.webp`}
          alt="ניחוחות השף — קייטרינג ואירוח"
          className="pointer-events-none absolute left-1/2 top-[clamp(1.2rem,3.4vh,2.2rem)] z-[5] h-[clamp(96px,14.5vh,148px)] w-auto -translate-x-1/2 [filter:drop-shadow(0_2px_8px_rgba(0,0,0,.95))_drop-shadow(0_0_24px_rgba(0,0,0,.8))_drop-shadow(0_0_48px_rgba(0,0,0,.5))_brightness(1.1)_saturate(1.18)_contrast(1.06)]"
        />

        {/* כותרת וכפתור */}
        <div
          className={`absolute bottom-[clamp(3rem,10vh,6rem)] start-[clamp(1.3rem,7vw,5rem)] z-[3] transition-all duration-700 max-md:bottom-auto max-md:top-1/2 ${
            started
              ? "pointer-events-none -translate-y-5 opacity-0 max-md:-translate-y-[55%]"
              : "opacity-100 max-md:-translate-y-[45%]"
          }`}
        >
          <h1 className="text-[clamp(2.6rem,8vw,6rem)] font-light leading-none tracking-[-0.02em] drop-shadow-[0_3px_40px_rgba(0,0,0,.5)]">
            סיגר בשר
          </h1>
          <button
            type="button"
            onClick={start}
            className="mt-8 inline-flex items-center gap-[.9rem] rounded-full border border-border bg-foreground/[.08] py-2 pe-6 ps-2 text-[.95rem] font-medium backdrop-blur-[10px] transition hover:-translate-y-0.5 hover:border-foreground/40 hover:bg-foreground/[.15]"
          >
            <span className="grid h-[42px] w-[42px] flex-none place-items-center rounded-full bg-foreground">
              {loading ? (
                <span className="h-[11px] w-[11px] animate-pulse rounded-[2px] bg-background" />
              ) : (
                <span className="ms-[-3px] h-0 w-0 border-y-[7px] border-e-[12px] border-y-transparent border-e-background" />
              )}
            </span>
            {loading ? "טוען…" : "נגן"}
          </button>
        </div>

        {/* המשפט */}
        {/* לוח זכוכית אחד מאחורי שתי השורות יחד. הרקע כהה־שקוף,
            כך שהוא מכהה את הפריים הבהיר והזהב נקרא בלי גוש אטום.
            המרכוז פיזי (left/translate) כדי לעבוד זהה ב-RTL. */}
        <p
          className={`pointer-events-none absolute left-1/2 top-1/2 z-[4] flex w-fit max-w-[92vw] -translate-x-1/2 -translate-y-[56%] flex-col items-center gap-[.1em] rounded-[30px] border border-foreground/15 bg-[rgba(14,13,12,.28)] px-[.8em] pb-[.5em] pt-[.42em] text-center text-[clamp(2.1rem,6vw,4.6rem)] font-light leading-[1.14] tracking-[-0.015em] shadow-[0_10px_44px_rgba(0,0,0,.42)] backdrop-blur-[24px] backdrop-saturate-125 transition-opacity duration-[1200ms] ${
            tagOn ? "opacity-100" : "opacity-0"
          }`}
        >
          {["לא רק מגישים אוכל.", "מגישים חוויה."].map((line, i) => (
            <span
              key={line}
              className={`text-[#f0d795] [text-shadow:0_2px_12px_rgba(0,0,0,.5)] transition-all duration-[1400ms] ease-[cubic-bezier(.22,1,.36,1)] ${
                i === 1 ? "delay-[350ms]" : ""
              } ${tagOn ? `translate-y-0 ${i === 1 ? "opacity-90" : "opacity-100"}` : "translate-y-4 opacity-0"}`}
            >
              {line}
            </span>
          ))}
        </p>

        {/* מחוון 5 שלבים */}
        <div
          className={`pointer-events-none absolute inset-x-[clamp(1.3rem,7vw,5rem)] bottom-[clamp(2rem,7vh,4rem)] z-[3] flex gap-2 transition-opacity duration-400 ${
            scrubbing ? "opacity-100" : "opacity-0"
          }`}
        >
          {fill.map((f, i) => (
            <span key={i} className="relative h-0.5 flex-1 overflow-hidden rounded-sm bg-foreground/20">
              <span
                className="absolute inset-0 origin-right rounded-sm bg-foreground"
                style={{ transform: `scaleX(${f})` }}
              />
            </span>
          ))}
        </div>

        {/* חץ גלילה */}
        <div
          className={`absolute bottom-6 end-[clamp(1.3rem,7vw,5rem)] z-[3] h-9 w-[21px] rounded-xl border border-foreground/35 transition-opacity duration-500 ${
            started && !scrubbing ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="absolute left-1/2 top-[7px] -ms-0.5 h-1.5 w-1 animate-[cue_1.6s_ease-in-out_infinite] rounded-sm bg-foreground" />
        </div>
      </div>
    </section>
  );
}
