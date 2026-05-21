import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface ProspectContact {
  id: string;
  name: string;
  phone: string | null;
  telefone: string | null;
  email: string | null;
  instagram: string | null;
  tags: string[] | null;
  to_prospect: boolean | null;
  prospecting_priority: number | null;
  last_prospected_at: string | null;
  source: string | null;
  responsavel_id: string | null;
}

export type ProspectChannel = "coldcall" | "instagram" | "whatsapp";

interface Options {
  channel: ProspectChannel;
  onlyMarked?: boolean; // só "para prospectar"
  search?: string;
  limit?: number;
}

export function useProspectingContacts({ channel, onlyMarked = false, search = "", limit = 100 }: Options) {
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("get_my_company_id").then(({ data }) => data && setCompanyId(data));
  }, []);

  return useQuery({
    queryKey: ["prospecting-contacts", channel, onlyMarked, search, limit, companyId],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("leads")
        .select("id, name, phone, telefone, email, tags, to_prospect, prospecting_priority, last_prospected_at, source, responsavel_id")
        .eq("company_id", companyId!)
        .is("lead_origem_id", null)
        .order("last_prospected_at", { ascending: true, nullsFirst: true })
        .order("prospecting_priority", { ascending: false, nullsFirst: false })
        .limit(limit);

      if (onlyMarked) q = q.eq("to_prospect", true);

      // Filtros por canal: requer telefone p/ coldcall e whatsapp
      if (channel === "coldcall" || channel === "whatsapp") {
        q = q.or("phone.not.is.null,telefone.not.is.null");
      }

      if (search) {
        q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%,telefone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, error } = await q;
      if (error) throw error;

      // Para Instagram filtrar quem tem tag "instagram" ou source instagram
      let rows = (data || []) as any[];
      if (channel === "instagram") {
        rows = rows.filter(
          (l) =>
            (Array.isArray(l.tags) && l.tags.some((t: string) => /instagram|ig/i.test(t))) ||
            /instagram|ig/i.test(l.source || "")
        );
      }

      return rows.map((l) => ({
        ...l,
        instagram: null,
      })) as ProspectContact[];
    },
  });
}

export async function markLeadAsProspect(leadId: string, marked: boolean, priority = 0) {
  const { error } = await supabase
    .from("leads")
    .update({ to_prospect: marked, prospecting_priority: priority } as any)
    .eq("id", leadId);
  if (error) throw error;
}

export async function touchLastProspected(leadId: string) {
  await supabase
    .from("leads")
    .update({ last_prospected_at: new Date().toISOString() } as any)
    .eq("id", leadId);
}
