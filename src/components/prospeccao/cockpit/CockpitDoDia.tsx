import { CockpitHUD } from "./CockpitHUD";
import { MissoesDoTurno } from "./MissoesDoTurno";

/**
 * CockpitDoDia — bloco unificado de execução diária.
 * Mostra o HUD operacional + missões do turno.
 * Use no topo de páginas onde o SDR/Closer trabalha.
 */
export function CockpitDoDia() {
  return (
    <div className="space-y-4 animate-fade-in">
      <CockpitHUD />
      <MissoesDoTurno />
    </div>
  );
}
