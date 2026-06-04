// 🔒 LOCKED — Visual oficial do módulo Automação & IA (GROW OS).
// Layout 100% definido em /public/automacao.html (mockup growos-automacao-v2).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/automacao.html.
export default function IA() {
  return (
    <iframe
      src="/automacao.html"
      title="Automação & IA"
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
