import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Scale, Plus, ChevronDown, Gavel, Calendar, DollarSign, Pencil, Upload, FileText, Trash2, Download, Video, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProcessosJuridicosPanelProps {
  leadId: string;
  companyId: string;
  telefoneContato?: string;
  nomeContato?: string;
}

interface LegalProcess {
  id: string;
  numero_processo: string | null;
  tipo: string;
  status: string;
  parte_contraria: string | null;
  vara: string | null;
  comarca: string | null;
  valor_causa: number | null;
  data_audiencia: string | null;
  data_distribuicao: string | null;
  audiencia_modalidade?: string | null;
  audiencia_local?: string | null;
  audiencia_sala?: string | null;
  audiencia_link?: string | null;
  audiencia_observacoes?: string | null;
  juiz?: string | null;
  forum_tribunal?: string | null;
  advogado_adversario?: string | null;
  oab_adversario?: string | null;
}

interface ProcessDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  document_type: string | null;
  description: string | null;
  created_at: string;
}

const DOCUMENT_TYPES: Record<string, string> = {
  peticao_inicial: "Petição Inicial",
  procuracao: "Procuração",
  contestacao: "Contestação",
  contrato: "Contrato",
  rg_cpf: "RG / CPF",
  comprovante_residencia: "Comprovante de Residência",
  comprovante_pagamento: "Comprovante de Pagamento",
  laudo_pericial: "Laudo Pericial",
  sentenca: "Sentença / Decisão",
  recurso: "Recurso",
  ata_audiencia: "Ata de Audiência",
  documento_pessoal: "Documento Pessoal",
  prova: "Prova / Evidência",
  outro: "Outro",
};

const AUDIENCIA_MODALIDADES: Record<string, string> = {
  presencial: "Presencial",
  virtual: "Virtual / Videoconferência",
  hibrida: "Híbrida",
};

const STATUS_COLORS: Record<string, string> = {
  pre_processual: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  protocolado: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  em_andamento: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  aguardando_citacao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  aguardando_contestacao: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  aguardando_audiencia: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  aguardando_pericia: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  aguardando_sentenca: "bg-orange-500/10 text-orange-600 border-orange-500/20",
  em_recurso: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  em_execucao: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  cumprimento_sentenca: "bg-fuchsia-500/10 text-fuchsia-600 border-fuchsia-500/20",
  acordo: "bg-teal-500/10 text-teal-600 border-teal-500/20",
  transito_julgado: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  suspenso: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  arquivado: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  extinto: "bg-zinc-500/10 text-zinc-600 border-zinc-500/20",
  ganho: "bg-green-500/10 text-green-600 border-green-500/20",
  perdido: "bg-red-500/10 text-red-600 border-red-500/20",
};

const STATUS_LABELS: Record<string, string> = {
  pre_processual: "Pré-Processual",
  protocolado: "Protocolado / Distribuído",
  em_andamento: "Em Andamento",
  aguardando_citacao: "Ag. Citação",
  aguardando_contestacao: "Ag. Contestação",
  aguardando_audiencia: "Ag. Audiência",
  aguardando_pericia: "Ag. Perícia",
  aguardando_sentenca: "Ag. Sentença",
  em_recurso: "Em Recurso",
  em_execucao: "Em Execução",
  cumprimento_sentenca: "Cumprimento de Sentença",
  acordo: "Acordo / Conciliação",
  transito_julgado: "Trânsito em Julgado",
  suspenso: "Suspenso",
  arquivado: "Arquivado",
  extinto: "Extinto",
  ganho: "Ganho",
  perdido: "Perdido",
};

const TIPO_LABELS: Record<string, string> = {
  civil: "Civil",
  trabalhista: "Trabalhista",
  criminal: "Criminal",
  tributario: "Tributário",
  administrativo: "Administrativo",
  comercial: "Comercial / Empresarial",
  previdenciario: "Previdenciário",
  familia: "Família e Sucessões",
  consumidor: "Direito do Consumidor",
  imobiliario: "Imobiliário",
  contratual: "Contratual",
  bancario: "Bancário / Financeiro",
  ambiental: "Ambiental",
  eleitoral: "Eleitoral",
  juizado_especial: "Juizado Especial (JEC)",
  execucao_fiscal: "Execução Fiscal",
  recuperacao_judicial: "Recuperação Judicial / Falência",
  arbitragem: "Arbitragem",
  regulatorio: "Regulatório / Concorrencial",
  internacional: "Internacional",
  militar: "Militar",
  outro: "Outro",
};

const EMPTY_FORM = {
  numero_processo: "",
  tipo: "civil",
  status: "em_andamento",
  vara: "",
  comarca: "",
  parte_contraria: "",
  valor_causa: "",
  data_audiencia: "",
  audiencia_modalidade: "presencial",
  audiencia_local: "",
  audiencia_sala: "",
  audiencia_link: "",
  audiencia_observacoes: "",
  juiz: "",
  forum_tribunal: "",
  advogado_adversario: "",
  oab_adversario: "",
};

export function ProcessosJuridicosPanel({ leadId, companyId, telefoneContato, nomeContato }: ProcessosJuridicosPanelProps) {
  const [processes, setProcesses] = useState<LegalProcess[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingProcess, setEditingProcess] = useState<LegalProcess | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [documents, setDocuments] = useState<ProcessDocument[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docType, setDocType] = useState<string>("peticao_inicial");
  const [docDescription, setDocDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (leadId) fetchProcesses();
  }, [leadId]);

  const fetchProcesses = async () => {
    const { data } = await supabase
      .from("legal_processes")
      .select("id, numero_processo, tipo, status, parte_contraria, vara, comarca, valor_causa, data_audiencia, data_distribuicao, audiencia_modalidade, audiencia_local, audiencia_sala, audiencia_link, audiencia_observacoes, juiz, forum_tribunal, advogado_adversario, oab_adversario")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });
    setProcesses((data as LegalProcess[]) || []);
  };

  const fetchDocuments = async (processId: string) => {
    const { data } = await supabase
      .from("legal_process_documents")
      .select("id, file_name, file_path, file_size, mime_type, document_type, description, created_at")
      .eq("legal_process_id", processId)
      .order("created_at", { ascending: false });
    setDocuments((data as ProcessDocument[]) || []);
  };

  const openCreateDialog = () => {
    setEditingProcess(null);
    setForm({ ...EMPTY_FORM });
    setDocuments([]);
    setDialogOpen(true);
  };

  const openEditDialog = (p: LegalProcess) => {
    setEditingProcess(p);
    setForm({
      numero_processo: p.numero_processo || "",
      tipo: p.tipo,
      status: p.status,
      vara: p.vara || "",
      comarca: p.comarca || "",
      parte_contraria: p.parte_contraria || "",
      valor_causa: p.valor_causa ? String(p.valor_causa) : "",
      data_audiencia: p.data_audiencia ? p.data_audiencia.slice(0, 16) : "",
      audiencia_modalidade: p.audiencia_modalidade || "presencial",
      audiencia_local: p.audiencia_local || "",
      audiencia_sala: p.audiencia_sala || "",
      audiencia_link: p.audiencia_link || "",
      audiencia_observacoes: p.audiencia_observacoes || "",
      juiz: p.juiz || "",
      forum_tribunal: p.forum_tribunal || "",
      advogado_adversario: p.advogado_adversario || "",
      oab_adversario: p.oab_adversario || "",
    });
    fetchDocuments(p.id);
    setDialogOpen(true);
  };

  const handleUploadDocument = async (file: File, processId: string) => {
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 25MB.");
      return;
    }
    setUploadingDoc(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${companyId}/${processId}/${Date.now()}_${safeName}`;

      const { error: upErr } = await supabase.storage
        .from('legal-documents')
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from('legal_process_documents').insert({
        legal_process_id: processId,
        company_id: companyId,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        document_type: docType,
        description: docDescription || null,
      });
      if (dbErr) throw dbErr;

      toast.success("Documento anexado!");
      setDocDescription("");
      fetchDocuments(processId);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Erro ao enviar documento");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownloadDocument = async (doc: ProcessDocument) => {
    const { data, error } = await supabase.storage
      .from('legal-documents')
      .createSignedUrl(doc.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download");
      return;
    }
    window.open(data.signedUrl, '_blank');
  };

  const handleDeleteDocument = async (doc: ProcessDocument) => {
    if (!confirm(`Remover o documento "${doc.file_name}"?`)) return;
    try {
      await supabase.storage.from('legal-documents').remove([doc.file_path]);
      await supabase.from('legal_process_documents').delete().eq('id', doc.id);
      toast.success("Documento removido");
      if (editingProcess) fetchDocuments(editingProcess.id);
    } catch {
      toast.error("Erro ao remover documento");
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const criarCompromissoAgenda = async (processId: string, dataAudiencia: string, userId: string) => {
    const dataHora = new Date(dataAudiencia);
    const dataHoraFim = new Date(dataHora.getTime() + 2 * 60 * 60 * 1000);

    const tipoLabel = TIPO_LABELS[form.tipo] || form.tipo;
    const modalidadeLabel = AUDIENCIA_MODALIDADES[form.audiencia_modalidade] || form.audiencia_modalidade;
    const titulo = `⚖️ Audiência - ${tipoLabel} - ${form.numero_processo}`;

    const obsLinhas = [
      `Processo: ${form.numero_processo}`,
      `Tipo: ${tipoLabel}`,
      form.audiencia_modalidade && `Modalidade: ${modalidadeLabel}`,
      form.audiencia_local && `Local: ${form.audiencia_local}`,
      form.audiencia_sala && `Sala: ${form.audiencia_sala}`,
      form.audiencia_link && `Link: ${form.audiencia_link}`,
      `Vara: ${form.vara || "N/A"}`,
      `Comarca: ${form.comarca || "N/A"}`,
      form.juiz && `Juiz(a): ${form.juiz}`,
      `Parte Contrária: ${form.parte_contraria || "N/A"}`,
      form.advogado_adversario && `Advogado Adversário: ${form.advogado_adversario}${form.oab_adversario ? ` (OAB ${form.oab_adversario})` : ''}`,
      form.audiencia_observacoes && `Obs: ${form.audiencia_observacoes}`,
    ].filter(Boolean).join('\n');

    const { data: compromisso, error } = await supabase.from("compromissos").insert({
      lead_id: leadId,
      usuario_responsavel_id: userId,
      owner_id: userId,
      company_id: companyId,
      data_hora_inicio: dataHora.toISOString(),
      data_hora_fim: dataHoraFim.toISOString(),
      tipo_servico: "Audiência",
      titulo: titulo,
      observacoes: obsLinhas,
      status: "agendado",
      legal_process_id: processId,
    }).select().single();

    if (error) {
      console.error("Erro ao criar compromisso:", error);
      toast.warning("Processo salvo, mas houve erro ao agendar na agenda");
      return null;
    }
    return compromisso;
  };

  const enviarConfirmacaoWhatsApp = async (dataAudiencia: string) => {
    if (!telefoneContato) return;

    const dataFormatada = format(new Date(dataAudiencia), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const tipoLabel = TIPO_LABELS[form.tipo] || form.tipo;

    const mensagem = `⚖️ *Confirmação de Audiência*\n\n` +
      `Olá${nomeContato ? `, ${nomeContato}` : ""}!\n\n` +
      `Informamos que sua audiência está agendada:\n\n` +
      `📋 *Processo:* ${form.numero_processo}\n` +
      `📌 *Tipo:* ${tipoLabel}\n` +
      (form.audiencia_modalidade ? `${form.audiencia_modalidade === 'virtual' ? '💻' : form.audiencia_modalidade === 'hibrida' ? '🔀' : '🏢'} *Modalidade:* ${AUDIENCIA_MODALIDADES[form.audiencia_modalidade] || form.audiencia_modalidade}\n` : '') +
      `🏛️ *Vara:* ${form.vara || "A definir"}\n` +
      `📍 *Comarca:* ${form.comarca || "A definir"}\n` +
      (form.audiencia_local ? `📌 *Local:* ${form.audiencia_local}\n` : '') +
      (form.audiencia_sala ? `🚪 *Sala:* ${form.audiencia_sala}\n` : '') +
      (form.audiencia_link ? `🔗 *Link da videoconferência:* ${form.audiencia_link}\n` : '') +
      `📅 *Data:* ${dataFormatada}\n` +
      (form.juiz ? `👨‍⚖️ *Juiz(a):* ${form.juiz}\n` : '') +
      (form.parte_contraria ? `👤 *Parte Contrária:* ${form.parte_contraria}\n` : "") +
      `\nPor favor, confirme sua presença. Qualquer dúvida, estamos à disposição.`;

    try {
      const { error } = await supabase.functions.invoke("enviar-whatsapp", {
        body: { company_id: companyId, numero: telefoneContato, mensagem },
      });
      if (error) {
        console.error("Erro ao enviar confirmação WhatsApp:", error);
        toast.warning("Processo salvo, mas houve erro ao enviar confirmação via WhatsApp");
      } else {
        toast.success("Confirmação de audiência enviada via WhatsApp!");
      }
    } catch (err) {
      console.error("Erro ao enviar WhatsApp:", err);
    }
  };

  const criarLembretesAudiencia = async (compromissoId: string, dataAudiencia: string) => {
    if (!telefoneContato) return;

    const dataHora = new Date(dataAudiencia);
    const tipoLabel = TIPO_LABELS[form.tipo] || form.tipo;
    const data1DiaAntes = new Date(dataHora);
    data1DiaAntes.setDate(data1DiaAntes.getDate() - 1);
    const data3DiasAntes = new Date(dataHora);
    data3DiasAntes.setDate(data3DiasAntes.getDate() - 3);

    const lembretes = [];
    const agora = new Date();

    if (data3DiasAntes > agora) {
      lembretes.push({
        compromisso_id: compromissoId, canal: "whatsapp", horas_antecedencia: 72,
        data_envio: data3DiasAntes.toISOString(), data_hora_envio: data3DiasAntes.toISOString(),
        proxima_data_envio: data3DiasAntes.toISOString(),
        mensagem: `⚖️ *Lembrete de Audiência (3 dias)*\n\nOlá${nomeContato ? `, ${nomeContato}` : ""}!\n\nLembramos que sua audiência do processo *${form.numero_processo}* (${tipoLabel}) está marcada para *${format(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}*.\n\n🏛️ Vara: ${form.vara || "A definir"}\n📍 Comarca: ${form.comarca || "A definir"}\n\nPrepare-se com antecedência!`,
        status_envio: "pendente", destinatario: "lead", telefone_responsavel: telefoneContato,
        company_id: companyId, ativo: true, tipo_lembrete: "antecipado", dias_antecedencia: 3, sequencia_envio: 1,
      });
    }

    if (data1DiaAntes > agora) {
      lembretes.push({
        compromisso_id: compromissoId, canal: "whatsapp", horas_antecedencia: 24,
        data_envio: data1DiaAntes.toISOString(), data_hora_envio: data1DiaAntes.toISOString(),
        proxima_data_envio: data1DiaAntes.toISOString(),
        mensagem: `⚖️ *Lembrete de Audiência (amanhã)*\n\nOlá${nomeContato ? `, ${nomeContato}` : ""}!\n\n⚠️ *Sua audiência é AMANHÃ!*\n\n📋 Processo: *${form.numero_processo}*\n📌 Tipo: ${tipoLabel}\n📅 Data: *${format(dataHora, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}*\n🏛️ Vara: ${form.vara || "A definir"}\n📍 Comarca: ${form.comarca || "A definir"}\n\nNão se esqueça de comparecer!`,
        status_envio: "pendente", destinatario: "lead", telefone_responsavel: telefoneContato,
        company_id: companyId, ativo: true, tipo_lembrete: "antecipado", dias_antecedencia: 1, sequencia_envio: 2,
      });
    }

    if (lembretes.length > 0) {
      const { error } = await supabase.from("lembretes").insert(lembretes);
      if (error) {
        console.error("Erro ao criar lembretes:", error);
        toast.warning("Audiência agendada, mas houve erro ao criar lembretes automáticos");
      } else {
        toast.success(`${lembretes.length} lembrete(s) automático(s) criado(s)!`);
      }
    }
  };

  const handleSave = async () => {
    if (!form.numero_processo.trim()) {
      toast.error("Informe o número do processo");
      return;
    }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      if (editingProcess) {
        // UPDATE
        const oldAudiencia = editingProcess.data_audiencia;
        const newAudiencia = form.data_audiencia || null;

        const { error } = await supabase
          .from("legal_processes")
          .update({
            numero_processo: form.numero_processo,
            tipo: form.tipo,
            status: form.status,
            vara: form.vara || null,
            comarca: form.comarca || null,
            parte_contraria: form.parte_contraria || null,
            valor_causa: form.valor_causa ? Number(form.valor_causa) : 0,
            data_audiencia: newAudiencia,
            audiencia_modalidade: form.audiencia_modalidade || null,
            audiencia_local: form.audiencia_local || null,
            audiencia_sala: form.audiencia_sala || null,
            audiencia_link: form.audiencia_link || null,
            audiencia_observacoes: form.audiencia_observacoes || null,
            juiz: form.juiz || null,
            forum_tribunal: form.forum_tribunal || null,
            advogado_adversario: form.advogado_adversario || null,
            oab_adversario: form.oab_adversario || null,
          })
          .eq("id", editingProcess.id);

        if (error) throw error;

        toast.success("Processo atualizado!");

        // Se audiência mudou e há nova data, criar compromisso
        if (newAudiencia && newAudiencia !== oldAudiencia) {
          const compromisso = await criarCompromissoAgenda(editingProcess.id, newAudiencia, user.id);
          await enviarConfirmacaoWhatsApp(newAudiencia);
          if (compromisso) {
            await criarLembretesAudiencia(compromisso.id, newAudiencia);
          }
        }
      } else {
        // CREATE
        const { data: processData, error } = await supabase.from("legal_processes").insert({
          company_id: companyId,
          lead_id: leadId,
          numero_processo: form.numero_processo,
          tipo: form.tipo,
          status: form.status,
          vara: form.vara || null,
          comarca: form.comarca || null,
          parte_contraria: form.parte_contraria || null,
          valor_causa: form.valor_causa ? Number(form.valor_causa) : 0,
          data_audiencia: form.data_audiencia || null,
          audiencia_modalidade: form.audiencia_modalidade || null,
          audiencia_local: form.audiencia_local || null,
          audiencia_sala: form.audiencia_sala || null,
          audiencia_link: form.audiencia_link || null,
          audiencia_observacoes: form.audiencia_observacoes || null,
          juiz: form.juiz || null,
          forum_tribunal: form.forum_tribunal || null,
          advogado_adversario: form.advogado_adversario || null,
          oab_adversario: form.oab_adversario || null,
        }).select().single();
        if (error) throw error;

        toast.success("Processo cadastrado!");

        if (form.data_audiencia && processData) {
          const compromisso = await criarCompromissoAgenda(processData.id, form.data_audiencia, user.id);
          await enviarConfirmacaoWhatsApp(form.data_audiencia);
          if (compromisso) {
            await criarLembretesAudiencia(compromisso.id, form.data_audiencia);
          }
        }
      }

      setDialogOpen(false);
      setEditingProcess(null);
      setForm({ ...EMPTY_FORM });
      fetchProcesses();
    } catch {
      toast.error(editingProcess ? "Erro ao atualizar processo" : "Erro ao cadastrar processo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent/50 transition">
          <div className="flex items-center gap-2">
            <Scale className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Processos Jurídicos</span>
            {processes.length > 0 && (
              <Badge variant="secondary" className="text-xs">{processes.length}</Badge>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2 space-y-2">
          {processes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum processo vinculado</p>
          ) : (
            processes.map(p => (
              <div
                key={p.id}
                className="p-2 rounded-lg border bg-card text-xs space-y-1 cursor-pointer hover:border-primary/40 transition group relative"
                onClick={() => openEditDialog(p)}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{p.numero_processo || "Sem número"}</span>
                  <div className="flex items-center gap-1">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[p.status] || ""}`}>
                      {STATUS_LABELS[p.status] || p.status}
                    </Badge>
                    <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Gavel className="h-3 w-3" />
                  <span>{TIPO_LABELS[p.tipo] || p.tipo}</span>
                  {p.parte_contraria && <span>• vs {p.parte_contraria}</span>}
                </div>
                {p.data_audiencia && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Calendar className="h-3 w-3" />
                    <span>Audiência: {format(new Date(p.data_audiencia), "dd/MM/yyyy", { locale: ptBR })}</span>
                  </div>
                )}
                {p.valor_causa && Number(p.valor_causa) > 0 && (
                  <div className="flex items-center gap-1 text-green-600">
                    <DollarSign className="h-3 w-3" />
                    <span>{new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(p.valor_causa))}</span>
                  </div>
                )}
              </div>
            ))
          )}
          <Button size="sm" variant="outline" className="w-full" onClick={openCreateDialog}>
            <Plus className="h-3 w-3 mr-1" />
            Novo Processo
          </Button>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingProcess(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5" />
              {editingProcess ? "Editar Processo Jurídico" : "Novo Processo Jurídico"}
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="processo" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="processo"><Gavel className="h-3.5 w-3.5 mr-1" /> Processo</TabsTrigger>
              <TabsTrigger value="audiencia"><Calendar className="h-3.5 w-3.5 mr-1" /> Audiência</TabsTrigger>
              <TabsTrigger value="documentos" disabled={!editingProcess}>
                <FileText className="h-3.5 w-3.5 mr-1" /> Documentos {documents.length > 0 && `(${documents.length})`}
              </TabsTrigger>
            </TabsList>

            {/* TAB PROCESSO */}
            <TabsContent value="processo" className="space-y-3 mt-4">
              <div>
                <Label>Nº do Processo (CNJ) *</Label>
                <Input value={form.numero_processo} onChange={e => setForm({ ...form, numero_processo: e.target.value })} placeholder="0000000-00.0000.0.00.0000" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TIPO_LABELS).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Vara</Label>
                  <Input value={form.vara} onChange={e => setForm({ ...form, vara: e.target.value })} placeholder="2ª Vara Cível" />
                </div>
                <div>
                  <Label>Comarca</Label>
                  <Input value={form.comarca} onChange={e => setForm({ ...form, comarca: e.target.value })} placeholder="São Paulo/SP" />
                </div>
              </div>
              <div>
                <Label>Fórum / Tribunal</Label>
                <Input value={form.forum_tribunal} onChange={e => setForm({ ...form, forum_tribunal: e.target.value })} placeholder="Fórum João Mendes Jr. / TJSP" />
              </div>
              <div>
                <Label>Parte Contrária</Label>
                <Input value={form.parte_contraria} onChange={e => setForm({ ...form, parte_contraria: e.target.value })} placeholder="Nome da parte contrária" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Advogado Adversário</Label>
                  <Input value={form.advogado_adversario} onChange={e => setForm({ ...form, advogado_adversario: e.target.value })} placeholder="Dr. Fulano de Tal" />
                </div>
                <div>
                  <Label>OAB Adversário</Label>
                  <Input value={form.oab_adversario} onChange={e => setForm({ ...form, oab_adversario: e.target.value })} placeholder="Ex: SP 123.456" />
                </div>
              </div>
              <div>
                <Label>Valor da Causa (R$)</Label>
                <Input type="number" value={form.valor_causa} onChange={e => setForm({ ...form, valor_causa: e.target.value })} placeholder="0,00" />
              </div>
            </TabsContent>

            {/* TAB AUDIÊNCIA */}
            <TabsContent value="audiencia" className="space-y-3 mt-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Data e Hora da Audiência</Label>
                  <Input type="datetime-local" value={form.data_audiencia} onChange={e => setForm({ ...form, data_audiencia: e.target.value })} />
                </div>
                <div>
                  <Label>Modalidade</Label>
                  <Select value={form.audiencia_modalidade} onValueChange={v => setForm({ ...form, audiencia_modalidade: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(AUDIENCIA_MODALIDADES).map(([v, l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {(form.audiencia_modalidade === 'presencial' || form.audiencia_modalidade === 'hibrida') && (
                <>
                  <div>
                    <Label className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Local / Endereço</Label>
                    <Input value={form.audiencia_local} onChange={e => setForm({ ...form, audiencia_local: e.target.value })} placeholder="Ex: Fórum Central, Av. Paulista 1000, 5º andar" />
                  </div>
                  <div>
                    <Label>Sala</Label>
                    <Input value={form.audiencia_sala} onChange={e => setForm({ ...form, audiencia_sala: e.target.value })} placeholder="Ex: Sala 504" />
                  </div>
                </>
              )}

              {(form.audiencia_modalidade === 'virtual' || form.audiencia_modalidade === 'hibrida') && (
                <div>
                  <Label className="flex items-center gap-1"><Video className="h-3 w-3" /> Link da Videoconferência</Label>
                  <Input value={form.audiencia_link} onChange={e => setForm({ ...form, audiencia_link: e.target.value })} placeholder="https://meet.google.com/... ou link do Teams/Zoom" />
                </div>
              )}

              <div>
                <Label>Juiz(a) Responsável</Label>
                <Input value={form.juiz} onChange={e => setForm({ ...form, juiz: e.target.value })} placeholder="Dr(a). Nome do juiz(a)" />
              </div>

              <div>
                <Label>Observações da Audiência</Label>
                <Textarea
                  value={form.audiencia_observacoes}
                  onChange={e => setForm({ ...form, audiencia_observacoes: e.target.value })}
                  placeholder="Levar testemunhas, documentos originais, instruções específicas..."
                  rows={3}
                />
              </div>

              {form.data_audiencia && !editingProcess && (
                <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs space-y-1">
                  <p className="font-medium text-amber-700">📅 Ao cadastrar com data de audiência:</p>
                  <ul className="text-amber-600 space-y-0.5 ml-3 list-disc">
                    <li>Compromisso será criado automaticamente na Agenda</li>
                    {telefoneContato && <li>Confirmação via WhatsApp com modalidade, local e link</li>}
                    {telefoneContato && <li>Lembretes automáticos (3 dias e 1 dia antes)</li>}
                    {!telefoneContato && <li className="text-muted-foreground">Sem telefone — confirmação e lembretes não serão enviados</li>}
                  </ul>
                </div>
              )}
              {form.data_audiencia && editingProcess && form.data_audiencia !== (editingProcess.data_audiencia?.slice(0, 16) || "") && (
                <div className="p-2 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs space-y-1">
                  <p className="font-medium text-amber-700">📅 Nova data de audiência detectada:</p>
                  <ul className="text-amber-600 space-y-0.5 ml-3 list-disc">
                    <li>Novo compromisso será criado na Agenda</li>
                    {telefoneContato && <li>Confirmação atualizada via WhatsApp</li>}
                    {telefoneContato && <li>Novos lembretes automáticos serão criados</li>}
                  </ul>
                </div>
              )}
            </TabsContent>

            {/* TAB DOCUMENTOS */}
            <TabsContent value="documentos" className="space-y-3 mt-4">
              {!editingProcess ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Salve o processo primeiro para anexar documentos.
                </p>
              ) : (
                <>
                  <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                    <p className="text-sm font-medium flex items-center gap-1"><Upload className="h-4 w-4" /> Anexar novo documento</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Tipo</Label>
                        <Select value={docType} onValueChange={setDocType}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(DOCUMENT_TYPES).map(([v, l]) => (
                              <SelectItem key={v} value={v}>{l}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Descrição (opcional)</Label>
                        <Input value={docDescription} onChange={e => setDocDescription(e.target.value)} placeholder="Breve descrição" />
                      </div>
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.heic,.xlsx,.xls,.txt"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f && editingProcess) handleUploadDocument(f, editingProcess.id);
                      }}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={uploadingDoc}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingDoc ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</> : <><Upload className="h-3 w-3 mr-1" /> Selecionar arquivo (até 25MB)</>}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {documents.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">Nenhum documento anexado</p>
                    ) : (
                      documents.map(doc => (
                        <div key={doc.id} className="flex items-center gap-2 p-2 rounded-lg border bg-card text-sm">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{doc.file_name}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                              {doc.document_type && <Badge variant="outline" className="text-[10px]">{DOCUMENT_TYPES[doc.document_type] || doc.document_type}</Badge>}
                              {doc.file_size && <span>{formatFileSize(doc.file_size)}</span>}
                              <span>{format(new Date(doc.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
                            </div>
                            {doc.description && <div className="text-xs text-muted-foreground italic mt-0.5">{doc.description}</div>}
                          </div>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDownloadDocument(doc)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteDocument(doc)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <Button className="w-full mt-4" onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : editingProcess ? "Salvar Alterações" : "Cadastrar Processo"}
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
