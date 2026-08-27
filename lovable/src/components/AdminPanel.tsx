import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import {
  ADMIN_PIN, ASSETS, CURRENCY, SavedOrder, dateHe, loadOrders, saveOrders,
} from "@/data/menu";

/**
 * פאנל ניהול הזמנות.
 *
 * ⚠️ הקוד רץ בדפדפן, ולכן הקוד גלוי לכל מי שיפתח את מקור העמוד.
 * זו חסימה נוחה, לא אבטחה. אבטחה אמיתית מחייבת שרת.
 *
 * ההזמנות נשמרות ב-localStorage — כלומר בדפדפן שבו הן נשלחו.
 * כדי לראות הזמנות מכל המכשירים צריך מסד נתונים.
 */

type Status = "new" | "progress" | "done";
type Filter = "all" | Status;
type Sort = "date" | "name" | "new";

const STATUS: Record<Status, { label: string }> = {
  new: { label: "חדשה" },
  progress: { label: "בתהליך" },
  done: { label: "בוצעה" },
};

const statusOf = (o: SavedOrder): Status => o.status ?? "new";
const isPast = (iso: string) => !!iso && iso < new Date().toISOString().slice(0, 10);

const dayName = (iso: string) => {
  if (!iso) return "";
  const days = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
  return "יום " + days[new Date(iso + "T00:00").getDay()];
};

/** ברירת מחדל: אירוע של 4 שעות מהשעה שנבחרה */
function eventWindow(o: SavedOrder) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${o.date}T${o.time || "19:00"}`);
  const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  return { start: fmt(start), end: fmt(end) };
}

const calTitle = (o: SavedOrder) => `${o.type} — ${o.name} (${o.guests} סועדים)`;

function googleCalUrl(o: SavedOrder) {
  const { start, end } = eventWindow(o);
  const p = new URLSearchParams({
    action: "TEMPLATE",
    text: calTitle(o),
    dates: `${start}/${end}`,
    details: o.text,
    location: o.place || "",
  });
  return `https://calendar.google.com/calendar/render?${p}`;
}

/** קובץ ics — לאאוטלוק, לאפל ולכל יומן שאינו גוגל */
function icsFor(o: SavedOrder) {
  const { start, end } = eventWindow(o);
  const esc = (s: string) => String(s).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//nichochot-hashef//HE",
    "BEGIN:VEVENT",
    `UID:${o.id}@nichochot-hashef`,
    `DTSTAMP:${start}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${esc(calTitle(o))}`,
    `LOCATION:${esc(o.place || "")}`,
    `DESCRIPTION:${esc(o.text)}`,
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}

/* ============================================================ */
export function AdminPanel() {
  const [unlocked, setUnlocked] = useState(
    () => typeof window !== "undefined" && sessionStorage.getItem("nichochot-admin") === "ok",
  );
  if (!unlocked) return <Gate onPass={() => setUnlocked(true)} />;
  return <Panel onLogout={() => setUnlocked(false)} />;
}

/* ---------- מסך כניסה ---------- */
function Gate({ onPass }: { onPass: () => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <img src={`${ASSETS}/img/brand/logo.webp`} alt="ניחוחות השף" className="h-[clamp(100px,16vh,150px)] w-auto" />
      <h1 className="text-[clamp(1.6rem,4vw,2.4rem)] font-light tracking-[-0.01em]">ניהול הזמנות</h1>
      <form
        className="flex flex-wrap justify-center gap-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          if (pin === ADMIN_PIN) {
            sessionStorage.setItem("nichochot-admin", "ok");
            onPass();
          } else {
            setErr(true);
            setPin("");
          }
        }}
      >
        <input
          type="password" inputMode="numeric" autoComplete="off" aria-label="קוד כניסה"
          placeholder="קוד כניסה" value={pin} onChange={(e) => setPin(e.target.value)}
          className="w-56 rounded-full border border-border bg-transparent px-6 py-3.5 text-center text-[1.1rem] tracking-[.3em] outline-none focus:border-foreground"
        />
        <button type="submit" className="rounded-full bg-foreground px-8 py-3.5 font-medium text-background transition hover:opacity-90">
          כניסה
        </button>
      </form>
      {err && <p className="text-[.88rem] text-[#e57373]">קוד שגוי</p>}
    </div>
  );
}

/* ---------- הפאנל ---------- */
function Panel({ onLogout }: { onLogout: () => void }) {
  const [orders, setOrders] = useState<SavedOrder[]>(() => loadOrders());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("date");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [armed, setArmed] = useState<string | null>(null);

  const commit = (list: SavedOrder[]) => { saveOrders(list); setOrders(list); };

  function setStatus(id: string, st: Status) {
    commit(orders.map((o) =>
      o.id === id ? { ...o, status: statusOf(o) === st ? "new" : st, statusAt: new Date().toISOString() } : o,
    ));
  }

  const counts = useMemo(() => ({
    all: orders.length,
    new: orders.filter((o) => statusOf(o) === "new").length,
    progress: orders.filter((o) => statusOf(o) === "progress").length,
    done: orders.filter((o) => statusOf(o) === "done").length,
  }), [orders]);

  const shown = useMemo(() => {
    const q = query.toLowerCase();
    return orders
      .filter((o) => (filter === "all" || statusOf(o) === filter))
      .filter((o) => !q || [o.name, o.place, o.type, dateHe(o.date)].join(" ").toLowerCase().includes(q))
      .sort((a, b) =>
        sort === "date" ? (a.date || "9999").localeCompare(b.date || "9999")
        : sort === "name" ? a.name.localeCompare(b.name, "he")
        : b.savedAt.localeCompare(a.savedAt));
  }, [orders, query, sort, filter]);

  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const upcoming = orders.filter((o) => !isPast(o.date)).length;

  return (
    <main className="mx-auto w-[min(1180px,92vw)] pb-24 pt-[clamp(2rem,6vh,4rem)]">
      <header className="flex flex-wrap items-center gap-x-8 gap-y-6 border-b border-border pb-6">
        <img src={`${ASSETS}/img/brand/logo.webp`} alt="ניחוחות השף" className="h-[74px] w-auto flex-none" />
        <div className="flex flex-1 gap-9">
          <Stat n={orders.length} label="הזמנות" />
          <Stat n={upcoming} label="עתידיות" />
          <Stat n={`${revenue.toLocaleString("he-IL")} ${CURRENCY}`} label="סך הכל" />
        </div>
        <div className="flex flex-none gap-2">
          <a href="/" className={chip}>לאתר</a>
          <button type="button" onClick={() => { sessionStorage.removeItem("nichochot-admin"); onLogout(); }} className={chip}>
            יציאה
          </button>
        </div>
      </header>

      {/* סינון לפי מצב */}
      <div className="mt-7 flex flex-wrap gap-2">
        {([["all", "הכל"], ["new", "חדשות"], ["progress", "בתהליך"], ["done", "בוצעו"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-[.86rem] transition ${
              filter === k
                ? k === "progress" ? "border-[#e0a765] bg-[#e0a765] font-medium text-background"
                : k === "done" ? "border-[#8fce9b] bg-[#8fce9b] font-medium text-background"
                : "border-foreground bg-foreground font-medium text-background"
                : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
            }`}>
            {l}
            <em className={`not-italic rounded-full px-1.5 text-[.72rem] tabular-nums ${
              filter === k ? "bg-background/15" : "bg-foreground/10"}`}>{counts[k]}</em>
          </button>
        ))}
      </div>

      {/* חיפוש ומיון */}
      <div className="my-6 flex flex-wrap justify-between gap-4">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="חיפוש לפי שם, מיקום, סוג או תאריך"
          className="min-w-60 flex-1 rounded-full border border-border bg-transparent px-5 py-2.5 text-[.95rem] outline-none focus:border-foreground" />
        <div className="flex flex-wrap gap-2">
          {([["date", "לפי תאריך"], ["name", "לפי שם"], ["new", "האחרונות"]] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setSort(k)}
              className={`rounded-full border px-4 py-2 text-[.84rem] transition ${
                sort === k ? "border-foreground bg-foreground font-medium text-background"
                           : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">
          {orders.length ? "אין הזמנות שתואמות לסינון הזה." : "עדיין אין הזמנות שמורות."}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {shown.map((o) => {
            const st = statusOf(o);
            return (
              <article key={o.id} className={`relative overflow-hidden rounded-[14px] border transition ${
                st === "progress" ? "border-[#e0a765]/35" : st === "done" ? "border-[#8fce9b]/30" : "border-border hover:border-foreground/35"
              } ${isPast(o.date) ? "opacity-55" : ""}`}>
                {/* סימוני מצב */}
                <div className="absolute start-3.5 top-4 z-[2] flex gap-1.5">
                  <button type="button" title="בתהליך" aria-label="סימון כבתהליך" onClick={() => setStatus(o.id, "progress")}
                    className={`grid h-[26px] w-[26px] place-items-center rounded-full border transition ${
                      st === "progress" ? "border-[#e0a765] bg-[#e0a765]" : "border-border hover:border-foreground/50"}`}>
                    <span className={`h-2 w-2 rounded-full ${st === "progress" ? "bg-[#2a1c08]" : "bg-muted-foreground"}`} />
                  </button>
                  <button type="button" title="בוצעה" aria-label="סימון כבוצעה" onClick={() => setStatus(o.id, "done")}
                    className={`grid h-[26px] w-[26px] place-items-center rounded-full border transition ${
                      st === "done" ? "border-[#8fce9b] bg-[#8fce9b]" : "border-border hover:border-foreground/50"}`}>
                    <Check className={`h-3.5 w-3.5 ${st === "done" ? "text-[#0d2a12]" : "text-muted-foreground"}`} strokeWidth={2.5} />
                  </button>
                </div>

                <button type="button" onClick={() => setOpen(open === o.id ? null : o.id)}
                  className="grid w-full grid-cols-[minmax(120px,.8fr)_minmax(160px,1.6fr)_minmax(110px,.8fr)_auto_22px] items-center gap-4 py-4 pe-5 ps-[4.6rem] text-start transition hover:bg-foreground/[.05] max-[700px]:grid-cols-[1fr_22px] max-[700px]:gap-2 max-[700px]:pt-11 max-[700px]:ps-5">
                  <span>
                    <b className="block font-medium tabular-nums [direction:ltr] [unicode-bidi:isolate]">{dateHe(o.date)}</b>
                    <i className="mt-0.5 block text-[.78rem] not-italic text-muted-foreground">
                      {dayName(o.date)}{o.time ? ` · ${o.time}` : ""}
                    </i>
                  </span>
                  <span>
                    <b className="block font-medium">{o.name}</b>
                    <i className="mt-0.5 block text-[.78rem] not-italic text-muted-foreground">{o.type} · {o.place}</i>
                  </span>
                  <span>
                    <b className="block font-medium tabular-nums">{o.total.toLocaleString("he-IL")} {CURRENCY}</b>
                    <i className="mt-0.5 block text-[.78rem] not-italic text-muted-foreground">{o.guests} סועדים</i>
                  </span>
                  <span className={`justify-self-end rounded-full border px-2.5 py-0.5 text-[.7rem] tracking-[.08em] max-[700px]:justify-self-start ${
                    st === "progress" ? "border-[#e0a765] text-[#e0a765]"
                    : st === "done" ? "border-[#8fce9b] text-[#8fce9b]" : "border-border text-muted-foreground"}`}>
                    {STATUS[st].label}
                  </span>
                  <span className={`justify-self-end h-2 w-2 rotate-[-45deg] border-b border-s border-muted-foreground transition-transform ${
                    open === o.id ? "rotate-[135deg]" : ""}`} />
                </button>

                {open === o.id && (
                  <div className="border-t border-border bg-foreground/[.03] px-5 py-5">
                    <dl className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-6 gap-y-3.5">
                      <Fact k="מועד" v={o.program} />
                      <Fact k="חבילה" v={`${o.pkg} — ${o.pkgPrice} ${CURRENCY} לסועד`} />
                      <Fact k="עריכת שולחן" v={o.setting} />
                      <Fact k="מלצרים" v={o.waiters ? "כן" : "לא"} />
                      <Fact k="שתייה" v={o.drinks ? "כן" : "לא"} />
                      {o.addons.length > 0 && <Fact k="תוספות" v={o.addons.join(", ")} />}
                      <Fact k="מחיר לסועד" v={`${o.perGuest} ${CURRENCY}`} />
                      {o.units > 0 && <Fact k="תוספות לפי כמות" v={`${o.units.toLocaleString("he-IL")} ${CURRENCY}`} />}
                      <Fact k="נשמר" v={new Date(o.savedAt).toLocaleString("he-IL")} />
                    </dl>

                    <div className="flex flex-col gap-3.5 border-y border-border py-5">
                      {Object.entries(o.lines).map(([label, items]) => (
                        <div key={label}>
                          <h4 className="mb-1 text-[.76rem] font-normal tracking-[.1em] text-muted-foreground">{label}</h4>
                          <p className="text-[.92rem] leading-relaxed">{items.join(" · ")}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2.5">
                      {o.date && (
                        <>
                          <a href={googleCalUrl(o)} target="_blank" rel="noopener"
                            className="rounded-full border border-border px-5 py-2 text-[.85rem] transition hover:border-[#f0d795] hover:bg-[#f0d795] hover:text-background">
                            שמירה ביומן גוגל
                          </a>
                          <button type="button" onClick={() => downloadIcs(o)} className={actBtn}>קובץ יומן (ics)</button>
                        </>
                      )}
                      <button type="button" onClick={() => copy(o.text)} className={actBtn}>העתקת ההזמנה</button>
                      <button type="button"
                        onClick={() => {
                          if (armed !== o.id) { setArmed(o.id); setTimeout(() => setArmed(null), 3000); return; }
                          commit(orders.filter((x) => x.id !== o.id));
                          setArmed(null);
                        }}
                        className="rounded-full border border-[#e57373]/35 px-5 py-2 text-[.85rem] text-[#e57373] transition hover:border-[#e57373] hover:bg-[#e57373] hover:text-background">
                        {armed === o.id ? "למחוק? לחצו שוב" : "מחיקה"}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {orders.length > 0 && (
        <div className="mt-10 flex flex-wrap gap-2.5 border-t border-border pt-6">
          <button type="button" onClick={() => downloadJson(orders)} className={actBtn}>ייצוא לקובץ</button>
          <button type="button" className={actBtn}
            onClick={() => copy(orders.slice().sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"))
              .map((o) => o.text).join("\n\n" + "─".repeat(30) + "\n\n"))}>
            העתקת הכל
          </button>
          <button type="button"
            onClick={() => {
              if (armed !== "ALL") { setArmed("ALL"); setTimeout(() => setArmed(null), 3000); return; }
              commit([]); setArmed(null);
            }}
            className="rounded-full border border-[#e57373]/35 px-5 py-2 text-[.85rem] text-[#e57373] transition hover:border-[#e57373] hover:bg-[#e57373] hover:text-background">
            {armed === "ALL" ? "למחוק הכל? לחצו שוב" : "מחיקת כל ההזמנות"}
          </button>
        </div>
      )}
    </main>
  );
}

/* ---------- עזר ---------- */
const chip =
  "rounded-full border border-border px-5 py-2 text-[.86rem] text-foreground no-underline transition hover:border-foreground hover:bg-foreground hover:text-background";
const actBtn =
  "rounded-full border border-border px-5 py-2 text-[.85rem] transition hover:border-foreground hover:bg-foreground hover:text-background";

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div>
      <b className="block text-[clamp(1.3rem,3vw,1.8rem)] font-medium tabular-nums">{n}</b>
      <span className="text-[.76rem] tracking-[.1em] text-muted-foreground">{label}</span>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[.72rem] tracking-[.1em] text-muted-foreground">{k}</dt>
      <dd className="mt-0.5 text-[.92rem]">{v}</dd>
    </div>
  );
}

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ההעתקה נחסמה */ }
}

function saveBlob(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

const downloadIcs = (o: SavedOrder) =>
  saveBlob(new Blob([icsFor(o)], { type: "text/calendar;charset=utf-8" }), `${o.name}-${o.date}.ics`);

const downloadJson = (list: SavedOrder[]) =>
  saveBlob(new Blob([JSON.stringify(list, null, 2)], { type: "application/json" }),
    `הזמנות-${new Date().toISOString().slice(0, 10)}.json`);
