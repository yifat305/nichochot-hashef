/* ============================================================
   התפריט והתמחור — שתי תוכניות: יום חול ושבת.

   mode של קבוצה:
     'pick' + pick:N  → בוחרים עד N
     'all'            → הכל כלול, אפשר להוריד פריט
     'qty'            → בחירת כמות, בתשלום לפי יחידה
   ============================================================ */

const CURRENCY = '₪';
const MIN_GUESTS = 20;
const PHONE    = '053-443-5123';
const WHATSAPP = '972534435123';
const EMAIL    = 'Y0534435123@gmail.com';

/* ============================================================
   מאגר הפריטים
   ============================================================ */
const SALADS = [
  { id: 'hummus',           name: 'חומוס',             img: 'img/salads/hummus.webp' },
  { id: 'tahini',           name: 'טחינה',             img: 'img/salads/tahini.webp' },
  { id: 'eggplant-roasted', name: 'חציל קלוי',         img: 'img/salads/eggplant-roasted.webp' },
  { id: 'matbucha',         name: 'מטבוחה',            img: 'img/salads/matbucha.webp' },
  { id: 'carrot-spicy',     name: 'גזר חריף',          img: 'img/salads/carrot-spicy.webp' },
  { id: 'cabbage-purple',   name: 'כרוב סגול במיונז',  img: 'img/salads/cabbage-purple.webp' },
  { id: 'cabbage-white',    name: 'כרוב לבן',          img: 'img/salads/cabbage-white.webp' },
  { id: 'israeli',          name: 'סלט ירקות ישראלי',  img: 'img/salads/israeli.webp' },
  { id: 'pepper-roasted',   name: 'פלפל קלוי',         img: 'img/salads/pepper-roasted.webp' },
  { id: 'beet',             name: 'סלק',               img: 'img/salads/beet.webp' },
  { id: 'eggplant-mayo',    name: 'חצילים במיונז',     img: 'img/salads/eggplant-mayo.webp' },
  { id: 'corn-mayo',        name: 'תירס במיונז',       img: 'img/salads/corn-mayo.webp' },
  { id: 'olives',           name: 'זיתים מתובלים',     img: 'img/salads/olives.webp' },
  { id: 'turkish',          name: 'סלט טורקי',         img: 'img/salads/turkish.webp' },
  { id: 'peppers-hot',      name: 'סלט פלפלים חריף',   img: 'img/salads/peppers-hot.webp' },
];

const RICE     = { id: 'rice',     name: 'אורז לבן',         img: 'img/dishes/rice.webp' };
const POTATOES = { id: 'potatoes', name: 'תפוחי אדמה בתנור', img: 'img/dishes/potatoes.webp' };

/* --- קינוחים. מנה לכל סועד + ספייר. המחיר לפי מנה --- */
const DESSERT_SPARE = 4;

const DESSERTS = [
  { id: 'lava',     name: 'עוגת שוקולד חמה',  extra: 7,  img: 'img/dishes/lava-cake.webp' },
  { id: 'icecream', name: 'גלידה',            extra: 7,  img: 'img/dishes/ice-cream.webp' },
  { id: 'oreo-cup', name: 'שכבות אוראו בכוס', extra: 7,  img: 'img/dishes/oreo-cup.webp' },
  { id: 'fruit',    name: 'מגש פירות',        extra: 15, img: 'img/dishes/fruit-platter.webp' },
  { id: 'cannoli',  name: 'קנולי זהובים',     note: 'עם קצפת ותותים', extra: 7, img: 'img/dishes/cannoli.webp' },
];

/* --- שתייה קלה. בקבוק לכל 4 סועדים + ספייר, וזו גם המכסה --- */
const GUESTS_PER_BOTTLE = 4;
const BOTTLE_SPARE = 4;

const DRINKS = [
  { id: 'water',      name: 'מים',        unlimited: true },
  { id: 'cola',       name: 'קוקה קולה' },
  { id: 'sprite',     name: 'ספרייט' },
  { id: 'fanta',      name: 'פאנטה' },
  { id: 'soda',       name: 'סודה' },
  { id: 'strawberry', name: 'תות בננה' },
  { id: 'grape',      name: 'ענבים' },
  { id: 'orange',     name: 'תפוזים' },
  { id: 'schweppes',  name: 'שוופס מוגז', note: 'בטעמים שונים' },
];

const MENU = {
  drinks: DRINKS,
  /* ---------- יום חול ---------- */
  salads: SALADS,
  breads: [
    { id: 'challah',  name: 'לחמניית שומשום', img: 'img/breads/challah.webp' },
    { id: 'roll',     name: 'לחמנייה',        img: 'img/breads/roll.webp' },
    { id: 'ciabatta', name: 'צ׳יאבטה',        img: 'img/breads/ciabatta.webp' },
  ],
  openers: [
    { id: 'pastel',    name: 'סיגר בשר',      note: 'בזיגוג מייפל', extra: 15, img: 'img/dishes/pastel.webp' },
    { id: 'croissant', name: 'קרואסון אסאדו', note: 'אסאדו פרוס',   extra: 15, img: 'img/dishes/croissant-asado.webp' },
  ],
  starters: [
    { id: 'liver',      name: 'כבד על פירה', note: 'ברוטב חום',     img: 'img/dishes/liver.webp' },
    { id: 'salmon',     name: 'פילה סלמון',  note: 'על בטטה צלויה', img: 'img/dishes/salmon.webp' },
    { id: 'fish-whole', name: 'דניס שלם',    note: 'בגריל, בלימון', extra: 10, img: 'img/dishes/fish-whole.webp' },
  ],
  mains: [
    { id: 'steak',     name: 'אנטרקוט',       note: 'על מצע פירה', img: 'img/dishes/steak.webp' },
    { id: 'chicken',   name: 'חזה עוף בגריל', note: 'בעשבי תיבול', img: 'img/dishes/chicken-breast.webp' },
    { id: 'schnitzel', name: 'שניצל',         note: 'עם צ׳יפס',    img: 'img/dishes/schnitzel.webp' },
  ],
  sides: [POTATOES, RICE, { id: 'couscous', name: 'קוסקוס ירקות', img: 'img/dishes/couscous.webp' }],
  dessert: DESSERTS,

  /* ---------- שבת: ליל שבת ---------- */
  sh_salads: SALADS,
  sh_fri_first: [
    { id: 'salmon',        name: 'פילה סלמון',   img: 'img/dishes/salmon.webp' },
    { id: 'denis',         name: 'דניס',         img: 'img/dishes/fish-whole.webp' },
    { id: 'fish-balls',    name: 'קציצות דגים',  note: 'ברוטב חריף',  img: 'img/shabbat/fish-balls.webp' },
    { id: 'fish-moroccan', name: 'דג מרוקאי',    note: 'ברוטב מרוקאי', img: 'img/shabbat/fish-moroccan.webp' },
  ],
  sh_fri_main: [
    { id: 'shoulder',  name: 'צלי כתף',    img: 'img/shabbat/shoulder-roast.webp' },
    { id: 'drumstick', name: 'כרעיים עוף', img: 'img/shabbat/drumstick.webp' },
    { id: 'schnitzel', name: 'שניצל',      img: 'img/dishes/schnitzel.webp' },
  ],
  sh_fri_side: [RICE, POTATOES],

  /* ---------- שבת: בוקר שבת ---------- */
  sh_sat_main: [
    { id: 'cholent',  name: 'צ׳ולנט',  img: 'img/shabbat/cholent.webp' },
    { id: 'shoulder', name: 'צלי כתף', img: 'img/shabbat/shoulder-roast.webp' },
    { id: 'kugel',    name: 'קיגל',    img: 'img/shabbat/kugel.webp' },
  ],
  sh_sat_side: [
    RICE, POTATOES,
    { id: 'potato-fans', name: 'מניפות תפוחי אדמה', img: 'img/shabbat/potato-fans.webp' },
  ],

  /* ---------- שבת: סעודה שלישית ---------- */
  sh_third: [
    { id: 'fish-schnitzel', name: 'שניצל דג',      img: 'img/shabbat/fish-schnitzel.webp' },
    { id: 'veg-pie',        name: 'פשטידת ירקות',  img: 'img/shabbat/veg-pie.webp' },
    { id: 'jachnun',        name: 'ג׳חנון',        note: 'עם ביצה ורסק', img: 'img/shabbat/jachnun.webp' },
  ],
};

/* ============================================================
   התוכניות
   ============================================================ */
const PROGRAMS = {
  weekday: {
    label: 'יום חול',
    packages: [
      { id: 1, name: 'חבילה בסיסית', price: 119, setting: 'חד פעמי', waiters: false, drinks: false },
      { id: 2, name: 'חבילה מורחבת', price: 149, setting: 'חד פעמי', waiters: true,  drinks: true  },
      { id: 3, name: 'חבילת פורצלן', price: 179, setting: 'פורצלן',  waiters: true,  drinks: true  },
    ],
    groups: [
      { key: 'openers',  label: 'מנות פתיחה',   mode: 'qty'  },
      { key: 'salads',   label: 'סלטים',        mode: 'pick', pick: 10 },
      { key: 'breads',   label: 'לחמים',        mode: 'pick', pick: 2  },
      { key: 'starters', label: 'מנות ראשונות', mode: 'pick', pick: 2  },
      { key: 'mains',    label: 'מנות עיקריות', mode: 'pick', pick: 2  },
      { key: 'sides',    label: 'תוספות',       mode: 'pick', pick: 2  },
      { key: 'dessert',  label: 'קינוח',        mode: 'qty'  },
      { key: 'drinks',   label: 'שתייה',        mode: 'bottles', needs: 'drinks' },
    ],
    addons: [],
  },

  shabbat: {
    label: 'שבת וחג',
    packages: [
      { id: 1, name: 'ללא עריכה וללא מלצרים', price: 250, setting: null,     waiters: false, drinks: true },
      { id: 2, name: 'עם עריכת שולחן',        price: 300, setting: 'כלולה',  waiters: false, drinks: true },
      { id: 3, name: 'עריכה ומלצרים',         price: 350, setting: 'כלולה',  waiters: true,  drinks: true },
    ],
    groups: [
      { meal: 'ליל שבת',       key: 'sh_salads',    label: 'סלטים',        mode: 'pick', pick: 10 },
      {                        key: 'sh_fri_first', label: 'מנות ראשונות', mode: 'pick', pick: 2 },
      {                        key: 'sh_fri_main',  label: 'מנות עיקריות', mode: 'pick', pick: 2 },
      {                        key: 'sh_fri_side',  label: 'תוספות',       mode: 'pick', pick: 2 },
      { meal: 'בוקר שבת',      key: 'sh_sat_main',  label: 'המנות',        mode: 'pick', pick: 2 },
      {                        key: 'sh_sat_side',  label: 'תוספות',       mode: 'pick', pick: 2 },
      { meal: 'סעודה שלישית',  key: 'sh_third',     label: 'המנות',        mode: 'pick', pick: 2 },
      { meal: 'קינוח',         key: 'dessert',      label: 'קינוח',        mode: 'qty' },
      { meal: 'שתייה',         key: 'drinks',       label: 'שתייה קלה',    mode: 'bottles', needs: 'drinks' },
    ],
    addons: [
      { id: 'liquor', name: 'שתייה חריפה', price: 20 },
    ],
  },
};

/* --- עריכות שולחן מוכנות --- */
const TABLES = [
  { id: 'black-gold',   name: 'שחור וזהב',  img: 'img/tables/black-gold.webp' },
  { id: 'blue',         name: 'כחול רויאל', img: 'img/tables/blue.webp' },
  { id: 'green',        name: 'ירוק בקבוק', img: 'img/tables/green.webp' },
  { id: 'pink',         name: 'ורוד',       img: 'img/tables/pink.webp' },
  { id: 'purple',       name: 'סגול',       img: 'img/tables/purple.webp' },
  { id: 'white-gold',   name: 'לבן וזהב',   img: 'img/tables/white-gold.webp' },
  { id: 'white-silver', name: 'לבן וכסף',   img: 'img/tables/white-silver.webp' },
];

/* --- צבעי חד פעמי להרכבה אישית --- */
const COLORS = [
  { id: 'white',  name: 'לבן',   hex: '#f7f5f0' },
  { id: 'cream',  name: 'שמנת',  hex: '#efe4cf' },
  { id: 'gold',   name: 'זהב',   hex: '#c9a227' },
  { id: 'silver', name: 'כסף',   hex: '#c2c6cb' },
  { id: 'black',  name: 'שחור',  hex: '#1b1b1d' },
  { id: 'navy',   name: 'כחול',  hex: '#1f3f7a' },
  { id: 'sky',    name: 'תכלת',  hex: '#8fbde0' },
  { id: 'green',  name: 'ירוק',  hex: '#1f4d38' },
  { id: 'sage',   name: 'ירקרק', hex: '#a9bfa0' },
  { id: 'pink',   name: 'ורוד',  hex: '#e8b6bf' },
  { id: 'purple', name: 'סגול',  hex: '#7d5aa6' },
  { id: 'red',    name: 'אדום',  hex: '#9d2233' },
];
