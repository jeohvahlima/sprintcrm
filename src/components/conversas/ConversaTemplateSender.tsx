import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Send } from "lucide-react";
import { TemplateSelector, Template } from "@/components/campanhas/TemplateSelector";
import { buildTemplateComponents, buildTemplateTextContent } from "@/utils/templateHelpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ConversaTemplateSenderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  contactName: string;
  contactPhone: string;
  origemApi?: "evolution" | "meta";
  onSent?: () => void;
}

function extractTemplateMediaInfo(template: Template, components: any[], fallbackMediaUrl: string) {
  const headerComponent = template.components?.find((c: any) => c.type === "HEADER");
  const headerPayload = components.find((component: any) => component.type === "header");
  const headerParameter = headerPayload?.parameters?.[0];
  const mediaType = headerParameter?.type as "image" | "video" | "document" | undefined;
  const mediaPayload = mediaType ? headerParameter?.[mediaType] : undefined;
  const mediaUrl = mediaPayload?.link || fallbackMediaUrl || "";

  if (!mediaType || !mediaUrl) {
    return { mediaUrl: null, fileName: null };
  }

  const fallbackExtensionByType: Record<string, string> = {
    image: "jpg",
    video: "mp4",
    document: "pdf",
  };

  const urlWithoutQuery = mediaUrl.split("?")[0];
  const extensionFromUrl = urlWithoutQuery.includes(".") ? urlWithoutQuery.split(".").pop() : "";
  const headerFormat = headerComponent?.format?.toLowerCase?.() || mediaType;
  const extension = extensionFromUrl || fallbackExtensionByType[headerFormat] || fallbackExtensionByType[mediaType] || "bin";

  return {
    mediaUrl,
    fileName: `${template.name}.${extension}`,
  };
}

export function ConversaTemplateSender({
  open,
  onOpenChange,
  companyId,
  contactName,
  contactPhone,
  origemApi,
  onSent,
}: ConversaTemplateSenderProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateMediaUrl, setTemplateMediaUrl] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!selectedTemplate || sending) return;

    // Validate media URL if template requires it
    const headerComponent = selectedTemplate.components?.find((c: any) => c.type === "HEADER");
    if (headerComponent?.format && headerComponent.format !== "TEXT") {
      const hasHandle = headerComponent.example?.header_handle?.[0];
      if (!hasHandle && !templateMediaUrl) {
        toast.error(`Este template requer uma URL de mídia no cabeçalho`);
        return;
      }
    }

    setSending(true);
    try {
      const lead = { name: contactName, telefone: contactPhone, phone: contactPhone, email: "" };
      const components = buildTemplateComponents(selectedTemplate, lead, templateVariables, templateMediaUrl);
      const textContent = buildTemplateTextContent(selectedTemplate, lead, templateVariables);
      const templateMediaInfo = extractTemplateMediaInfo(selectedTemplate, components, templateMediaUrl);

      // Normalize phone
      let telefoneNormalizado = contactPhone.replace(/[^0-9]/g, "");
      if (!telefoneNormalizado.startsWith("55") && telefoneNormalizado.length >= 10) {
        telefoneNormalizado = `55${telefoneNormalizado}`;
      }

      // Get current user info
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: userProfile } = await supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", user.id)
        .single();
      const sentByName = userProfile?.full_name || userProfile?.email || "Equipe";

      // 1. Send via edge function
      const payload: any = {
        numero: telefoneNormalizado,
        company_id: companyId,
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language,
        template_components: components,
        tipo_mensagem: "template",
        mensagem: `[Template: ${selectedTemplate.name}]`,
      };

      if (origemApi) {
        payload.force_provider = origemApi;
      }

      const { data: sendResult, error } = await supabase.functions.invoke("enviar-whatsapp", { body: payload });

      if (error) {
        console.error("❌ Erro ao invocar função:", error);
        throw new Error(error.message || "Falha ao chamar função de envio");
      }
      
      if (!sendResult?.success) {
        console.error("❌ Erro ao enviar template:", sendResult);
        throw new Error(sendResult?.error || "Falha ao enviar template via WhatsApp");
      }

      const whatsappMessageId = sendResult?.message_id || sendResult?.data?.messages?.[0]?.id || null;
      const providerMessageStatus = sendResult?.data?.messages?.[0]?.message_status || null;
      if (!whatsappMessageId) {
        throw new Error("Envio sem confirmação do provedor");
      }

      // 2. Save only confirmed sends to DB
      const { error: dbError } = await supabase.from("conversas").insert([{
        numero: contactPhone,
        telefone_formatado: telefoneNormalizado,
        mensagem: textContent,
        origem: "WhatsApp",
        origem_api: sendResult?.provider || origemApi || null,
        status: "Processando",
        tipo_mensagem: "template",
        nome_contato: contactName,
        company_id: companyId,
        owner_id: user.id,
        sent_by: sentByName,
        fromme: true,
        delivered: false,
        read: false,
        whatsapp_message_id: whatsappMessageId,
        midia_url: templateMediaInfo.mediaUrl,
        arquivo_nome: templateMediaInfo.fileName,
      }]);

      if (dbError) {
        console.error("❌ Erro ao salvar template no banco:", dbError);
        toast.warning("Template aceito pela Meta, mas houve erro ao salvar o histórico.");
      } else {
        toast.success(
          providerMessageStatus === "accepted"
            ? "Template recebido pela Meta. Aguarde a confirmação da entrega."
            : "Template enviado para processamento. Aguarde a confirmação da Meta."
        );
      }

      // Reset & close
      setSelectedTemplate(null);
      setTemplateVariables({});
      setTemplateMediaUrl("");
      onOpenChange(false);
      onSent?.();
    } catch (err: any) {
      console.error("❌ Erro ao enviar template:", err);
      toast.error("Erro ao enviar template: " + (err.message || "Erro desconhecido"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>📋 Enviar Template para {contactName}</DialogTitle>
        </DialogHeader>

        <TemplateSelector
          companyId={companyId}
          selectedTemplate={selectedTemplate}
          onSelectTemplate={setSelectedTemplate}
          templateVariables={templateVariables}
          onVariablesChange={setTemplateVariables}
          mediaUrl={templateMediaUrl}
          onMediaUrlChange={setTemplateMediaUrl}
          disabled={sending}
        />

        {selectedTemplate && (
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleSend} disabled={sending} className="gap-2">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "Enviando..." : "Enviar Template"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
