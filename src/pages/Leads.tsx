// 🔒 LOCKED: Render the official GROW OS Contatos mockup as a fullscreen iframe.
// Visual changes must be made in public/contatos.html — do NOT replace with old React components.
export default function Leads() {
  return (
    <iframe
      src="/contatos.html"
      title="Contatos do CRM"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        zIndex: 1,
      }}
    />
  );
}
