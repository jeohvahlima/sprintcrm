// 🔒 LOCKED — Visual oficial do módulo BPO Comercial (GROW OS).
// Layout 100% definido em /public/processos-comerciais.html (mockup Claude artifact).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/processos-comerciais.html.
export default function ProcessosComerciais() {
  return (
    <div className="relative h-[calc(100vh-5rem)] min-h-[640px] w-full overflow-hidden">
      <iframe
        src="/processos-comerciais.html"
        title="BPO Comercial"
        className="absolute inset-0 block h-full w-full border-none"
      />
    </div>
  );
}
