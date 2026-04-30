import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PlaybookSection {
  type: string;
  [key: string]: any;
}

export interface CommercialPlaybook {
  id: string;
  company_id: string | null;
  is_global: boolean;
  parent_playbook_id: string | null;
  title: string;
  description: string | null;
  category: string;
  segment: string;
  cover_emoji: string | null;
  accent_color: string | null;
  sections: PlaybookSection[];
  tags: string[] | null;
  estimated_time: string | null;
  difficulty: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function usePlaybooks(filters?: { segment?: string; category?: string }) {
  return useQuery({
    queryKey: ["commercial_playbooks", filters],
    queryFn: async () => {
      let q = supabase
        .from("commercial_playbooks" as any)
        .select("*")
        .order("is_global", { ascending: false })
        .order("created_at", { ascending: false });

      if (filters?.segment && filters.segment !== "all") q = q.eq("segment", filters.segment);
      if (filters?.category && filters.category !== "all") q = q.eq("category", filters.category);

      const { data, error } = await q;
      if (error) throw error;
      return (data as unknown as CommercialPlaybook[]) ?? [];
    },
  });
}

export function useDuplicatePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playbook: CommercialPlaybook) => {
      const { data: companyId, error: cErr } = await supabase.rpc("get_my_company_id");
      if (cErr || !companyId) throw new Error("Empresa não identificada");

      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("commercial_playbooks" as any)
        .insert({
          company_id: companyId,
          is_global: false,
          parent_playbook_id: playbook.id,
          title: `${playbook.title} (cópia)`,
          description: playbook.description,
          category: playbook.category,
          segment: playbook.segment,
          cover_emoji: playbook.cover_emoji,
          accent_color: playbook.accent_color,
          sections: playbook.sections,
          tags: playbook.tags,
          estimated_time: playbook.estimated_time,
          difficulty: playbook.difficulty,
          created_by: user?.user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_playbooks"] });
      toast.success("Cópia criada — agora você pode editar para sua realidade");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao duplicar"),
  });
}

export function useUpdatePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CommercialPlaybook> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase
        .from("commercial_playbooks" as any)
        .update(rest as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_playbooks"] });
      toast.success("Playbook atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });
}

export function useDeletePlaybook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("commercial_playbooks" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_playbooks"] });
      toast.success("Playbook excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao excluir"),
  });
}
