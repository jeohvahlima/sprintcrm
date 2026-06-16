import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Send, Loader2, User, Users, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CrmLead {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

interface ShareCrmContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  /** Telefone do destinatário (conversa atual) */
  targetNumber: string;
}

export function ShareCrmContactDialog({
  open,
  onOpenChange,
  companyId,
  targetNumber,
}: ShareCrmContactDialogProps) {
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open && companyId) load();
    if (!open) {
      setSelected([]);
      setSearch("");
    }
  }, [open, companyId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, telefone, phone, email")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .range(0, 999);
      if (error) throw error;
      const list: CrmLead[] = (data || [])
        .map((l: any) => ({
          id: l.id,
          name: l.name || "(sem nome)",
          phone: (l.telefone || l.phone || "").toString().replace(/\D/g, ""),
          email: l.email,
        }))
        .filter((l) => l.phone.length >= 10);
      setLeads(list);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao carregar contatos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.name.toLowerCase().includes(q) ||
      l.phone.includes(search.replace(/\D/g, ""))
    );
  });

  const toggle = (id: string) =>
    setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const buildVCard = (l: CrmLead) =>
    `BEGIN:VCARD\nVERSION:3.0\nFN:${l.name}\nTEL;TYPE=CELL:+${l.phone.startsWith("55") ? l.phone : "55" + l.phone}\n${l.email ? `EMAIL:${l.email}\n` : ""}END:VCARD`;

  const handleSend = async () => {
    if (selected.length === 0) {
      toast({ title: "Selecione ao menos um contato", variant: "destructive" });
      return;
    }
    setSending(true);
    let ok = 0;
    let fail = 0;
    const numero = targetNumber.replace(/\D/g, "");
    for (const id of selected) {
      const lead = leads.find((l) => l.id === id);
      if (!lead) continue;
      try {
        const texto = `👤 *Contato compartilhado do CRM*\n\n*Nome:* ${lead.name}\n*Telefone:* +${lead.phone}\n${lead.email ? `*E-mail:* ${lead.email}\n` : ""}`;
        const { error } = await supabase.functions.invoke("enviar-whatsapp", {
          body: { numero, mensagem: texto, company_id: companyId, tipo_mensagem: "text" },
        });
        if (error) throw error;
        // Registrar na timeline
        await supabase.from("conversas").insert({
          numero,
          telefone_formatado: numero.replace(/^55/, ""),
          mensagem: JSON.stringify({ type: "contact", name: lead.name, phone: lead.phone, vcard: buildVCard(lead) }),
          origem: "compartilhamento",
          status: "enviada",
          tipo_mensagem: "contact",
          nome_contato: lead.name,
          company_id: companyId,
          fromme: true,
          sent_by: "Sistema - Compartilhar Contato",
          read: true,
          delivered: true,
        });
        ok++;
      } catch (e) {
        console.error("Falha ao compartilhar", lead.name, e);
        fail++;
      }
    }
    setSending(false);
    if (ok > 0) {
      toast({
        title: "✅ Contato compartilhado",
        description: `${ok} contato(s) enviado(s)${fail ? `, ${fail} falharam` : ""}`,
      });
      onOpenChange(false);
    } else {
      toast({ title: "❌ Não foi possível compartilhar", variant: "destructive" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Compartilhar contato do CRM
          </DialogTitle>
          <DialogDescription>
            Selecione um contato do seu CRM para enviar nesta conversa
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <ScrollArea className="h-[320px] pr-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              Nenhum contato encontrado
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((l) => {
                const isSel = selected.includes(l.id);
                return (
                  <button
                    key={l.id}
                    onClick={() => toggle(l.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                      isSel
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/50 border-transparent"
                    }`}
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback>
                        <User className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-medium text-sm truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {l.phone}
                        {l.email ? ` · ${l.email}` : ""}
                      </p>
                    </div>
                    {isSel && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {selected.length > 0 ? `${selected.length} selecionado(s)` : ""}
          </span>
          <Button
            onClick={handleSend}
            disabled={selected.length === 0 || sending}
            className="gap-2"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Enviando...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" /> Compartilhar
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
