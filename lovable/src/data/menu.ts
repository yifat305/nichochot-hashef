/**
 * ניחוחות השף — התפריט, החבילות והתמחור.
 *
 * מקור האמת היחיד לתוכן. כל שינוי מחיר או מנה נעשה כאן בלבד.
 * הנכסים (תמונות, וידאו, גופנים) מאוחסנים בריפו ציבורי נפרד.
 */

/**
 * הנכסים מוגשים מריפו הקוד דרך jsDelivr — CDN עם קאשינג
 * ותמיכה ב-Range requests, שבלעדיה אי אפשר לדלג בתוך הווידאו.
 */
export const ASSETS =
  "https://cdn.jsdelivr.net/gh/yifat305/nichochot-hashef@main/site";

export const CURRENCY = "₪";
export const MIN_GUESTS = 20;

export const PHONE = "053-443-5123";
export const WHATSAPP = "972534435123";
export const EMAIL = "Y0534435123@gmail.com";

/** בקבוק אחד לכל 4 סועדים, ועוד 4 ספייר — וזו גם המכסה העליונה */
export const GUESTS_PER_BOTTLE = 4;
export const BOTTLE_SPARE = 4;

/** מנת קינוח לכל סועד, ועוד 4 ספייר */
export const DESSERT_SPARE = 4;

export type Item = {
  id: string;
  name: string;
  note?: string;
  /** תוספת בשקלים — לסועד בקבוצת בחירה, ליחידה בקבוצת כמות */
  extra?: number;
  img?: string;
  /** שורת שתייה ללא מכסה (מים) */
  unlimited?: boolean;
};

export type GroupMode = "pick" | "all" | "qty" | "bottles";

export type Group = {
  key: string;
  label: string;
  mode: GroupMode;
  /** כמה בוחרים — רק ב-mode "pick" */
  pick?: number;
  /** כותרת סעודה שנפתחת מעל הקבוצה */
  meal?: string;
  /** הקבוצה מוצגת רק אם החבילה כוללת את השירות הזה */
  needs?: "drinks" | "waiters";
};

export type Pkg = {
  id: number;
  name: string;
  price: number;
  setting: string | null;
  waiters: boolean;
  drinks: boolean;
};

export type Program = {
  label: string;
  packages: Pkg[];
  groups: Group[];
  addons: { id: string; name: string; price: number }[];
};

/* ============================================================
   פריטים
   ============================================================ */

const SALADS: Item[] = [
  { id: "hummus", name: "חומוס", img: `${ASSETS}/img/salads/hummus.webp` },
  { id: "tahini", name: "טחינה", img: `${ASSETS}/img/salads/tahini.webp` },
  { id: "eggplant-roasted", name: "חציל קלוי", img: `${ASSETS}/img/salads/eggplant-roasted.webp` },
  { id: "matbucha", name: "מטבוחה", img: `${ASSETS}/img/salads/matbucha.webp` },
  { id: "carrot-spicy", name: "גזר חריף", img: `${ASSETS}/img/salads/carrot-spicy.webp` },
  { id: "cabbage-purple", name: "כרוב סגול במיונז", img: `${ASSETS}/img/salads/cabbage-purple.webp` },
  { id: "cabbage-white", name: "כרוב לבן", img: `${ASSETS}/img/salads/cabbage-white.webp` },
  { id: "israeli", name: "סלט ירקות ישראלי", img: `${ASSETS}/img/salads/israeli.webp` },
  { id: "pepper-roasted", name: "פלפל קלוי", img: `${ASSETS}/img/salads/pepper-roasted.webp` },
  { id: "beet", name: "סלק", img: `${ASSETS}/img/salads/beet.webp` },
  { id: "eggplant-mayo", name: "חצילים במיונז", img: `${ASSETS}/img/salads/eggplant-mayo.webp` },
  { id: "corn-mayo", name: "תירס במיונז", img: `${ASSETS}/img/salads/corn-mayo.webp` },
  { id: "olives", name: "זיתים מתובלים", img: `${ASSETS}/img/salads/olives.webp` },
  { id: "turkish", name: "סלט טורקי", img: `${ASSETS}/img/salads/turkish.webp` },
  { id: "peppers-hot", name: "סלט פלפלים חריף", img: `${ASSETS}/img/salads/peppers-hot.webp` },
];

const RICE: Item = { id: "rice", name: "אורז לבן", img: `${ASSETS}/img/dishes/rice.webp` };
const POTATOES: Item = { id: "potatoes", name: "תפוחי אדמה בתנור", img: `${ASSETS}/img/dishes/potatoes.webp` };

const DESSERTS: Item[] = [
  { id: "lava", name: "עוגת שוקולד חמה", extra: 7, img: `${ASSETS}/img/dishes/lava-cake.webp` },
  { id: "icecream", name: "גלידה", extra: 7, img: `${ASSETS}/img/dishes/ice-cream.webp` },
  { id: "oreo-cup", name: "שכבות אוראו בכוס", extra: 7, img: `${ASSETS}/img/dishes/oreo-cup.webp` },
  { id: "fruit", name: "מגש פירות", extra: 15, img: `${ASSETS}/img/dishes/fruit-platter.webp` },
  { id: "cannoli", name: "קנולי זהובים", note: "עם קצפת ותותים", extra: 7, img: `${ASSETS}/img/dishes/cannoli.webp` },
];

const DRINKS: Item[] = [
  { id: "water", name: "מים", unlimited: true },
  { id: "cola", name: "קוקה קולה" },
  { id: "sprite", name: "ספרייט" },
  { id: "fanta", name: "פאנטה" },
  { id: "soda", name: "סודה" },
  { id: "strawberry", name: "תות בננה" },
  { id: "grape", name: "ענבים" },
  { id: "orange", name: "תפוזים" },
  { id: "schweppes", name: "שוופס מוגז", note: "בטעמים שונים" },
];

export const MENU: Record<string, Item[]> = {
  drinks: DRINKS,
  dessert: DESSERTS,

  /* ---------- יום חול ---------- */
  salads: SALADS,
  breads: [
    { id: "challah", name: "לחמניית שומשום", img: `${ASSETS}/img/breads/challah.webp` },
    { id: "roll", name: "לחמנייה", img: `${ASSETS}/img/breads/roll.webp` },
    { id: "ciabatta", name: "צ׳יאבטה", img: `${ASSETS}/img/breads/ciabatta.webp` },
  ],
  openers: [
    { id: "pastel", name: "סיגר בשר", note: "בזיגוג מייפל", extra: 15, img: `${ASSETS}/img/dishes/pastel.webp` },
    { id: "croissant", name: "קרואסון אסאדו", note: "אסאדו פרוס", extra: 15, img: `${ASSETS}/img/dishes/croissant-asado.webp` },
  ],
  starters: [
    { id: "liver", name: "כבד על פירה", note: "ברוטב חום", img: `${ASSETS}/img/dishes/liver.webp` },
    { id: "salmon", name: "פילה סלמון", note: "על בטטה צלויה", img: `${ASSETS}/img/dishes/salmon.webp` },
    { id: "fish-whole", name: "דניס שלם", note: "בגריל, בלימון", extra: 10, img: `${ASSETS}/img/dishes/fish-whole.webp` },
  ],
  mains: [
    { id: "steak", name: "אנטרקוט", note: "על מצע פירה", img: `${ASSETS}/img/dishes/steak.webp` },
    { id: "chicken", name: "חזה עוף בגריל", note: "בעשבי תיבול", img: `${ASSETS}/img/dishes/chicken-breast.webp` },
    { id: "schnitzel", name: "שניצל", note: "עם צ׳יפס", img: `${ASSETS}/img/dishes/schnitzel.webp` },
  ],
  sides: [POTATOES, RICE, { id: "couscous", name: "קוסקוס ירקות", img: `${ASSETS}/img/dishes/couscous.webp` }],

  /* ---------- שבת ---------- */
  sh_salads: SALADS,
  sh_fri_first: [
    { id: "salmon", name: "פילה סלמון", img: `${ASSETS}/img/dishes/salmon.webp` },
    { id: "denis", name: "דניס", img: `${ASSETS}/img/dishes/fish-whole.webp` },
    { id: "fish-balls", name: "קציצות דגים", note: "ברוטב חריף", img: `${ASSETS}/img/shabbat/fish-balls.webp` },
    { id: "fish-moroccan", name: "דג מרוקאי", note: "ברוטב מרוקאי", img: `${ASSETS}/img/shabbat/fish-moroccan.webp` },
  ],
  sh_fri_main: [
    { id: "shoulder", name: "צלי כתף", img: `${ASSETS}/img/shabbat/shoulder-roast.webp` },
    { id: "drumstick", name: "כרעיים עוף", img: `${ASSETS}/img/shabbat/drumstick.webp` },
    { id: "schnitzel", name: "שניצל", img: `${ASSETS}/img/dishes/schnitzel.webp` },
  ],
  sh_fri_side: [RICE, POTATOES],
  sh_sat_main: [
    { id: "cholent", name: "צ׳ולנט", img: `${ASSETS}/img/shabbat/cholent.webp` },
    { id: "shoulder", name: "צלי כתף", img: `${ASSETS}/img/shabbat/shoulder-roast.webp` },
    { id: "kugel", name: "קיגל", img: `${ASSETS}/img/shabbat/kugel.webp` },
  ],
  sh_sat_side: [
    RICE,
    POTATOES,
    { id: "potato-fans", name: "מניפות תפוחי אדמה", img: `${ASSETS}/img/shabbat/potato-fans.webp` },
  ],
  sh_third: [
    { id: "fish-schnitzel", name: "שניצל דג", img: `${ASSETS}/img/shabbat/fish-schnitzel.webp` },
    { id: "veg-pie", name: "פשטידת ירקות", img: `${ASSETS}/img/shabbat/veg-pie.webp` },
    { id: "jachnun", name: "ג׳חנון", note: "עם ביצה ורסק", img: `${ASSETS}/img/shabbat/jachnun.webp` },
  ],
};

/* ============================================================
   תוכניות
   ============================================================ */

export const PROGRAMS: Record<"weekday" | "shabbat", Program> = {
  weekday: {
    label: "יום חול",
    packages: [
      { id: 1, name: "חבילה בסיסית", price: 119, setting: "חד פעמי", waiters: false, drinks: false },
      { id: 2, name: "חבילה מורחבת", price: 149, setting: "חד פעמי", waiters: true, drinks: true },
      { id: 3, name: "חבילת פורצלן", price: 179, setting: "פורצלן", waiters: true, drinks: true },
    ],
    groups: [
      { key: "openers", label: "מנות פתיחה", mode: "qty" },
      { key: "salads", label: "סלטים", mode: "pick", pick: 10 },
      { key: "breads", label: "לחמים", mode: "pick", pick: 2 },
      { key: "starters", label: "מנות ראשונות", mode: "pick", pick: 2 },
      { key: "mains", label: "מנות עיקריות", mode: "pick", pick: 2 },
      { key: "sides", label: "תוספות", mode: "pick", pick: 2 },
      { key: "dessert", label: "קינוח", mode: "qty" },
      { key: "drinks", label: "שתייה", mode: "bottles", needs: "drinks" },
    ],
    addons: [],
  },

  shabbat: {
    label: "שבת וחג",
    packages: [
      { id: 1, name: "ללא עריכה וללא מלצרים", price: 250, setting: null, waiters: false, drinks: true },
      { id: 2, name: "עם עריכת שולחן", price: 300, setting: "כלולה", waiters: false, drinks: true },
      { id: 3, name: "עריכה ומלצרים", price: 350, setting: "כלולה", waiters: true, drinks: true },
    ],
    groups: [
      { meal: "ליל שבת", key: "sh_salads", label: "סלטים", mode: "pick", pick: 10 },
      { key: "sh_fri_first", label: "מנות ראשונות", mode: "pick", pick: 2 },
      { key: "sh_fri_main", label: "מנות עיקריות", mode: "pick", pick: 2 },
      { key: "sh_fri_side", label: "תוספות", mode: "pick", pick: 2 },
      { meal: "בוקר שבת", key: "sh_sat_main", label: "המנות", mode: "pick", pick: 2 },
      { key: "sh_sat_side", label: "תוספות", mode: "pick", pick: 2 },
      { meal: "סעודה שלישית", key: "sh_third", label: "המנות", mode: "pick", pick: 2 },
      { meal: "קינוח", key: "dessert", label: "קינוח", mode: "qty" },
      { meal: "שתייה", key: "drinks", label: "שתייה קלה", mode: "bottles", needs: "drinks" },
    ],
    addons: [{ id: "liquor", name: "שתייה חריפה", price: 20 }],
  },
};

/* --- עריכות שולחן --- */
export const TABLES: Item[] = [
  { id: "black-gold", name: "שחור וזהב", img: `${ASSETS}/img/tables/black-gold.webp` },
  { id: "blue", name: "כחול רויאל", img: `${ASSETS}/img/tables/blue.webp` },
  { id: "green", name: "ירוק בקבוק", img: `${ASSETS}/img/tables/green.webp` },
  { id: "pink", name: "ורוד", img: `${ASSETS}/img/tables/pink.webp` },
  { id: "purple", name: "סגול", img: `${ASSETS}/img/tables/purple.webp` },
  { id: "white-gold", name: "לבן וזהב", img: `${ASSETS}/img/tables/white-gold.webp` },
  { id: "white-silver", name: "לבן וכסף", img: `${ASSETS}/img/tables/white-silver.webp` },
];

/* --- צבעי חד פעמי להרכבה אישית --- */
export const COLORS = [
  { id: "white", name: "לבן", hex: "#f7f5f0" },
  { id: "cream", name: "שמנת", hex: "#efe4cf" },
  { id: "gold", name: "זהב", hex: "#c9a227" },
  { id: "silver", name: "כסף", hex: "#c2c6cb" },
  { id: "black", name: "שחור", hex: "#1b1b1d" },
  { id: "navy", name: "כחול", hex: "#1f3f7a" },
  { id: "sky", name: "תכלת", hex: "#8fbde0" },
  { id: "green", name: "ירוק", hex: "#1f4d38" },
  { id: "sage", name: "ירקרק", hex: "#a9bfa0" },
  { id: "pink", name: "ורוד", hex: "#e8b6bf" },
  { id: "purple", name: "סגול", hex: "#7d5aa6" },
  { id: "red", name: "אדום", hex: "#9d2233" },
];

export const money = (n: number) => n.toLocaleString("he-IL") + " " + CURRENCY;
