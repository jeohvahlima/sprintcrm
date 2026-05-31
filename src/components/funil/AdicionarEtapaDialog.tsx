import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AdicionarEtapaDialogProps {
  funilId: string;
  onEtapaAdded: () => void;
  customTrigger?: React.ReactNode;
}

const CORES_PADRAO = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#ef4444", "#8b5cf6", "#ec4899"];

export function AdicionarEtapaDialog({ funilId, onEtapaAdded, customTrigger }: AdicionarEtapaDialogProps) {
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState(CORES_PADRAO[0]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const nomeFormatado = nome.trim();
    
    if (!nomeFormatado) {
      toast.error("Digite o nome da etapa");
      return;
    }

    if (nomeFormatado.length < 3) {
      toast.error("Nome deve ter pelo menos 3 caracteres");
      return;
    }

    if (nomeFormatado.length > 50) {
      toast.error("Nome deve ter no máximo 50 caracteres");
      return;
    }

    setLoading(true);

    try {
      // Pegar company_id do usuário
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Usuário não autenticado");

      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", userData.user.id)
        .single();

      if (!userRole) throw new Error("Empresa não encontrada");

      // Verificar se já existe etapa com mesmo nome neste funil
      const { data: etapaExistente } = await supabase
        .from("etapas")
        .select("id")
        .eq("funil_id", funilId)
        .ilike("nome", nomeFormatado)
        .maybeSingle();

      if (etapaExistente) {
        toast.error("Já existe uma etapa com este nome neste funil");
        setLoading(false);
        return;
      }

      // Buscar maior posição atual
      const { data: etapas } = await supabase
        .from("etapas")
        .select("posicao")
        .eq("funil_id", funilId)
        .order("posicao", { ascending: false })
        .limit(1);

      const novaPosicao = etapas && etapas.length > 0 ? etapas[0].posicao + 1 : 0;

      // Criar nova etapa
      const { error } = await supabase.from("etapas").insert({
        nome: nomeFormatado,
        cor,
        posicao: novaPosicao,
        funil_id: funilId,
        company_id: userRole.company_id,
      });

      if (error) throw error;

      toast.success(`Etapa "${nomeFormatado}" adicionada com sucesso!`);
      setNome("");
      setCor(CORES_PADRAO[0]);
      setOpen(false);
      onEtapaAdded();
    } catch (error: any) {
      console.error("Erro ao adicionar etapa:", error);
      toast.error(error.message || "Erro ao adicionar etapa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {customTrigger ?? (
          <Button variant="outline" size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Etapa
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Nova Etapa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome da Etapa *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Qualificação, Negociação, Fechamento"
              disabled={loading}
              maxLength={50}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              {nome.length}/50 caracteres
            </p>
          </div>

          <div>
            <Label>Cor da Etapa</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {CORES_PADRAO.map((corPadrao) => (
                <button
                  key={corPadrao}
                  type="button"
                  className="w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 shadow-sm"
                  style={{
                    backgroundColor: corPadrao,
                    borderColor: cor === corPadrao ? "#000" : "transparent",
                    boxShadow: cor === corPadrao ? "0 0 0 2px rgba(0,0,0,0.1)" : "none",
                  }}
                  onClick={() => setCor(corPadrao)}
                  disabled={loading}
                  title={corPadrao}
                />
              ))}
              <div className="flex items-center ml-2">
                <Input
                  type="color"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-10 h-10 p-1 cursor-pointer"
                  disabled={loading}
                  title="Escolher cor personalizada"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adicionando..." : "Adicionar Etapa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
