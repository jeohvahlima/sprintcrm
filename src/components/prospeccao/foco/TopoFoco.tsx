import { useDailyFocus } from "@/hooks/useDailyFocus";
import { MetaDoDiaCard } from "./MetaDoDiaCard";
import { PerdaEstimadaCard } from "./PerdaEstimadaCard";
import { PosicaoHojeCard } from "./PosicaoHojeCard";

interface Props {
  onRecuperar?: () => void;
}

export function TopoFoco({ onRecuperar }: Props) {
  const focus = useDailyFocus();

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
      <MetaDoDiaCard focus={focus} />
      <PerdaEstimadaCard focus={focus} onRecuperar={onRecuperar} />
      <PosicaoHojeCard focus={focus} />
    </section>
  );
}
