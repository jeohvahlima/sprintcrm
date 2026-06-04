// 🔒 LOCKED: Render the official GROW OS Contatos mockup inside the app layout.
// Visual changes must be made in public/contatos.html — do NOT replace with old React components.
export default function Leads() {
  return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <iframe
        src="/contatos.html"
        title="Contatos do CRM"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
