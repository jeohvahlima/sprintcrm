// 🔒 LOCKED — Visual oficial do módulo Automação & IA (GROW OS).
// Layout 100% definido em /public/automacao.html (mockup growos-automacao-v2).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/automacao.html.
export default function IA() {
  return (
    <div className="w-full h-[calc(100vh-7rem)] min-h-[640px] overflow-hidden rounded-lg border border-border bg-background">
      <iframe
        src="/automacao.html"
        title="Automação & IA"
        className="w-full h-full border-0 block"
      />
    </div>
  );
}
