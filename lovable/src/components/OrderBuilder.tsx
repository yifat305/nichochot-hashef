import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Minus, Plus, Search, ShoppingBasket, X } from "lucide-react";
import {
  ALL_TABLES, ASSETS, BOTTLE_SPARE, COLORS, DESSERT_SPARE, EMAIL, EVENT_TYPES,
  GUESTS_PER_BOTTLE, Item, MENU, MIN_GUESTS, PHONE, PORCELAIN_TABLE, PROGRAMS,
  SavedOrder, WHATSAPP, dateHe, loadOrders, money, saveOrders, tableById,
} from "@/data/menu";

type ProgKey = "weekday" | "shabbat";
type TableMode = "preset" | "custom" | "open";

/**
 * בניית ההזמנה.
 *
 * תמחור:
 *   חבילה                      → מחיר לסועד × מספר סועדים
 *   פריט extra בקבוצת בחירה     → תוספת לסועד
 *   תוספת תוכנית (שתייה חריפה)  → תוספת לסועד
 *   קבוצת כמות (פתיחה/קינוח)    → מחיר ליחידה × כמות
 *   שתייה                       → כלולה, מוגבלת במכסה
 */
export function OrderBuilder() {
  const [program, setProgram] = useState<ProgKey>("weekday");
  const [guests, setGuests] = useState(30);
  const [pkgId, setPkgId] = useState(2);
  const [picks, setPicks] = useState<Record<string, string[]>>(() => initPicks("weekday"));
  const [qty, setQty] = useState<Record<string, Record<string, number>>>({});
  const [addons, setAddons] = useState<string[]>([]);
  const [tableMode, setTableMode] = useState<TableMode>("preset");
  const [preset, setPreset] = useState<string | null>(null);
  const [colors, setColors] = useState<string[]>([]);
  const [tableText, setTableText] = useState("");
  const [zoom, setZoom] = useState<Item | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [showBasket, setShowBasket] = useState(false);
  const [active, setActive] = useState<string>("");
  const [details, setDetails] = useState({
    name: "", date: "", time: "", place: "", type: "", typeOther: "",
  });

  const prog = PROGRAMS[program];
  const pkg = prog.packages.find((p) => p.id === pkgId) ?? prog.packages[0];
  const navRef = useRef<HTMLElement>(null);

  /* ---------- מכסות ---------- */
  const bottlesMax = Math.ceil(guests / GUESTS_PER_BOTTLE) + BOTTLE_SPARE;
  const bottlesUsed = sum(Object.values(qty.drinks ?? {}));
  const dessertQty = guests + DESSERT_SPARE;

  /* ---------- חישוב ---------- */
  const totals = useMemo(() => {
    let perGuest = pkg.price;
    for (const g of prog.groups) {
      if (g.mode === "qty" || g.mode === "bottles") continue;
      for (const id of picks[g.key] ?? []) perGuest += itemOf(g.key, id)?.extra ?? 0;
    }
    for (const a of prog.addons) if (addons.includes(a.id)) perGuest += a.price;

    let units = 0;
    for (const g of prog.groups) {
      if (g.mode !== "qty") continue;
      for (const [id, n] of Object.entries(qty[g.key] ?? {})) units += (itemOf(g.key, id)?.extra ?? 0) * n;
    }
    return { perGuest, units, total: perGuest * guests + units };
  }, [prog, pkg, picks, qty, addons, guests]);

  /* ---------- מקטעים לניווט ---------- */
  const sections = useMemo(() => {
    let meal: string | null = null;
    return [
      { id: "sec-setup", label: "פרטי האירוע" },
      { id: "sec-packs", label: "חבילות" },
      ...(pkg.setting ? [{ id: "sec-table", label: "עריכת שולחן" }] : []),
      /* שם הסעודה מוגדר רק על הקבוצה הראשונה שלה — נושאים אותו הלאה,
         אחרת שתי קבוצות "תוספות" בשבת נראות זהות */
      ...prog.groups
        .filter((g) => !(g.needs && !pkg[g.needs]))
        .map((g) => {
          if (g.meal) meal = g.meal;
          return {
            id: "sec-" + g.key,
            label: meal && meal !== g.label ? `${meal} · ${g.label}` : g.label,
          };
        }),
    ];
  }, [prog, pkg]);

  /* מסמן את המקטע שנמצא כרגע מתחת לתפריט */
  useEffect(() => {
    const seen = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => seen.set(e.target.id, e.intersectionRatio));
        let best = "", bestRatio = 0;
        seen.forEach((r, id) => { if (r > bestRatio) { bestRatio = r; best = id; } });
        if (best) setActive(best);
      },
      { threshold: [0, 0.15, 0.35, 0.6], rootMargin: "-90px 0px -55% 0px" },
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  /* הסל נסגר גם ב-Escape וגם בלחיצה מחוץ לו — לא רק בכפתור */
  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSheetOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  /* הכפתור הצף מופיע רק כשמגיעים למקטע ההזמנה */
  useEffect(() => {
    const el = document.getElementById("sec-setup");
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShowBasket(e.boundingClientRect.top < window.innerHeight * 0.6),
      { threshold: 0, rootMargin: "0px 0px -40% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function goTo(id: string) {
    const t = document.getElementById(id);
    const nav = navRef.current;
    if (!t || !nav) return;
    window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - (nav.offsetHeight + 18), behavior: "smooth" });
  }

  /* ---------- פעולות ---------- */
  function switchProgram(next: ProgKey) {
    if (next === program) return;
    setProgram(next);
    setPicks(initPicks(next));
    setQty({});
    setAddons([]);
    if (!PROGRAMS[next].packages.some((p) => p.id === pkgId)) setPkgId(PROGRAMS[next].packages[0].id);
  }

  function togglePick(key: string, id: string, limit: number) {
    setPicks((prev) => {
      const cur = prev[key] ?? [];
      if (cur.includes(id)) return { ...prev, [key]: cur.filter((x) => x !== id) };
      if (cur.length < limit) return { ...prev, [key]: [...cur, id] };
      return { ...prev, [key]: [...cur.slice(1), id] }; // מעל המכסה — מחליף את הישן
    });
  }

  function setQuantity(key: string, id: string, n: number) {
    let v = Math.max(0, Math.min(9999, n));
    if (key === "drinks") {
      const others = bottlesUsed - (qty.drinks?.[id] ?? 0);
      v = Math.min(v, Math.max(0, bottlesMax - others));
    }
    setQty((prev) => {
      const group = { ...(prev[key] ?? {}) };
      if (v) group[id] = v;
      else delete group[id];
      return { ...prev, [key]: group };
    });
  }

  function changeGuests(n: number) {
    const g = Math.max(MIN_GUESTS, n || MIN_GUESTS);
    setGuests(g);
    /* המכסה מצטמצמת — מגלחים את העודף מהמשקה האחרון כלפי מעלה */
    const max = Math.ceil(g / GUESTS_PER_BOTTLE) + BOTTLE_SPARE;
    setQty((prev) => {
      const d = { ...(prev.drinks ?? {}) };
      let over = sum(Object.values(d)) - max;
      if (over <= 0) return prev;
      for (const it of [...MENU.drinks].reverse()) {
        if (over <= 0) break;
        const take = Math.min(d[it.id] ?? 0, over);
        if (!take) continue;
        d[it.id] -= take;
        over -= take;
        if (!d[it.id]) delete d[it.id];
      }
      return { ...prev, drinks: d };
    });
  }

  function spreadBottles() {
    const items = MENU.drinks.filter((i) => !i.unlimited);
    const base = Math.floor(bottlesMax / items.length);
    let rest = bottlesMax % items.length;
    const next: Record<string, number> = {};
    for (const it of items) {
      const n = base + (rest-- > 0 ? 1 : 0);
      if (n) next[it.id] = n;
    }
    setQty((prev) => ({ ...prev, drinks: next }));
  }

  function pickTable(id: string) {
    const chosen = preset === id ? null : id;
    setPreset(chosen);
    /* עריכת פורצלן קיימת רק בחבילה שמגישה בפורצלן — בוחרים אותה, מקבלים אותה.
       בשבת אין חבילת פורצלן, ולכן שם אין למה לשדרג. */
    const t = tableById(id) as (Item & { requiresPkg?: number }) | undefined;
    const target = t?.requiresPkg && prog.packages.find((p) => p.id === t.requiresPkg);
    if (chosen && target && target.setting === "פורצלן") setPkgId(target.id);
  }

  const eventType = () =>
    details.type === "אחר" ? details.typeOther.trim() || "אחר" : details.type;

  const tableSummary = () => {
    if (tableMode === "preset") return tableById(preset)?.name ?? "טרם נבחר";
    if (tableMode === "custom")
      return colors.length
        ? `הרכבה אישית: ${COLORS.filter((c) => colors.includes(c.id)).map((c) => c.name).join(", ")}`
        : "הרכבה אישית — טרם נבחרו צבעים";
    return tableText.trim() ? `בקשה חופשית: ${tableText.trim()}` : "בקשה חופשית — טרם מולאה";
  };

  /* לא חוזרים על אותה מילה פעמיים כשהעיצוב הנבחר הוא הפורצלן עצמו */
  const settingLabel = () => {
    const ts = tableSummary();
    return ts === pkg.setting ? ts : `${pkg.setting} · ${ts}`;
  };

  /* ---------- שורות ההזמנה ---------- */
  const rows = useMemo(() => {
    let meal: string | null = null;
    return prog.groups
      .filter((g) => !(g.needs && !pkg[g.needs]))
      .map((g) => {
        if (g.meal) meal = g.meal;
        let names: string[] = [], count = "";
        if (g.mode === "bottles") {
          names = MENU[g.key]
            .filter((i) => i.unlimited || (qty[g.key]?.[i.id] ?? 0) > 0)
            .map((i) => (i.unlimited ? i.name : `${i.name} ×${qty[g.key]![i.id]}`));
          count = `${bottlesUsed}/${bottlesMax}`;
        } else if (g.mode === "qty") {
          names = MENU[g.key].filter((i) => (qty[g.key]?.[i.id] ?? 0) > 0).map((i) => `${i.name} ×${qty[g.key]![i.id]}`);
        } else {
          names = MENU[g.key].filter((i) => (picks[g.key] ?? []).includes(i.id)).map((i) => i.name);
          count = `${names.length}/${g.pick}`;
        }
        const blank = g.mode === "qty" ? "ללא" : "טרם נבחר";
        return {
          key: g.key,
          label: meal && meal !== g.label ? `${meal} · ${g.label}` : g.label,
          count,
          short: names.length > 4 ? names.slice(0, 4).join(", ") + ` ועוד ${names.length - 4}` : names.join(", ") || blank,
          empty: names.length === 0,
          missing: names.length === 0 && g.mode === "pick",
          full: g.pick ? names.length === g.pick : true,
          names,
        };
      });
  }, [prog, pkg, picks, qty, bottlesUsed, bottlesMax]);

  function orderText() {
    const lines: string[] = [];
    let meal: string | null = null;
    for (const g of prog.groups) {
      if (g.needs && !pkg[g.needs]) continue;
      if (g.meal && g.meal !== meal) { meal = g.meal; lines.push("", `— ${meal} —`); }

      if (g.mode === "bottles") {
        const picked = MENU[g.key]
          .filter((i) => i.unlimited || (qty[g.key]?.[i.id] ?? 0) > 0)
          .map((i) => (i.unlimited ? `${i.name} — ללא הגבלה` : `${i.name} × ${qty[g.key]![i.id]}`));
        lines.push(`${g.label} (${bottlesUsed}/${bottlesMax} בקבוקים): ${picked.join(" · ") || "ללא"}`);
      } else if (g.mode === "qty") {
        const picked = MENU[g.key]
          .filter((i) => (qty[g.key]?.[i.id] ?? 0) > 0)
          .map((i) => `${i.name} × ${qty[g.key]![i.id]} = ${money(i.extra! * qty[g.key]![i.id])}`);
        lines.push(`${g.label}: ${picked.join(" · ") || "ללא"}`);
      } else {
        const names = MENU[g.key]
          .filter((i) => (picks[g.key] ?? []).includes(i.id))
          .map((i) => (i.extra ? `${i.name} (+${money(i.extra)} לסועד)` : i.name));
        lines.push(`${g.label} (${names.length}/${g.pick}): ${names.join(", ") || "—"}`);
      }
    }
    const extra = prog.addons.filter((a) => addons.includes(a.id)).map((a) => `${a.name} (+${money(a.price)} לסועד)`);
    return [
      "הזמנת קייטרינג — ניחוחות השף",
      `שם המזמין: ${details.name || "—"}`,
      `סוג האירוע: ${eventType() || "—"}`,
      `תאריך: ${dateHe(details.date)}${details.time ? ` · שעה ${details.time}` : ""}`,
      `מיקום: ${details.place || "—"}`,
      "",
      `מועד: ${prog.label}`,
      `סועדים: ${guests}`,
      `חבילה: ${pkg.name} — ${money(pkg.price)} לסועד`,
      pkg.setting ? `עריכת שולחן: ${settingLabel()}` : "עריכת שולחן: ללא",
      `מלצרים: ${pkg.waiters ? "כן" : "לא"} · שתייה: ${pkg.drinks ? "כן" : "לא"}`,
      ...lines,
      ...(extra.length ? ["", `תוספות: ${extra.join(", ")}`] : []),
      "",
      `${money(totals.perGuest)} × ${guests} סועדים = ${money(totals.perGuest * guests)}`,
      ...(totals.units ? [`תוספות לפי כמות: ${money(totals.units)}`] : []),
      `סה״כ: ${money(totals.total)}`,
    ].join("\n");
  }

  /* ---------- שמירה לפאנל הניהול ---------- */
  function saveOrder() {
    const lines: Record<string, string[]> = {};
    for (const r of rows) if (r.names.length) lines[r.label] = r.names;

    const rec: SavedOrder = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      savedAt: new Date().toISOString(),
      status: "new",
      name: details.name.trim(),
      type: eventType(),
      date: details.date,
      time: details.time,
      place: details.place.trim(),
      program: prog.label,
      guests,
      pkg: pkg.name,
      pkgPrice: pkg.price,
      setting: pkg.setting ? settingLabel() : "ללא",
      waiters: pkg.waiters,
      drinks: pkg.drinks,
      addons: prog.addons.filter((a) => addons.includes(a.id)).map((a) => a.name),
      lines,
      perGuest: totals.perGuest,
      units: totals.units,
      total: totals.total,
      text: orderText(),
    };
    saveOrders([...loadOrders(), rec]);
  }

  const missing = [
    ...([["name", "שם המזמין"], ["type", "סוג האירוע"], ["date", "תאריך"], ["time", "שעה"], ["place", "מיקום"]] as const)
      .filter(([k]) => !details[k].trim()).map(([, label]) => label),
    ...prog.groups
      .filter((g) => g.mode === "pick" && (picks[g.key] ?? []).length < Math.min(g.pick!, MENU[g.key].length))
      .map((g) => g.label),
  ];

  const setD = (k: keyof typeof details, v: string) => setDetails((p) => ({ ...p, [k]: v }));

  /* מה שכבר בסל — לתג על הכפתור הצף */
  const chosenCount = useMemo(
    () => rows.reduce((n, r) => n + r.names.length, 0) + addons.length,
    [rows, addons],
  );

  /* ============================================================ */
  return (
    <>
      {/* תפריט ניווט דביק */}
      <nav
        ref={navRef}
        className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/90 px-[clamp(.8rem,4vw,2rem)] py-2.5 backdrop-blur-2xl"
      >
        <img src={`${ASSETS}/img/brand/logo.webp`} alt="ניחוחות השף" className="h-[38px] w-auto flex-none max-sm:h-[30px]" />
        <div className="flex flex-1 gap-1.5 overflow-x-auto [mask-image:linear-gradient(to_left,transparent_0,#000_22px,#000_calc(100%-22px),transparent_100%)] [scrollbar-width:none]">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(s.id)}
              className={`flex-none whitespace-nowrap rounded-full border px-4 py-2 text-[.84rem] transition ${
                active === s.id
                  ? "border-[#f0d795] bg-[#f0d795] font-medium text-background"
                  : "border-transparent text-muted-foreground hover:bg-foreground/[.07] hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <a
          href="/admin"
          className="flex-none whitespace-nowrap rounded-full border border-border px-4 py-2 text-[.8rem] text-muted-foreground transition hover:border-[#f0d795] hover:bg-[#f0d795] hover:text-background"
        >
          ניהול הזמנות
        </a>
      </nav>

      <section className="mx-auto w-[min(1240px,92vw)] pb-40 pt-[clamp(4rem,11vh,7rem)]">
        <header className="mb-11">
          <p className="mb-[.9rem] text-[.72rem] font-medium tracking-[.3em] text-muted-foreground">בניית הזמנה</p>
          <h2 className="text-[clamp(2rem,5.5vw,3.4rem)] font-light leading-[1.08] tracking-[-0.02em]">מרכיבים את האירוע</h2>
        </header>

        {/* פרטי האירוע */}
        <div id="sec-setup" className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-6 border-y border-border py-8">
          <Field label="שם המזמין">
            <input type="text" autoComplete="name" placeholder="שם מלא" value={details.name}
              onChange={(e) => setD("name", e.target.value)} className={txt} />
          </Field>

          <Field label="סוג האירוע">
            <select value={details.type} onChange={(e) => setD("type", e.target.value)} className={`${txt} cursor-pointer`}>
              <option value="">בחרו סוג אירוע</option>
              {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>

          {details.type === "אחר" && (
            <Field label="פרטו">
              <input type="text" placeholder="איזה אירוע?" value={details.typeOther}
                onChange={(e) => setD("typeOther", e.target.value)} className={txt} />
            </Field>
          )}

          <Field label="תאריך האירוע">
            <input type="date" value={details.date} onChange={(e) => setD("date", e.target.value)}
              className={`${txt} [color-scheme:dark] [direction:ltr]`} />
          </Field>

          <Field label="שעת האירוע">
            <input type="time" step={300} value={details.time} onChange={(e) => setD("time", e.target.value)}
              className={`${txt} [color-scheme:dark] [direction:ltr]`} />
          </Field>

          <Field label="מיקום האירוע">
            <input type="text" placeholder="אולם / כתובת / יישוב" value={details.place}
              onChange={(e) => setD("place", e.target.value)} className={txt} />
          </Field>

          <Field label="מספר סועדים" note={`מינימום ${MIN_GUESTS} סועדים`}>
            <input type="number" inputMode="numeric" min={MIN_GUESTS} value={guests}
              onChange={(e) => changeGuests(parseInt(e.target.value || "0", 10))}
              className="w-full border-0 border-b border-border bg-transparent pb-1 text-[2.2rem] font-light tabular-nums outline-none focus:border-foreground" />
          </Field>

          <Field label="מועד האירוע" note="לשבת תפריט ומחירון נפרדים">
            <div className="flex w-fit overflow-hidden rounded-full border border-border" role="group">
              {(["weekday", "shabbat"] as ProgKey[]).map((k) => (
                <button key={k} type="button" onClick={() => switchProgram(k)}
                  className={`px-5 py-2.5 text-[.88rem] transition ${
                    program === k ? "bg-foreground font-medium text-background" : "text-muted-foreground"
                  }`}>
                  {PROGRAMS[k].label}
                </button>
              ))}
            </div>
          </Field>
        </div>

        {/* חבילות */}
        <div id="sec-packs">
          <GroupTitle title="בחירת חבילה" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {prog.packages.map((p) => (
              <button key={p.id} type="button" onClick={() => setPkgId(p.id)}
                className={`rounded-[20px] border p-6 text-start transition ${
                  pkgId === p.id ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/40"
                }`}>
                <span className="block text-base font-medium">{p.name}</span>
                <span className="my-4 flex items-baseline gap-2">
                  <b className="text-[2.2rem] font-light tabular-nums">{money(p.price)}</b>
                  <i className="text-[.78rem] not-italic text-muted-foreground">לסועד</i>
                </span>
                <ul className="flex flex-col gap-2 text-[.85rem]">
                  {[...new Set(prog.groups.filter((g) => g.mode !== "qty" && !g.needs).map((g) =>
                    g.mode === "pick" ? `${g.pick} ${g.label}` : g.label))].map((x) => <Line key={x} yes>{x}</Line>)}
                  <Line yes={p.waiters}>שירות מלצרים</Line>
                  <Line yes={p.drinks}>שירות שתייה</Line>
                  <Line yes={!!p.setting}>עריכת שולחן{p.setting ? ` ${p.setting}` : ""}</Line>
                </ul>
              </button>
            ))}
          </div>
        </div>

        {/* עריכת שולחן */}
        {pkg.setting && (
          <div id="sec-table">
            <GroupTitle title="עריכת שולחן" badge={settingLabel()} dashed />
            <div className="mb-6 flex flex-wrap gap-2">
              {([["preset", "עיצובים מוכנים"], ["custom", "הרכבה אישית"], ["open", "בקשה חופשית"]] as const).map(([m, label]) => (
                <button key={m} type="button" onClick={() => setTableMode(m)}
                  className={`rounded-full border px-5 py-2 text-[.86rem] transition ${
                    tableMode === m
                      ? "border-foreground bg-foreground font-medium text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}>
                  {label}
                </button>
              ))}
            </div>

            {tableMode === "preset" && (
              <Grid>
                {ALL_TABLES.map((t) => {
                  const up = (t as Item & { requiresPkg?: number }).requiresPkg;
                  return (
                    <Card key={t.id} item={t} on={preset === t.id} upgrade={!!up}
                      price={up ? "משדרג לחבילת פורצלן" : undefined}
                      onPick={() => pickTable(t.id)} onZoom={() => setZoom(t)} tick />
                  );
                })}
              </Grid>
            )}

            {tableMode === "custom" && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
                {COLORS.map((c) => (
                  <button key={c.id} type="button"
                    onClick={() => setColors((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))}
                    className={`flex flex-col items-center gap-2 rounded-[14px] border p-3.5 transition ${
                      colors.includes(c.id) ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/45"
                    }`}>
                    <span className={`h-[34px] w-[34px] rounded-full shadow-[inset_0_0_0_1px_rgba(11,12,14,.35)] transition ${
                      colors.includes(c.id) ? "scale-110 ring-2 ring-foreground" : ""}`} style={{ background: c.hex }} />
                    <span className="text-[.78rem]">{c.name}</span>
                  </button>
                ))}
              </div>
            )}

            {tableMode === "open" && (
              <label className="flex flex-col gap-3">
                <span className="text-[.82rem] tracking-[.06em] text-muted-foreground">ספרו לנו איך אתם רוצים שהשולחן ייראה</span>
                <textarea rows={4} value={tableText} onChange={(e) => setTableText(e.target.value)}
                  placeholder="למשל: מפה לבנה, מפיות בורדו, נרות גבוהים וסידור פרחים נמוך"
                  className="w-full resize-y rounded-[14px] border border-border bg-transparent p-4 text-[.95rem] leading-relaxed outline-none focus:border-foreground" />
              </label>
            )}
          </div>
        )}

        {/* קבוצות התפריט */}
        {prog.groups.map((g) => {
          if (g.needs && !pkg[g.needs]) return null;
          const items = MENU[g.key];
          const chosen = picks[g.key] ?? [];

          return (
            <div key={`${program}-${g.key}`} id={"sec-" + g.key}>
              {g.meal && (
                <h2 className="mb-0 mt-16 border-b border-border pb-4 text-[clamp(1.7rem,4.5vw,2.6rem)] font-light tracking-[-0.01em]">
                  {g.meal}
                </h2>
              )}

              <GroupTitle
                title={g.label}
                badge={g.mode === "pick" ? `${chosen.length} / ${g.pick}`
                  : g.mode === "bottles" ? `${bottlesUsed} / ${bottlesMax} בקבוקים` : "רשות · לפי כמות"}
                full={g.mode === "pick" ? chosen.length === g.pick : g.mode === "bottles" ? bottlesUsed >= bottlesMax : false}
                dashed={g.mode === "qty"}
                ltrBadge={g.mode !== "qty"}
              />

              {g.key === "dessert" && (
                <Note>
                  מנה לכל סועד <b className="font-medium text-foreground">+ {DESSERT_SPARE} ספייר</b>. לפי{" "}
                  <b className="font-medium tabular-nums text-foreground">{guests}</b> סועדים —{" "}
                  <b className="font-medium tabular-nums text-foreground">{dessertQty}</b> מנות. לחיצה על תמונה ממלאת את הכמות.
                </Note>
              )}

              {g.mode === "bottles" && (
                <Note action={
                  <button type="button" onClick={spreadBottles}
                    className="flex-none rounded-full border border-border px-4 py-2 text-[.82rem] transition hover:border-foreground hover:bg-foreground hover:text-background">
                    פיזור שווה
                  </button>
                }>
                  בקבוק אחד לכל {GUESTS_PER_BOTTLE} סועדים <b className="font-medium text-foreground">+ {BOTTLE_SPARE} ספייר</b>. לפי{" "}
                  <b className="font-medium tabular-nums text-foreground">{guests}</b> סועדים — עד{" "}
                  <b className="font-medium tabular-nums text-foreground">{bottlesMax}</b> בקבוקים.
                </Note>
              )}

              {g.mode === "bottles" ? (
                <div className="flex flex-col overflow-hidden rounded-b-[14px] border border-t-0 border-border">
                  {items.map((it) => {
                    const n = qty[g.key]?.[it.id] ?? 0;
                    return (
                      <div key={it.id} className={`flex items-center justify-between gap-4 border-t border-border px-4 py-3 transition first:border-t-0 ${
                        it.unlimited || n > 0 ? "bg-foreground/[.06]" : ""}`}>
                        <span className="flex min-w-0 items-baseline gap-2.5">
                          <b className={`text-[.98rem] font-medium ${it.unlimited || n > 0 ? "" : "text-muted-foreground"}`}>{it.name}</b>
                          {it.note && <i className="text-[.76rem] not-italic text-foreground/45">{it.note}</i>}
                        </span>
                        {it.unlimited ? (
                          <span className="flex-none rounded-full bg-foreground px-4 py-1.5 text-[.78rem] tracking-[.06em] text-background">ללא הגבלה</span>
                        ) : (
                          <Stepper n={n} onChange={(v) => setQuantity(g.key, it.id, v)} name={it.name} />
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <Grid>
                  {items.map((it) =>
                    g.mode === "qty" ? (
                      <Card key={it.id} item={it} on={(qty[g.key]?.[it.id] ?? 0) > 0} onZoom={() => setZoom(it)}
                        onPick={() => setQuantity(g.key, it.id, (qty[g.key]?.[it.id] ?? 0) ? 0 : g.key === "dessert" ? dessertQty : guests)}
                        price={`+${money(it.extra!)} ליחידה`}
                        stepper={<Stepper n={qty[g.key]?.[it.id] ?? 0} onChange={(v) => setQuantity(g.key, it.id, v)} name={it.name} />} />
                    ) : (
                      <Card key={it.id} item={it} on={chosen.includes(it.id)} onPick={() => togglePick(g.key, it.id, g.pick!)}
                        onZoom={() => setZoom(it)} price={it.extra ? `+${money(it.extra)} לסועד` : undefined} tick />
                    ),
                  )}
                </Grid>
              )}
            </div>
          );
        })}

        {/* תוספות התוכנית */}
        {prog.addons.length > 0 && (
          <>
            <GroupTitle title="תוספות" badge="לסועד" dashed />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {prog.addons.map((a) => (
                <button key={a.id} type="button"
                  onClick={() => setAddons((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                  className={`relative flex flex-col gap-1 rounded-[14px] border p-5 text-start transition ${
                    addons.includes(a.id) ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/40"
                  }`}>
                  <span className="text-base font-medium">{a.name}</span>
                  <span className="text-[.8rem] tabular-nums text-muted-foreground">+{money(a.price)} לסועד</span>
                  {addons.includes(a.id) && <Check className="absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2" strokeWidth={2.5} />}
                </button>
              ))}
            </div>
          </>
        )}

        {/* יצירת קשר */}
        <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-border pt-10">
          <img src={`${ASSETS}/img/brand/logo.webp`} alt="ניחוחות השף — קייטרינג ואירוח"
            className="h-[clamp(88px,12vw,132px)] w-auto flex-none" />
          <div className="flex flex-col gap-3.5">
            <p className="text-[.86rem] text-muted-foreground">אפשר גם ישירות:</p>
            <div className="flex flex-wrap gap-3">
              <a href={`tel:+${WHATSAPP}`} className={contactLink}>{PHONE}</a>
              <a href={`mailto:${EMAIL}?subject=${encodeURIComponent("הזמנת קייטרינג — " + prog.label)}&body=${encodeURIComponent(orderText())}`}
                className={contactLink}>{EMAIL}</a>
            </div>
          </div>
        </div>
      </section>

      {/* כפתור הסל הצף.
          זהב מלא ולא עיגול כהה — על רקע וידאו כהה הוא היה נבלע.
          מופיע רק אחרי שגוללים אל ההזמנה, כי מעל הסרטון אין לו עדיין תוכן. */}
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        aria-label={`סל ההזמנה — ${chosenCount} פריטים`}
        className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+6.5rem)] end-[clamp(1rem,5vw,3rem)] z-50 flex h-16 items-center gap-2.5 rounded-full bg-[#f0d795] px-5 text-background shadow-[0_12px_36px_rgba(0,0,0,.55)] transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_16px_44px_rgba(0,0,0,.6)] ${
          sheetOpen || !showBasket
            ? "pointer-events-none translate-y-4 scale-90 opacity-0"
            : "translate-y-0 scale-100 opacity-100"
        }`}
      >
        <ShoppingBasket className="h-7 w-7" strokeWidth={1.8} />
        <span className="flex flex-col items-start leading-none">
          <b className="text-[.95rem] font-medium">הסל שלי</b>
          <i className="mt-0.5 text-[.72rem] not-italic opacity-70">{chosenCount} פריטים</i>
        </span>
      </button>

      {/* סל ההזמנה — חלון ממורכז, לא רצועה על כל הרוחב.
          לחיצה על הרקע סוגרת, וגם Escape. */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setSheetOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="סל ההזמנה"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-[clamp(320px,30vw,560px)] max-w-[92vw] flex-col rounded-[20px] border border-border bg-background/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,.6)] backdrop-blur-2xl"
          >
            {/* הכותרת מחוץ לאזור הנגלל — אחרת כפתור הסגירה נעלם בגלילה */}
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-[.95rem] font-medium">
                <ShoppingBasket className="h-5 w-5" strokeWidth={1.6} />
                סל ההזמנה
              </span>
              <button type="button" onClick={() => setSheetOpen(false)}
                className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-[.84rem] transition hover:bg-foreground hover:text-background">
                המשך בהזמנה
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex max-h-[min(62vh,560px)] flex-col gap-[1.1rem] overflow-y-auto">
              {[["שם", details.name], ["אירוע", eventType()],
                ["תאריך", details.date ? dateHe(details.date) + (details.time ? ` · ${details.time}` : "") : ""],
                ["מיקום", details.place]].filter(([, v]) => String(v).trim()).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {[["שם", details.name], ["אירוע", eventType()],
                    ["תאריך", details.date ? dateHe(details.date) + (details.time ? ` · ${details.time}` : "") : ""],
                    ["מיקום", details.place]]
                    .filter(([, v]) => String(v).trim())
                    .map(([k, v]) => (
                      <span key={k} className="rounded-full border border-border px-3.5 py-1.5 text-[.82rem]">
                        <i className="not-italic text-muted-foreground">{k}</i> {v}
                      </span>
                    ))}
                </div>
              )}

              <div className="flex flex-col gap-0.5">
                <b className="text-[1.05rem] font-medium text-[#f0d795]">{pkg.name}</b>
                <span className="text-[.82rem] text-muted-foreground">
                  {money(pkg.price)} לסועד · {guests} סועדים · {prog.label}
                </span>
                {pkg.setting && <span className="text-[.82rem] text-muted-foreground">עריכת שולחן {settingLabel()}</span>}
              </div>

              <ul className="flex flex-col">
                {rows.map((r) => (
                  <li key={r.key} className="grid grid-cols-[minmax(120px,.7fr)_1fr] gap-3 border-t border-border py-2 first:border-t-0 max-[560px]:grid-cols-1 max-[560px]:gap-0.5">
                    <span className="flex items-baseline gap-1.5 text-[.8rem] text-muted-foreground">
                      {r.label}
                      {r.count && <em className={`not-italic text-[.72rem] tabular-nums [direction:ltr] [unicode-bidi:isolate] ${
                        r.full ? "text-[#f0d795]" : "text-foreground/45"}`}>{r.count}</em>}
                    </span>
                    <span className={`text-[.88rem] leading-normal ${
                      r.missing ? "text-[#e0a765]" : r.empty ? "text-foreground/35" : ""}`}>{r.short}</span>
                  </li>
                ))}
                {prog.addons.filter((a) => addons.includes(a.id)).length > 0 && (
                  <li className="grid grid-cols-[minmax(120px,.7fr)_1fr] gap-3 border-t border-border py-2">
                    <span className="text-[.8rem] text-muted-foreground">תוספות</span>
                    <span className="text-[.88rem]">{prog.addons.filter((a) => addons.includes(a.id)).map((a) => a.name).join(", ")}</span>
                  </li>
                )}
              </ul>

              <dl className="flex flex-col gap-1.5 border-t border-border pt-3.5">
                <PriceRow k="חבילה" v={`${money(pkg.price)} × ${guests}`} />
                {totals.perGuest !== pkg.price && <PriceRow k="תוספות לסועד" v={`${money(totals.perGuest - pkg.price)} × ${guests}`} />}
                {totals.units > 0 && <PriceRow k="תוספות לפי כמות" v={money(totals.units)} />}
                <div className="mt-1.5 flex justify-between gap-4 border-t border-border pt-2 text-base">
                  <dt className="font-medium">סה״כ</dt>
                  <dd className="font-medium tabular-nums [direction:ltr] [unicode-bidi:isolate]">{money(totals.total)}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}

      {/* סרגל הסיכום */}
      <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-[20px] border-t border-border bg-background/95 px-[clamp(1rem,5vw,3rem)] py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <span className="flex flex-col">
            <b className="text-[clamp(1.3rem,3.4vw,1.9rem)] font-medium tabular-nums">{money(totals.total)}</b>
            <span className="text-[.78rem] text-muted-foreground">
              <span className="inline-block [direction:ltr]">{money(totals.perGuest)} × {guests}</span> סועדים
              {totals.units > 0 && ` · תוספות ${money(totals.units)}`}
              {program === "shabbat" && " · שבת"}
            </span>
          </span>

          <a
            href={missing.length ? undefined : `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(orderText())}`}
            onClick={(e) => { if (missing.length) e.preventDefault(); else saveOrder(); }}
            className={`flex-none rounded-full px-7 py-3.5 text-[.95rem] font-medium transition ${
              missing.length ? "cursor-not-allowed border border-border text-muted-foreground" : "bg-foreground text-background hover:opacity-90"
            }`}
          >
            {missing.length ? `חסר: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}` : "שליחת ההזמנה"}
          </a>
        </div>
      </div>

      {/* תצוגה מוגדלת */}
      {zoom && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-[clamp(1rem,5vw,3rem)] backdrop-blur-2xl" onClick={() => setZoom(null)}>
          <button type="button" onClick={() => setZoom(null)} aria-label="סגירה"
            className="absolute end-[clamp(.8rem,3vw,1.6rem)] top-[clamp(.8rem,3vw,1.6rem)] grid h-11 w-11 place-items-center rounded-full border border-border bg-foreground/10 transition hover:bg-foreground hover:text-background">
            <X className="h-5 w-5" />
          </button>
          <figure className="flex max-w-[min(1100px,92vw)] flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img src={zoom.img} alt={zoom.name} className="max-h-[78vh] w-auto max-w-full rounded-[14px] shadow-2xl" />
            <figcaption className="text-center text-[clamp(1rem,2.4vw,1.4rem)] font-medium">
              {zoom.note ? `${zoom.name} · ${zoom.note}` : zoom.name}
            </figcaption>
          </figure>
        </div>
      )}
    </>
  );
}

/* ============================================================
   רכיבי עזר
   ============================================================ */

const txt =
  "w-full border-0 border-b border-border bg-transparent pb-[.45rem] text-[1.05rem] outline-none placeholder:text-foreground/30 focus:border-foreground";
const contactLink =
  "rounded-full border border-border px-5 py-2.5 text-[.92rem] [direction:ltr] transition hover:border-foreground hover:bg-foreground hover:text-background";

function Field({ label, note, children }: { label: string; note?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-3">
      <span className="text-[.82rem] tracking-[.1em] text-muted-foreground">{label}</span>
      {children}
      {note && <span className="text-[.72rem] text-foreground/40">{note}</span>}
    </label>
  );
}

function PriceRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 text-[.86rem]">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums [direction:ltr] [unicode-bidi:isolate]">{v}</dd>
    </div>
  );
}

function GroupTitle({ title, badge, full, dashed, ltrBadge }:
  { title: string; badge?: string; full?: boolean; dashed?: boolean; ltrBadge?: boolean }) {
  return (
    <h3 className="mb-5 mt-13 flex items-baseline gap-3.5 text-[clamp(1.4rem,3.4vw,2rem)] font-light">
      {title}
      {badge && (
        <em className={`rounded-full border px-3 py-1 text-[.78rem] not-italic tracking-[.1em] tabular-nums transition ${
          dashed ? "border-dashed" : ""} ${full ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
          {/* מבודד ל-LTR — אחרת המכסה מוצגת לפני הכמות שנבחרה */}
          <span className={ltrBadge ? "inline-block [direction:ltr] [unicode-bidi:isolate]" : ""}>{badge}</span>
        </em>
      )}
    </h3>
  );
}

function Note({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-0.5 flex flex-wrap items-center justify-between gap-4 rounded-t-[14px] border border-border bg-foreground/[.05] px-4 py-4">
      <p className="text-[.88rem] leading-relaxed text-muted-foreground">{children}</p>
      {action}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-4">{children}</div>;
}

function Card({ item, on, onPick, onZoom, price, tick, stepper, upgrade }: {
  item: Item; on: boolean; onPick: () => void; onZoom: () => void;
  price?: string; tick?: boolean; stepper?: React.ReactNode; upgrade?: boolean;
}) {
  return (
    <div className={`group relative flex flex-col overflow-hidden rounded-[14px] border transition ${
      on ? (upgrade ? "border-[#f0d795] bg-[#f0d795]/10" : "border-foreground bg-foreground/[.07]")
         : upgrade ? "border-[#f0d795]/40 hover:border-[#f0d795]" : "border-border hover:border-foreground/40"
    }`}>
      <div role="button" tabIndex={0} onClick={onPick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())}
        className="cursor-pointer">
        <div className="relative aspect-[4/3] overflow-hidden border-b border-border">
          <img src={item.img} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          <button type="button" aria-label={`הגדלת התמונה של ${item.name}`}
            onClick={(e) => { e.stopPropagation(); onZoom(); }}
            className="absolute start-2 top-2 grid h-[30px] w-[30px] scale-90 place-items-center rounded-full border border-foreground/30 bg-background/60 opacity-0 backdrop-blur-sm transition hover:bg-foreground hover:text-background focus-visible:scale-100 focus-visible:opacity-100 group-hover:scale-100 group-hover:opacity-100 max-md:scale-100 max-md:opacity-100">
            <Search className="h-[15px] w-[15px]" />
          </button>
        </div>
        <div className="px-3.5 pb-3 pt-3">
          <span className="block text-[.95rem] font-medium">{item.name}</span>
          {item.note && <span className="block text-[.78rem] text-muted-foreground">{item.note}</span>}
          {price && <span className={`mt-0.5 block text-[.74rem] tabular-nums ${upgrade ? "text-[#f0d795]" : "opacity-85"}`}>{price}</span>}
        </div>
      </div>
      {stepper && <div className="px-3.5 pb-3.5">{stepper}</div>}
      {tick && on && (
        <span className="absolute end-2.5 top-2.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-foreground text-background">
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </span>
      )}
    </div>
  );
}

function Stepper({ n, onChange, name }: { n: number; onChange: (v: number) => void; name: string }) {
  return (
    <span className={`flex w-fit items-center gap-0.5 rounded-full border ${n > 0 ? "border-foreground" : "border-border"}`}>
      <button type="button" aria-label={`פחות ${name}`} onClick={() => onChange(n - 1)}
        className="grid h-[30px] w-[30px] place-items-center rounded-full transition hover:bg-foreground/15">
        <Minus className="h-3.5 w-3.5" />
      </button>
      <b className="min-w-[2.2ch] text-center text-[.92rem] font-medium tabular-nums">{n}</b>
      <button type="button" aria-label={`עוד ${name}`} onClick={() => onChange(n + 1)}
        className="grid h-[30px] w-[30px] place-items-center rounded-full transition hover:bg-foreground/15">
        <Plus className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function Line({ yes, children }: { yes: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 ${yes ? "" : "text-muted-foreground line-through opacity-50"}`}>
      {yes ? <Check className="h-3.5 w-3.5 flex-none" strokeWidth={2.5} /> : <X className="h-3.5 w-3.5 flex-none" />}
      {children}
    </li>
  );
}

/* ---------- עזר ---------- */
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const itemOf = (key: string, id: string) => MENU[key]?.find((i) => i.id === id);

function initPicks(p: ProgKey): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const g of PROGRAMS[p].groups) if (g.mode !== "qty" && g.mode !== "bottles") out[g.key] = [];
  return out;
}
