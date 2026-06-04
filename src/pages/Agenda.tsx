// 🔒 LOCKED: Render the official GROW OS Agenda mockup inside the app layout.
// Visual changes must be made in public/agenda.html — do NOT replace with old React components.
export default function Agenda() {
  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        src="/agenda.html"
        title="Agenda — GROW OS"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
