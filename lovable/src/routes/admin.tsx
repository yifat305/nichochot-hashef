import { createFileRoute } from "@tanstack/react-router";
import { AdminPanel } from "@/components/AdminPanel";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "ניהול הזמנות · ניחוחות השף" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Admin,
});

function Admin() {
  return (
    <div dir="rtl" lang="he" className="min-h-[100dvh] bg-background text-foreground">
      <AdminPanel />
    </div>
  );
}
