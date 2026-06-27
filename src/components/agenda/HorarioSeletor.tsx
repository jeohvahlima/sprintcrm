import { useMemo } from "react";
import { format, parse, isAfter, isBefore, addMinutes, isSameDay, getDay, startOfDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, XCircle, Ban, CalendarX } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HorarioComercial } from "./HorarioComercialConfig";

interface Compromisso {
  id: string;
  data_hora_inicio: string;
  data_hora_fim: string;
}

interface HorarioSeletorProps {
  data: string; // YYYY-MM-DD
  horarioComercial: HorarioComercial;
  compromissosExistentes: Compromisso[];
  horarioSelecionado?: string;
  duracaoMinutos?: number;
  permitirSimultaneo?: boolean;
  capacidadeSimultanea?: number; // Quantidade máxima de compromissos simultâneos
  diasFuncionamento?: string[]; // Dias da semana que a empresa funciona
  onSelecionarHorario: (horario: string) => void;
}

// Mapeamento de dia da semana (0=domingo, 1=segunda, etc) para string
const diasSemanaMap: Record<number, string> = {
  0: "domingo",
  1: "segunda",
  2: "terca",
  3: "quarta",
  4: "quinta",
  5: "sexta",
  6: "sabado",
};

const diasSemanaLabels: Record<string, string> = {
  domingo: "Domingo",
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado",
};

export function HorarioSeletor({
  data,
  horarioComercial,
  compromissosExistentes,
  horarioSelecionado,
  duracaoMinutos = 30,
  permitirSimultaneo = false,
  capacidadeSimultanea = 1,
  diasFuncionamento = ["segunda", "terca", "quarta", "quinta", "sexta"],
  onSelecionarHorario,
}: HorarioSeletorProps) {
  // Verificar se o dia selecionado é um dia de funcionamento
  const dataBase = parse(data, "yyyy-MM-dd", new Date());
  const diaDaSemana = getDay(dataBase);
  const diaDaSemanaStr = diasSemanaMap[diaDaSemana];
  const ehDiaFuncionamento = diasFuncionamento.includes(diaDaSemanaStr);

  // Gerar lista de horários disponíveis baseado na configuração
  const horariosDisponiveis = useMemo(() => {
    const horarios: Array<{
      horario: string;
      disponivel: boolean;
      passado: boolean;
      compromissos: Compromisso[];
    }> = [];

    // Se não é dia de funcionamento, retornar lista vazia
    if (!ehDiaFuncionamento) {
      return horarios;
    }

    const agora = new Date();
    const ehHoje = isSameDay(dataBase, agora);
    const dataInteiraPassou = isBefore(startOfDay(dataBase), startOfDay(agora));

    // Função para adicionar horários de um período
    const adicionarHorariosPeriodo = (inicio: string, fim: string) => {
      const horaInicio = parse(inicio, "HH:mm", dataBase);
      const horaFim = parse(fim, "HH:mm", dataBase);

      let horarioAtual = horaInicio;
      while (isBefore(horarioAtual, horaFim)) {
        const horarioStr = format(horarioAtual, "HH:mm");

        // Verificar se este horário tem conflito com compromissos existentes
        const inicioCompromisso = parse(`${data} ${horarioStr}`, "yyyy-MM-dd HH:mm", new Date());
        const fimCompromisso = addMinutes(inicioCompromisso, duracaoMinutos);

        // Verificar se o horário já passou.
        const horarioPassou = dataInteiraPassou || (ehHoje && isBefore(inicioCompromisso, agora));

        const compromissosNoHorario = compromissosExistentes.filter((comp) => {
          const compInicio = new Date(comp.data_hora_inicio);
          const compFim = new Date(comp.data_hora_fim);

          // Verificar se há sobreposição de horários
          // Um horário está ocupado se o novo compromisso começaria durante um existente
          return (
            inicioCompromisso >= compInicio && inicioCompromisso < compFim
          );
        });

        // Se permite simultâneo, verifica se ainda há capacidade disponível
        // Se não permite, só disponível se não houver compromissos e não passou
        const capacidadeMaxima = permitirSimultaneo ? capacidadeSimultanea : 1;
        const disponivel = !horarioPassou && (compromissosNoHorario.length < capacidadeMaxima);

        horarios.push({
          horario: horarioStr,
          disponivel,
          passado: horarioPassou,
          compromissos: compromissosNoHorario,
        });

        horarioAtual = addMinutes(horarioAtual, duracaoMinutos); // Intervalos baseados na duração configurada
      }
    };

    // Adicionar horários da manhã (se ativo)
    if (horarioComercial.manha.ativo) {
      adicionarHorariosPeriodo(horarioComercial.manha.inicio, horarioComercial.manha.fim);
    }

    // Adicionar horários da tarde (se ativo), excluindo intervalo de almoço
    if (horarioComercial.tarde.ativo) {
      let inicioTarde = horarioComercial.tarde.inicio;

      // Se intervalo de almoço ativo, ajustar início da tarde
      if (horarioComercial.intervalo_almoco.ativo) {
        const fimAlmoco = parse(horarioComercial.intervalo_almoco.fim, "HH:mm", dataBase);
        const inicioTardeOriginal = parse(horarioComercial.tarde.inicio, "HH:mm", dataBase);

        // Usar o maior valor entre fim do almoço e início da tarde
        if (isAfter(fimAlmoco, inicioTardeOriginal)) {
          inicioTarde = format(fimAlmoco, "HH:mm");
        }
      }

      adicionarHorariosPeriodo(inicioTarde, horarioComercial.tarde.fim);
    }

    // Adicionar horários da noite (se ativo)
    if (horarioComercial.noite.ativo) {
      adicionarHorariosPeriodo(horarioComercial.noite.inicio, horarioComercial.noite.fim);
    }

    return horarios;
  }, [data, dataBase, horarioComercial, compromissosExistentes, duracaoMinutos, permitirSimultaneo, capacidadeSimultanea, ehDiaFuncionamento]);

  const totalDisponiveis = horariosDisponiveis.filter((h) => h.disponivel).length;
  const totalOcupados = horariosDisponiveis.filter((h) => !h.disponivel && !h.passado).length;
  const totalPassados = horariosDisponiveis.filter((h) => h.passado).length;

  // Se não é dia de funcionamento, mostrar mensagem
  if (!ehDiaFuncionamento) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-orange-50 dark:bg-orange-950/20">
          <CalendarX className="h-12 w-12 text-orange-500 mb-3" />
          <h3 className="font-medium text-orange-700 dark:text-orange-400">
            {diasSemanaLabels[diaDaSemanaStr]} - Não é dia de funcionamento
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            A empresa não funciona neste dia da semana.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Dias de funcionamento: {diasFuncionamento.map(d => diasSemanaLabels[d]?.substring(0, 3)).join(", ")}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Estatísticas */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <span className="text-muted-foreground">
            {totalDisponiveis} disponíveis
          </span>
        </div>
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-red-600" />
          <span className="text-muted-foreground">{totalOcupados} ocupados</span>
        </div>
        {totalPassados > 0 && (
          <div className="flex items-center gap-2">
            <Ban className="h-4 w-4 text-gray-400" />
            <span className="text-muted-foreground">{totalPassados} passados</span>
          </div>
        )}
        {permitirSimultaneo && (
          <Badge variant="secondary" className="ml-auto">
            <Clock className="h-3 w-3 mr-1" />
            Atendimentos simultâneos
          </Badge>
        )}
      </div>

      {/* Lista de horários */}
      <ScrollArea className="h-[300px] pr-4">
        <div className="grid grid-cols-3 gap-2">
        {horariosDisponiveis.map((item) => {
            const isSelected = horarioSelecionado === item.horario;
            const hasCompromissos = item.compromissos.length > 0;
            const isPassado = item.passado;
            const capacidadeMaxima = permitirSimultaneo ? capacidadeSimultanea : 1;
            const vagasRestantes = capacidadeMaxima - item.compromissos.length;
            const estaCheio = vagasRestantes <= 0;
            const parcialmenteOcupado = hasCompromissos && !estaCheio;

            return (
              <Button
                key={item.horario}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                disabled={!item.disponivel}
                onClick={() => onSelecionarHorario(item.horario)}
                className={cn(
                  "relative flex flex-col items-center justify-center h-auto py-3",
                  !item.disponivel && "opacity-50 cursor-not-allowed",
                  estaCheio && !isPassado && "border-red-500 bg-red-50 dark:bg-red-950/20",
                  parcialmenteOcupado && !isPassado && "border-orange-500 bg-orange-50 dark:bg-orange-950/20",
                  isPassado && "border-gray-300 bg-gray-100 dark:bg-gray-800/50 line-through"
                )}
              >
                <span className={cn("text-sm font-medium", isPassado && "text-gray-400")}>{item.horario}</span>
                
                {/* Indicador visual de status */}
                {isPassado && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                  </div>
                )}
                
                {/* Cheio - não pode mais agendar */}
                {!isPassado && estaCheio && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-red-600" />
                    <span className="text-xs text-muted-foreground">
                      {item.compromissos.length}/{capacidadeMaxima}
                    </span>
                  </div>
                )}
                
                {/* Parcialmente ocupado - ainda pode agendar */}
                {!isPassado && parcialmenteOcupado && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                    <span className="text-xs text-muted-foreground">
                      {item.compromissos.length}/{capacidadeMaxima}
                    </span>
                  </div>
                )}
                
                {/* Totalmente livre */}
                {!isPassado && !hasCompromissos && item.disponivel && (
                  <div className="flex items-center gap-1 mt-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-600" />
                    {permitirSimultaneo && capacidadeMaxima > 1 && (
                      <span className="text-xs text-muted-foreground">
                        0/{capacidadeMaxima}
                      </span>
                    )}
                  </div>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Legenda */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground border-t pt-3">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-600" />
          <span>Livre</span>
        </div>
        {permitirSimultaneo && capacidadeSimultanea > 1 && (
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-orange-500" />
            <span>Parcial ({capacidadeSimultanea} vagas)</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-600" />
          <span>Cheio</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-gray-400" />
          <span>Passado</span>
        </div>
      </div>
    </div>
  );
}
