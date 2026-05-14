import { useState } from "react";
import { Target, Phone, Instagram, MessageSquare, Trophy, Calendar, DollarSign, Mail, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  leadId?: string | null;
  contactPhone?: string;
  channel: "whatsapp" | "instagram" | "facebook";
  companyId?: string | null;
  variant?: "icon" | "ghost";
}

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { key: "instagram", label: "Instagram", icon: Instagram },
  { key: "coldcall", label: "Cold Call", icon: Phone },
] as const;

const OUTCOMES = [
  { key: "contacted", label: "Contactado", icon: Target, color: "text-cyan-400" },
  { key: "responded", label: "Respondeu", icon: MessageSquare, color: "text-blue-400" },
  { key: "opportunity", label: "Oportunidade", icon: Trophy, color: "text-purple-400" },
  { key: "meeting_scheduled", label: "Reunião agendada", icon: Calendar, color: "text-yellow-400" },
  { key: "sale_closed", label: "Venda fechada 🎉", icon: DollarSign, color: "text-green-400" },
] as const;

export function MarkProspectionButton({ leadId, contactPhone, channel, companyId, variant = "icon" }: Props) {
  const [busy, setBusy] = useState(false);

  const defaultChannel = channel === "instagram" ? "instagram" : "whatsapp";

  const register = async (channelKey: string, outcome: string) => {
    if (!companyId) return toast.error("Empresa não identificada.");
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // 1) marca lead como prospectado
      if (leadId) {
        await supabase
          .from("leads")
          .update({
            to_prospect: true,
            last_prospected_at: new Date().toISOString(),
          } as any)
          .eq("id", leadId);
      }

      // 2) registra interação
      const { error } = await supabase.from("prospecting_interactions").insert({
        company_id: companyId,
        user_id: user.id,
        lead_id: leadId || null,
        lead_phone: contactPhone || null,
        channel: channelKey,
        outcome,
        log_type: "prospecting",
        interaction_summary: `Marcado manualmente via Conversas (${channelKey})`,
      } as any);

      if (error) throw error;

      toast.success(`Marcado como ${outcome.replace("_", " ")} via ${channelKey}`);
    } catch (e: any) {
      console.error("[MarkProspection] erro:", e);
      toast.error(e.message || "Erro ao marcar prospecção");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant={variant === "icon" ? "outline" : "ghost"}
              size="icon"
              className="h-8 w-8"
              disabled={busy}
              title="Marcar prospecção"
            >
              <Target className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Marcar prospecção</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Registrar como prospecção</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OUTCOMES.map((o) => {
          const OIcon = o.icon;
          return (
            <DropdownMenuItem key={o.key} onClick={() => register(defaultChannel, o.key)}>
              <OIcon className={`h-4 w-4 mr-2 ${o.color}`} />
              {o.label}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Outro canal</DropdownMenuLabel>
        {CHANNELS.filter((c) => c.key !== defaultChannel).map((c) => {
          const CIcon = c.icon;
          return (
            <DropdownMenuItem key={c.key} onClick={() => register(c.key, "contacted")}>
              <CIcon className="h-4 w-4 mr-2" />
              Contactado via {c.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
