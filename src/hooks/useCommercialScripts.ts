import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type ScriptNodeType =
  | "message"
  | "delay"
  | "wait_reply"
  | "condition"
  | "action_tag"
  | "action_funnel"
  | "action_task"
  | "end";

export interface CommercialScript {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  category: string;
  active: boolean;
  triggers: any[];
  start_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScriptNode {
  id: string;
  script_id: string;
  node_type: ScriptNodeType;
  config: any;
  position_x: number;
  position_y: number;
}

export interface ScriptEdge {
  id: string;
  script_id: string;
  source_node_id: string;
  target_node_id: string;
  source_handle: string | null;
  label: string | null;
}

async function getCompanyId(): Promise<string | null> {
  const { data } = await supabase.rpc("get_my_company_id");
  return (data as string) || null;
}

export function useCommercialScripts() {
  return useQuery({
    queryKey: ["commercial_scripts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commercial_scripts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as CommercialScript[];
    },
  });
}

export function useScriptDetail(scriptId: string | null) {
  return useQuery({
    queryKey: ["commercial_script", scriptId],
    enabled: !!scriptId,
    queryFn: async () => {
      const [scriptRes, nodesRes, edgesRes] = await Promise.all([
        supabase.from("commercial_scripts").select("*").eq("id", scriptId!).maybeSingle(),
        supabase.from("commercial_script_nodes").select("*").eq("script_id", scriptId!),
        supabase.from("commercial_script_edges").select("*").eq("script_id", scriptId!),
      ]);
      if (scriptRes.error) throw scriptRes.error;
      return {
        script: scriptRes.data as CommercialScript | null,
        nodes: (nodesRes.data || []) as ScriptNode[],
        edges: (edgesRes.data || []) as ScriptEdge[],
      };
    },
  });
}

export function useCreateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; category?: string }) => {
      const company_id = await getCompanyId();
      if (!company_id) throw new Error("Sem empresa");
      const { data: { user } } = await supabase.auth.getUser();

      const { data: script, error } = await supabase
        .from("commercial_scripts")
        .insert({
          company_id,
          name: payload.name,
          description: payload.description,
          category: payload.category || "geral",
          created_by: user?.id,
          triggers: [{ type: "manual" }],
        })
        .select()
        .single();
      if (error) throw error;
      return script as CommercialScript;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scripts"] });
      toast.success("Roteiro criado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<CommercialScript> & { id: string }) => {
      const { id, ...rest } = payload;
      const { error } = await supabase.from("commercial_scripts").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["commercial_scripts"] });
      qc.invalidateQueries({ queryKey: ["commercial_script", vars.id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteScript() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commercial_scripts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commercial_scripts"] });
      toast.success("Roteiro excluído");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useSaveNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id?: string;
      script_id: string;
      node_type: ScriptNodeType;
      config: any;
      position_x?: number;
      position_y?: number;
    }) => {
      if (payload.id) {
        const { error } = await supabase
          .from("commercial_script_nodes")
          .update({
            node_type: payload.node_type,
            config: payload.config,
            position_x: payload.position_x ?? 0,
            position_y: payload.position_y ?? 0,
          })
          .eq("id", payload.id);
        if (error) throw error;
        return payload.id;
      } else {
        const { data, error } = await supabase
          .from("commercial_script_nodes")
          .insert({
            script_id: payload.script_id,
            node_type: payload.node_type,
            config: payload.config,
            position_x: payload.position_x ?? 0,
            position_y: payload.position_y ?? 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["commercial_script", vars.script_id] });
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useDeleteNode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; script_id: string }) => {
      const { error } = await supabase.from("commercial_script_nodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["commercial_script", vars.script_id] });
    },
  });
}

export function useSaveEdge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      script_id: string;
      source_node_id: string;
      target_node_id: string;
      source_handle?: string;
      label?: string;
    }) => {
      // Remove edge anterior do mesmo source+handle
      await supabase
        .from("commercial_script_edges")
        .delete()
        .eq("source_node_id", payload.source_node_id)
        .eq("source_handle", payload.source_handle || "");

      const { error } = await supabase.from("commercial_script_edges").insert({
        script_id: payload.script_id,
        source_node_id: payload.source_node_id,
        target_node_id: payload.target_node_id,
        source_handle: payload.source_handle || "",
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["commercial_script", vars.script_id] });
    },
  });
}

export function useStartScriptExecution() {
  return useMutation({
    mutationFn: async (payload: {
      script_id: string;
      conversation_id?: string;
      lead_id?: string;
      telefone_formatado: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("commercial-script-engine", {
        body: { action: "start", ...payload },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("🚀 Roteiro iniciado"),
    onError: (e: any) => toast.error(e.message || "Falha ao iniciar"),
  });
}
