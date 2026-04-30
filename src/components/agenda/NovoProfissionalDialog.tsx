import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface NovoProfissionalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  companyId: string;
}

export function NovoProfissionalDialog({
  open,
  onOpenChange,
  onSuccess,
  companyId
}: NovoProfissionalDialogProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    senha: "",
    telefone: "",
    especialidade: "",
    valor_consulta: "",
    duracao_consulta: "30"
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nome || !formData.email || !formData.senha) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (formData.senha.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      console.log("[NovoProfissional] Criando profissional...", {
        nome: formData.nome,
        email: formData.email
      });

      const valorNum = formData.valor_consulta ? Number(formData.valor_consulta.replace(',', '.')) : null;
      const duracaoNum = formData.duracao_consulta ? parseInt(formData.duracao_consulta, 10) : 30;

      const { data, error } = await supabase.functions.invoke('criar-profissional', {
        body: {
          nome: formData.nome,
          email: formData.email,
          senha: formData.senha,
          telefone: formData.telefone || undefined,
          especialidade: formData.especialidade || undefined,
          valor_consulta: Number.isFinite(valorNum) ? valorNum : null,
          duracao_consulta: Number.isFinite(duracaoNum) && duracaoNum > 0 ? duracaoNum : 30,
          company_id: companyId
        }
      });

      if (error) {
        console.error("[NovoProfissional] Erro:", error);
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      console.log("[NovoProfissional] Profissional criado:", data);

      toast.success("Profissional cadastrado com sucesso!");
      
      // Limpar form
      setFormData({
        nome: "",
        email: "",
        senha: "",
        telefone: "",
        especialidade: "",
        valor_consulta: "",
        duracao_consulta: "30"
      });

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("[NovoProfissional] Erro ao criar profissional:", error);
      toast.error(error.message || "Erro ao cadastrar profissional");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Cadastrar Novo Profissional</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">
              Nome Completo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="nome"
              value={formData.nome}
              onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
              placeholder="Digite o nome completo"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">
              E-mail <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="email@exemplo.com"
              required
            />
            <p className="text-xs text-muted-foreground">
              Este e-mail será usado para login no app Waze Agenda
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="senha">
              Senha <span className="text-destructive">*</span>
            </Label>
            <Input
              id="senha"
              type="password"
              value={formData.senha}
              onChange={(e) => setFormData({ ...formData, senha: e.target.value })}
              placeholder="Mínimo 6 caracteres"
              minLength={6}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              type="tel"
              value={formData.telefone}
              onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="especialidade">Especialidade</Label>
            <Input
              id="especialidade"
              value={formData.especialidade}
              onChange={(e) => setFormData({ ...formData, especialidade: e.target.value })}
              placeholder="Ex: Dentista, Psicólogo, Nutricionista, Advogado..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="valor_consulta">Valor da consulta (R$)</Label>
              <Input
                id="valor_consulta"
                type="number"
                step="0.01"
                min="0"
                value={formData.valor_consulta}
                onChange={(e) => setFormData({ ...formData, valor_consulta: e.target.value })}
                placeholder="Ex: 250.00"
              />
              <p className="text-xs text-muted-foreground">Exibido no agendamento público</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duracao_consulta">Duração (minutos)</Label>
              <Input
                id="duracao_consulta"
                type="number"
                min="5"
                step="5"
                value={formData.duracao_consulta}
                onChange={(e) => setFormData({ ...formData, duracao_consulta: e.target.value })}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground">Tempo de cada atendimento</p>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cadastrar Profissional
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}