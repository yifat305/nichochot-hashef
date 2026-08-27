import { useMemo, useState } from "react";
import { Check, Minus, Plus, Search, X } from "lucide-react";
import {
  ASSETS, BOTTLE_SPARE, COLORS, DESSERT_SPARE, EMAIL, GUESTS_PER_BOTTLE,
  Item, MENU, MIN_GUESTS, PHONE, PROGRAMS, TABLES, WHATSAPP, money,
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

  const prog = PROGRAMS[program];
  const pkg = prog.packages.find((p) => p.id === pkgId) ?? prog.packages[0];

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
    // המכסה מצטמצמת — מגלחים את העודף מהמשקה האחרון כלפי מעלה
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

  const tableSummary = () => {
    if (tableMode === "preset") return TABLES.find((t) => t.id === preset)?.name ?? "טרם נבחר";
    if (tableMode === "custom")
      return colors.length
        ? `הרכבה אישית: ${COLORS.filter((c) => colors.includes(c.id)).map((c) => c.name).join(", ")}`
        : "הרכבה אישית — טרם נבחרו צבעים";
    return tableText.trim() ? `בקשה חופשית: ${tableText.trim()}` : "בקשה חופשית — טרם מולאה";
  };

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
      `מועד: ${prog.label}`,
      `סועדים: ${guests}`,
      `חבילה: ${pkg.name} — ${money(pkg.price)} לסועד`,
      pkg.setting ? `עריכת שולחן: ${pkg.setting} — ${tableSummary()}` : "עריכת שולחן: ללא",
      `מלצרים: ${pkg.waiters ? "כן" : "לא"} · שתייה: ${pkg.drinks ? "כן" : "לא"}`,
      ...lines,
      ...(extra.length ? ["", `תוספות: ${extra.join(", ")}`] : []),
      "",
      `${money(totals.perGuest)} × ${guests} סועדים = ${money(totals.perGuest * guests)}`,
      ...(totals.units ? [`תוספות לפי כמות: ${money(totals.units)}`] : []),
      `סה״כ: ${money(totals.total)}`,
    ].join("\n");
  }

  const missing = prog.groups
    .filter((g) => g.mode === "pick" && (picks[g.key] ?? []).length < Math.min(g.pick!, MENU[g.key].length))
    .map((g) => g.label);

  /* ============================================================ */
  return (
    <section className="mx-auto w-[min(1240px,92vw)] pb-36 pt-[clamp(4rem,11vh,7rem)]">
      <header className="mb-11">
        <p className="mb-[.9rem] text-[.72rem] font-medium tracking-[.3em] text-muted-foreground">בניית הזמנה</p>
        <h2 className="text-[clamp(2rem,5.5vw,3.4rem)] font-light leading-[1.08] tracking-[-0.02em]">
          מרכיבים את האירוע
        </h2>
      </header>

      {/* פרטי האירוע */}
      <div className="grid gap-6 border-y border-border py-8 sm:grid-cols-2">
        <label className="flex flex-col gap-3">
          <span className="text-[.82rem] tracking-[.1em] text-muted-foreground">מספר סועדים</span>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_GUESTS}
            value={guests}
            onChange={(e) => changeGuests(parseInt(e.target.value || "0", 10))}
            className="w-full border-0 border-b border-border bg-transparent pb-1 text-[2.2rem] font-light tabular-nums outline-none focus:border-foreground"
          />
          <span className="text-[.72rem] text-foreground/40">מינימום {MIN_GUESTS} סועדים</span>
        </label>

        <div className="flex flex-col gap-3">
          <span className="text-[.82rem] tracking-[.1em] text-muted-foreground">מועד האירוע</span>
          <div className="flex w-fit overflow-hidden rounded-full border border-border" role="group">
            {(["weekday", "shabbat"] as ProgKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => switchProgram(k)}
                className={`px-5 py-2.5 text-[.88rem] transition ${
                  program === k ? "bg-foreground font-medium text-background" : "text-muted-foreground"
                }`}
              >
                {PROGRAMS[k].label}
              </button>
            ))}
          </div>
          <span className="text-[.72rem] text-foreground/40">לשבת תפריט ומחירון נפרדים</span>
        </div>
      </div>

      {/* חבילות */}
      <GroupTitle title="בחירת חבילה" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {prog.packages.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPkgId(p.id)}
            className={`rounded-[20px] border p-6 text-start transition ${
              pkgId === p.id ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/40"
            }`}
          >
            <span className="block text-base font-medium">{p.name}</span>
            <span className="my-4 flex items-baseline gap-2">
              <b className="text-[2.2rem] font-light tabular-nums">{money(p.price)}</b>
              <i className="text-[.78rem] not-italic text-muted-foreground">לסועד</i>
            </span>
            <ul className="flex flex-col gap-2 text-[.85rem]">
              {[...new Set(prog.groups.filter((g) => g.mode !== "qty" && !g.needs).map((g) =>
                g.mode === "pick" ? `${g.pick} ${g.label}` : g.label))].map((x) => (
                <Line key={x} yes>{x}</Line>
              ))}
              <Line yes={p.waiters}>שירות מלצרים</Line>
              <Line yes={p.drinks}>שירות שתייה</Line>
              <Line yes={!!p.setting}>עריכת שולחן{p.setting ? ` ${p.setting}` : ""}</Line>
            </ul>
          </button>
        ))}
      </div>

      {/* עריכת שולחן */}
      {pkg.setting && (
        <>
          <GroupTitle title="עריכת שולחן" badge={`${pkg.setting} · ${tableSummary()}`} dashed />
          <div className="mb-6 flex flex-wrap gap-2">
            {([["preset", "עיצובים מוכנים"], ["custom", "הרכבה אישית"], ["open", "בקשה חופשית"]] as const).map(
              ([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTableMode(m)}
                  className={`rounded-full border px-5 py-2 text-[.86rem] transition ${
                    tableMode === m
                      ? "border-foreground bg-foreground font-medium text-background"
                      : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          {tableMode === "preset" && (
            <Grid>
              {TABLES.map((t) => (
                <Card
                  key={t.id}
                  item={t}
                  on={preset === t.id}
                  onPick={() => setPreset(preset === t.id ? null : t.id)}
                  onZoom={() => setZoom(t)}
                />
              ))}
            </Grid>
          )}

          {tableMode === "custom" && (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
              {COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    setColors((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))
                  }
                  className={`flex flex-col items-center gap-2 rounded-[14px] border p-3.5 transition ${
                    colors.includes(c.id) ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/45"
                  }`}
                >
                  <span
                    className={`h-[34px] w-[34px] rounded-full shadow-[inset_0_0_0_1px_rgba(11,12,14,.35)] transition ${
                      colors.includes(c.id) ? "scale-110 ring-2 ring-foreground" : ""
                    }`}
                    style={{ background: c.hex }}
                  />
                  <span className="text-[.78rem]">{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {tableMode === "open" && (
            <label className="flex flex-col gap-3">
              <span className="text-[.82rem] tracking-[.06em] text-muted-foreground">
                ספרו לנו איך אתם רוצים שהשולחן ייראה
              </span>
              <textarea
                rows={4}
                value={tableText}
                onChange={(e) => setTableText(e.target.value)}
                placeholder="למשל: מפה לבנה, מפיות בורדו, נרות גבוהים וסידור פרחים נמוך"
                className="w-full resize-y rounded-[14px] border border-border bg-transparent p-4 text-[.95rem] leading-relaxed outline-none focus:border-foreground"
              />
            </label>
          )}
        </>
      )}

      {/* קבוצות התפריט */}
      {prog.groups.map((g) => {
        if (g.needs && !pkg[g.needs]) return null;
        const items = MENU[g.key];
        const chosen = picks[g.key] ?? [];

        return (
          <div key={`${program}-${g.key}`}>
            {g.meal && (
              <h2 className="mb-0 mt-16 border-b border-border pb-4 text-[clamp(1.7rem,4.5vw,2.6rem)] font-light tracking-[-0.01em]">
                {g.meal}
              </h2>
            )}

            <GroupTitle
              title={g.label}
              badge={
                g.mode === "pick" ? `${chosen.length} / ${g.pick}`
                : g.mode === "bottles" ? `${bottlesUsed} / ${bottlesMax} בקבוקים`
                : "רשות · לפי כמות"
              }
              full={g.mode === "pick" ? chosen.length === g.pick : g.mode === "bottles" ? bottlesUsed >= bottlesMax : false}
              dashed={g.mode === "qty"}
              ltrBadge={g.mode !== "qty"}
            />

            {g.key === "dessert" && (
              <Note>
                מנה לכל סועד <b className="font-medium text-foreground">+ {DESSERT_SPARE} ספייר</b>. לפי{" "}
                <b className="font-medium tabular-nums text-foreground">{guests}</b> סועדים —{" "}
                <b className="font-medium tabular-nums text-foreground">{dessertQty}</b> מנות. לחיצה על תמונה ממלאת את
                הכמות.
              </Note>
            )}

            {g.mode === "bottles" && (
              <Note
                action={
                  <button
                    type="button"
                    onClick={spreadBottles}
                    className="flex-none rounded-full border border-border px-4 py-2 text-[.82rem] transition hover:border-foreground hover:bg-foreground hover:text-background"
                  >
                    פיזור שווה
                  </button>
                }
              >
                בקבוק אחד לכל {GUESTS_PER_BOTTLE} סועדים{" "}
                <b className="font-medium text-foreground">+ {BOTTLE_SPARE} ספייר</b>. לפי{" "}
                <b className="font-medium tabular-nums text-foreground">{guests}</b> סועדים — עד{" "}
                <b className="font-medium tabular-nums text-foreground">{bottlesMax}</b> בקבוקים.
              </Note>
            )}

            {g.mode === "bottles" ? (
              <div className="flex flex-col overflow-hidden rounded-b-[14px] border border-t-0 border-border">
                {items.map((it) => {
                  const n = qty[g.key]?.[it.id] ?? 0;
                  return (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between gap-4 border-t border-border px-4 py-3 first:border-t-0 transition ${
                        it.unlimited || n > 0 ? "bg-foreground/[.06]" : ""
                      }`}
                    >
                      <span className="flex min-w-0 items-baseline gap-2.5">
                        <b className={`text-[.98rem] font-medium ${it.unlimited || n > 0 ? "" : "text-muted-foreground"}`}>
                          {it.name}
                        </b>
                        {it.note && <i className="text-[.76rem] not-italic text-foreground/45">{it.note}</i>}
                      </span>
                      {it.unlimited ? (
                        <span className="flex-none rounded-full bg-foreground px-4 py-1.5 text-[.78rem] tracking-[.06em] text-background">
                          ללא הגבלה
                        </span>
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
                    <Card
                      key={it.id}
                      item={it}
                      on={(qty[g.key]?.[it.id] ?? 0) > 0}
                      onZoom={() => setZoom(it)}
                      onPick={() =>
                        setQuantity(g.key, it.id, (qty[g.key]?.[it.id] ?? 0) ? 0 : g.key === "dessert" ? dessertQty : guests)
                      }
                      price={`+${money(it.extra!)} ליחידה`}
                      stepper={
                        <Stepper
                          n={qty[g.key]?.[it.id] ?? 0}
                          onChange={(v) => setQuantity(g.key, it.id, v)}
                          name={it.name}
                        />
                      }
                    />
                  ) : (
                    <Card
                      key={it.id}
                      item={it}
                      on={chosen.includes(it.id)}
                      onPick={() => togglePick(g.key, it.id, g.pick!)}
                      onZoom={() => setZoom(it)}
                      price={it.extra ? `+${money(it.extra)} לסועד` : undefined}
                      tick
                    />
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
              <button
                key={a.id}
                type="button"
                onClick={() => setAddons((p) => (p.includes(a.id) ? p.filter((x) => x !== a.id) : [...p, a.id]))}
                className={`relative flex flex-col gap-1 rounded-[14px] border p-5 text-start transition ${
                  addons.includes(a.id) ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/40"
                }`}
              >
                <span className="text-base font-medium">{a.name}</span>
                <span className="text-[.8rem] tabular-nums text-muted-foreground">+{money(a.price)} לסועד</span>
                {addons.includes(a.id) && (
                  <Check className="absolute end-4 top-1/2 h-5 w-5 -translate-y-1/2" strokeWidth={2.5} />
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* יצירת קשר */}
      <div className="mt-16 flex flex-wrap items-center gap-x-10 gap-y-6 border-t border-border pt-10">
        <img
          src={`${ASSETS}/img/brand/logo.webp`}
          alt="ניחוחות השף — קייטרינג ואירוח"
          className="h-[clamp(88px,12vw,132px)] w-auto flex-none"
        />
        <div className="flex flex-col gap-3.5">
          <p className="text-[.86rem] text-muted-foreground">אפשר גם ישירות:</p>
          <div className="flex flex-wrap gap-3">
            <a href={`tel:+${WHATSAPP}`} className="rounded-full border border-border px-5 py-2.5 text-[.92rem] [direction:ltr] transition hover:border-foreground hover:bg-foreground hover:text-background">
              {PHONE}
            </a>
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent("הזמנת קייטרינג — " + prog.label)}&body=${encodeURIComponent(orderText())}`}
              className="rounded-full border border-border px-5 py-2.5 text-[.92rem] [direction:ltr] transition hover:border-foreground hover:bg-foreground hover:text-background"
            >
              {EMAIL}
            </a>
          </div>
        </div>
      </div>

      {/* סרגל הסיכום */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 rounded-t-[20px] border-t border-border bg-background/95 px-[clamp(1rem,5vw,3rem)] py-4 backdrop-blur-xl">
        <div className="flex flex-col">
          <b className="text-[clamp(1.3rem,3.4vw,1.9rem)] font-medium tabular-nums">{money(totals.total)}</b>
          <span className="text-[.78rem] text-muted-foreground">
            <span className="inline-block [direction:ltr]">{money(totals.perGuest)} × {guests}</span> סועדים
            {totals.units > 0 && ` · תוספות ${money(totals.units)}`}
            {program === "shabbat" && " · שבת"}
          </span>
        </div>
        <a
          href={missing.length ? undefined : `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(orderText())}`}
          onClick={(e) => missing.length && e.preventDefault()}
          className={`flex-none rounded-full px-7 py-3.5 text-[.95rem] font-medium transition ${
            missing.length
              ? "cursor-not-allowed border border-border text-muted-foreground"
              : "bg-foreground text-background hover:opacity-90"
          }`}
        >
          {missing.length ? `חסרות בחירות: ${missing.join(", ")}` : "שליחת ההזמנה"}
        </a>
      </div>

      {/* תצוגה מוגדלת */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/90 p-[clamp(1rem,5vw,3rem)] backdrop-blur-2xl"
          onClick={() => setZoom(null)}
        >
          <button
            type="button"
            onClick={() => setZoom(null)}
            aria-label="סגירה"
            className="absolute end-[clamp(.8rem,3vw,1.6rem)] top-[clamp(.8rem,3vw,1.6rem)] grid h-11 w-11 place-items-center rounded-full border border-border bg-foreground/10 transition hover:bg-foreground hover:text-background"
          >
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
    </section>
  );
}

/* ============================================================
   רכיבי עזר
   ============================================================ */

function GroupTitle({
  title, badge, full, dashed, ltrBadge,
}: { title: string; badge?: string; full?: boolean; dashed?: boolean; ltrBadge?: boolean }) {
  return (
    <h3 className="mb-5 mt-13 flex items-baseline gap-3.5 text-[clamp(1.4rem,3.4vw,2rem)] font-light">
      {title}
      {badge && (
        <em
          className={`rounded-full border px-3 py-1 text-[.78rem] not-italic tracking-[.1em] tabular-nums transition ${
            dashed ? "border-dashed" : ""
          } ${full ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
        >
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

function Card({
  item, on, onPick, onZoom, price, tick, stepper,
}: {
  item: Item; on: boolean; onPick: () => void; onZoom: () => void;
  price?: string; tick?: boolean; stepper?: React.ReactNode;
}) {
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[14px] border transition ${
        on ? "border-foreground bg-foreground/[.07]" : "border-border hover:border-foreground/40"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onPick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick())}
        className="cursor-pointer"
      >
        <div className="relative aspect-[4/3] overflow-hidden border-b border-border">
          <img src={item.img} alt={item.name} loading="lazy" className="h-full w-full object-cover" />
          <button
            type="button"
            aria-label={`הגדלת התמונה של ${item.name}`}
            onClick={(e) => { e.stopPropagation(); onZoom(); }}
            className="absolute start-2 top-2 grid h-[30px] w-[30px] scale-90 place-items-center rounded-full border border-foreground/30 bg-background/60 opacity-0 backdrop-blur-sm transition group-hover:scale-100 group-hover:opacity-100 hover:bg-foreground hover:text-background focus-visible:scale-100 focus-visible:opacity-100 max-md:scale-100 max-md:opacity-100"
          >
            <Search className="h-[15px] w-[15px]" />
          </button>
        </div>
        <div className="px-3.5 pb-3 pt-3">
          <span className="block text-[.95rem] font-medium">{item.name}</span>
          {item.note && <span className="block text-[.78rem] text-muted-foreground">{item.note}</span>}
          {price && <span className="mt-0.5 block text-[.74rem] tabular-nums opacity-85">{price}</span>}
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
