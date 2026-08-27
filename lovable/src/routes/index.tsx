import { createFileRoute } from "@tanstack/react-router";
import { HeroFilm } from "@/components/HeroFilm";
import { OrderBuilder } from "@/components/OrderBuilder";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ניחוחות השף · קייטרינג ואירוח" },
      {
        name: "description",
        content:
          "ניחוחות השף — קייטרינג ואירוח. בניית הזמנה מלאה: חבילות ליום חול ולשבת, תפריט, עריכת שולחן ושתייה.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main dir="rtl" lang="he" className="min-h-[100dvh] bg-background text-foreground">
      <HeroFilm />
      <OrderBuilder />
    </main>
  );
}
