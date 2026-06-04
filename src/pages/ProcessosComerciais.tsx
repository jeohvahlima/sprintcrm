// 🔒 LOCKED — Visual oficial do módulo Processos Comerciais (GROW OS).
// Layout 100% definido em /public/processos-comerciais.html (mockup Claude artifact).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/processos-comerciais.html.
export default function ProcessosComerciais() {
  return (
    <iframe
      src="/processos-comerciais.html"
      title="Processos Comerciais"
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
