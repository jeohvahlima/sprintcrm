import { useState, useEffect } from "react";
import { User } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

interface Profissional {
  id: string;
  nome: string;
  especialidade?: string;
}

interface ProfissionalSelectorProps {
  value: string;
  onChange: (profissionalId: string) => void;
  agendaId?: string;
  disabled?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function ProfissionalSelector({
  value,
  onChange,
  agendaId,
  disabled = false,
  showLabel = true,
  className = "",
}: ProfissionalSelectorProps) {
  const [profissionais, setProfissionais] = useState<Profissional[]>([]);
  const [loading, setLoading] = useState(false);

  // Carregar profissionais da empresa
  useEffect(() => {
    loadProfissionais();
  }, []);

  // Quando a agenda mudar, sugerir profissional responsável
  useEffect(() => {
    if (agendaId && !value) {
      suggestProfissionalFromAgenda(agendaId);
    }
  }, [agendaId]);

  const loadProfissionais = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profissionais")
        .select("id, nome, especialidade")
        .order("nome");

      if (error) throw error;
      setProfissionais(data || []);
    } catch (error) {
      console.error("Erro ao carregar profissionais:", error);
    } finally {
      setLoading(false);
    }
  };

  const suggestProfissionalFromAgenda = async (agendaId: string) => {
    try {
      const { data: agenda, error } = await supabase
        .from("agendas")
        .select("responsavel_id")
        .eq("id", agendaId)
        .maybeSingle();

      if (error) throw error;
      
      if (agenda?.responsavel_id) {
        // Verificar se o profissional existe na lista
        const profissionalExiste = profissionais.some(p => p.id === agenda.responsavel_id);
        if (profissionalExiste) {
          onChange(agenda.responsavel_id);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar responsável da agenda:", error);
    }
  };

  const formatProfissionalDisplay = (profissional: Profissional) => {
    if (profissional.especialidade) {
      return `${profissional.nome} - ${profissional.especialidade}`;
    }
    return profissional.nome;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {showLabel && (
        <Label className="flex items-center gap-2">
          <User className="h-4 w-4" />
          Profissional Responsável
        </Label>
      )}
      <Select
        value={value || "none"}
        onValueChange={(val) => onChange(val === "none" ? "" : val)}
        disabled={disabled || loading}
      >
        <SelectTrigger>
          <SelectValue placeholder="Selecione um profissional" />
        </SelectTrigger>
        <SelectContent className="z-[400]">
          <SelectItem value="none">Nenhum profissional</SelectItem>
          {profissionais.map((profissional) => (
            <SelectItem key={profissional.id} value={profissional.id}>
              {formatProfissionalDisplay(profissional)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value && value !== "none" && (
        <p className="text-xs text-muted-foreground">
          {(() => {
            const profissional = profissionais.find(p => p.id === value);
            return profissional?.especialidade 
              ? `Especialidade: ${profissional.especialidade}`
              : "Profissional selecionado";
          })()}
        </p>
      )}
    </div>
  );
}
