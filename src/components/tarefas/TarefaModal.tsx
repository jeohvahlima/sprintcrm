/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01
 * IMPORTANTE: Deve ter seleção de Quadro e Etapa no topo do formulário
 * Se este arquivo retroceder, verificar:
 * 1. Estados boards e columns
 * 2. Função carregarBoardsEColunas
 * 3. Select de Quadro no topo do form
 * 4. Select de Etapa (filtrado por quadro) logo abaixo
 * 5. Salva board_id e column_id ao criar tarefa
 */
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TarefaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: {
    id: string;
    nome: string;
  };
  onTarefaCriada?: () => void;
}

interface User {
  id: string;
  full_name: string;
}

interface Board {
  id: string;
  nome: string;
}

interface Column {
  id: string;
  nome: string;
  board_id: string;
}

export function TarefaModal({ open, onOpenChange, lead, onTarefaCriada }: TarefaModalProps) {
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [columns, setColumns] = useState<Column[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "normal",
    assignee_id: "",
    status: "pendente",
    board_id: "",
    column_id: ""
  });

  useEffect(() => {
    if (open) {
      carregarUsuarios();
      carregarBoardsEColunas();
    }
  }, [open]);

  const carregarUsuarios = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name")
        .order("full_name");

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error("Erro ao carregar usuários:", error);
      toast.error("Erro ao carregar lista de responsáveis");
    }
  };

  // ✅ CRÍTICO: Carrega boards e columns da tabela task_boards e task_columns
  const carregarBoardsEColunas = async () => {
    try {
      // Carregar boards
      const { data: boardsData, error: boardsError } = await supabase
        .from("task_boards")
        .select("*")
        .order("criado_em");

      if (boardsError) throw boardsError;
      setBoards(boardsData || []);

      // Carregar colunas
      const { data: columnsData, error: columnsError } = await supabase
        .from("task_columns")
        .select("*")
        .order("posicao");

      if (columnsError) throw columnsError;
      setColumns(columnsData || []);
    } catch (error) {
      console.error("Erro ao carregar boards e colunas:", error);
      toast.error("Erro ao carregar quadros e etapas");
    }
  };

  // ✅ CRÍTICO: Atualizar column_id quando board_id mudar
  useEffect(() => {
    if (formData.board_id && columns.length > 0) {
      const columnsDoBoard = columns.filter(c => c.board_id === formData.board_id);
      if (columnsDoBoard.length > 0 && !columnsDoBoard.find(c => c.id === formData.column_id)) {
        // Se a coluna atual não pertence ao board selecionado, selecionar a primeira coluna do board
        setFormData(prev => ({ ...prev, column_id: columnsDoBoard[0].id }));
      }
    }
  }, [formData.board_id, columns]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error("Digite o título da tarefa");
      return;
    }

    if (!formData.due_date) {
      toast.error("Selecione a data limite");
      return;
    }

    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Buscar company_id do usuário
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("company_id")
        .eq("user_id", session.user.id)
        .single();

      if (!userRole?.company_id) {
        toast.error("Empresa não encontrada");
        return;
      }

      const { error } = await supabase
        .from("tasks")
        .insert({
          title: formData.title,
          description: formData.description,
          due_date: formData.due_date,
          priority: formData.priority,
          assignee_id: formData.assignee_id || session.user.id,
          owner_id: session.user.id,
          company_id: userRole.company_id,
          lead_id: lead.id,
          status: formData.status,
          board_id: formData.board_id || null, // ✅ CRÍTICO: Salva board_id
          column_id: formData.column_id || null // ✅ CRÍTICO: Salva column_id
        });

      if (error) throw error;

      toast.success("Tarefa criada com sucesso!");
      onOpenChange(false);
      onTarefaCriada?.();

      // Limpar formulário
      setFormData({
        title: "",
        description: "",
        due_date: "",
        priority: "normal",
        assignee_id: "",
        status: "pendente",
        board_id: "",
        column_id: ""
      });
    } catch (error) {
      console.error("Erro ao criar tarefa:", error);
      toast.error("Erro ao criar tarefa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col !z-[300]">
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-2 flex-1"  style={{ maxHeight: 'calc(90vh - 120px)' }}>
          {/* ✅ CRÍTICO: Select de Quadro no topo - NÃO REMOVER */}
          {boards.length > 0 && (
            <div>
              <Label htmlFor="board_id">Quadro</Label>
              <Select
                value={formData.board_id}
                onValueChange={(value) => setFormData({ ...formData, board_id: value, column_id: "" })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o quadro" />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ✅ CRÍTICO: Select de Etapa (filtrado pelo quadro) - NÃO REMOVER */}
          {formData.board_id && columns.filter(c => c.board_id === formData.board_id).length > 0 && (
            <div>
              <Label htmlFor="column_id">Etapa</Label>
              <Select
                value={formData.column_id}
                onValueChange={(value) => setFormData({ ...formData, column_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a etapa" />
                </SelectTrigger>
                <SelectContent>
                  {columns
                    .filter(c => c.board_id === formData.board_id)
                    .map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        {column.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Enviar proposta comercial"
              required
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Detalhes da tarefa"
              rows={3}
            />
          </div>

          <div>
            <Label htmlFor="due_date">Data Limite *</Label>
            <Input
              id="due_date"
              type="datetime-local"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              required
            />
          </div>

          <div>
            <Label htmlFor="priority">Prioridade</Label>
            <Select
              value={formData.priority}
              onValueChange={(value) => setFormData({ ...formData, priority: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="assignee">Responsável</Label>
            <Select
              value={formData.assignee_id}
              onValueChange={(value) => setFormData({ ...formData, assignee_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Criando..." : "Criar Tarefa"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}




