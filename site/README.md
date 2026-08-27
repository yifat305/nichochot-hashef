# הוספת מתכון חדש

## 1. פירוק הסרטון ל-Image Sequence

מתוך תיקיית הפרויקט, החלף `<id>` בשם המתכון באנגלית ו-`<video>` בנתיב הסרטון:

```bash
ffmpeg -y -i "<video-16x9>.mp4" -vf "fps=12,scale=1280:-2" -c:v libwebp -q:v 74 -compression_level 5 -f image2 "site/recipes/<id>/wide/f_%04d.webp"
```

```bash
ffmpeg -y -i "<video-9x16>.mp4" -vf "fps=12,scale=608:-2" -c:v libwebp -q:v 72 -compression_level 5 -f image2 "site/recipes/<id>/tall/f_%04d.webp"
```

## 2. תמונת הפתיחה

```bash
ffmpeg -y -i "<poster>.png" -c:v libwebp -q:v 88 -compression_level 6 -f image2 "site/recipes/<id>/poster.webp"
```

## 3. רישום המתכון

הוסף אובייקט ל-`site/recipes.js`:

```js
{ id: '<id>', title: 'שם המתכון', frames: <מספר הפריימים שנוצרו> },
```

מספר הפריימים = `אורך הסרטון בשניות × 12`. לבדיקה מדויקת:

```bash
ls site/recipes/<id>/wide | wc -l
```

## הרצה

```bash
node site/server.js
```

---

## מבנה התיקייה

```
site/
├─ recipes.js              ← רשימת המתכונים
├─ recipes/
│  └─ pastel-basar/
│     ├─ poster.webp       ← תמונת הפתיחה
│     ├─ wide/  f_0001…    ← 16:9  (דסקטופ)
│     └─ tall/  f_0001…    ← 9:16  (מובייל)
└─ fonts/                  ← FUP Lachish
```

הסט (`wide` / `tall`) נבחר אוטומטית לפי פרופורציות המסך.
