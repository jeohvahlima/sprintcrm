// 🔒 LOCKED — Visual oficial do módulo Gestão de Processos (GROW OS).
// Layout 100% definido em /public/processos-comerciais.html (mockup Claude artifact).
// NÃO substituir por componentes React antigos. Para alterações visuais,
// edite somente public/processos-comerciais.html.
import { useEffect } from "react";

export default function ProcessosComerciais() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Gestão de Processos";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="relative h-[calc(100vh-5rem)] min-h-[640px] w-full overflow-hidden">
      <iframe
        src="/processos-comerciais.html"
        title="Gestão de Processos"
        className="absolute inset-0 block h-full w-full border-none"
      />
    </div>
  );
}
