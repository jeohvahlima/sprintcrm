import { useScrollAnimation, useCountUp } from '@/hooks/useScrollAnimation';
import { EstatisticaItem } from '@/lib/siteTemplates';

interface Props {
  estatisticas: EstatisticaItem[];
  primary: string;
}

function StatItem({ item, primary, start }: { item: EstatisticaItem; primary: string; start: boolean }) {
  const value = useCountUp(item.numero, 1800, start);
  return (
    <div className="text-center">
      <div className="text-4xl md:text-5xl font-bold mb-2" style={{ color: primary }}>
        {item.prefixo}{value.toLocaleString('pt-BR')}{item.sufixo}
      </div>
      <div className="text-sm text-slate-600 font-medium">{item.label}</div>
    </div>
  );
}

export function StatsCounter({ estatisticas, primary }: Props) {
  const { ref, visible } = useScrollAnimation<HTMLDivElement>();
  return (
    <div ref={ref} className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {estatisticas.map((stat, i) => (
        <StatItem key={i} item={stat} primary={primary} start={visible} />
      ))}
    </div>
  );
}
