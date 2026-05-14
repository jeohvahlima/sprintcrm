/**
 * ✅ BACKUP ATUALIZADO - 2024-11-01
 * IMPORTANTE: Este componente usa o campo 'notes' do lead diretamente (NÃO usa tabela lead_comments)
 * Se este arquivo retroceder, verificar:
 * 1. Usa leads.notes em vez de lead_comments
 * 2. Aceita initialNotes como prop
 * 3. Salva comentários como JSON no campo notes
 */

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Trash2, User, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Comment {
  id: string;
  comment: string;
  created_at: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
}

interface LeadCommentsProps {
  leadId: string;
  initialNotes?: string | null;
  onCommentAdded?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideToggle?: boolean;
}

function generateId() {
  if (typeof crypto !== "undefined" && (crypto as any).randomUUID) {
    return (crypto as any).randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseComments(notes?: string | null): Comment[] {
  if (!notes) return [];
  try {
    const parsed = JSON.parse(notes);
    if (Array.isArray(parsed)) {
      return parsed.filter((c) => c && typeof c === "object" && c.comment);
    }
  } catch {
    // Se não for JSON válido, trata como texto simples (comentário histórico)
    // Limpar o texto de códigos JSON embutidos
    let cleanText = notes;
    
    // Remover blocos JSON do texto (ex: { "fonte": "...", ... })
    cleanText = cleanText.replace(/\s*---\s*\{[^}]+\}/g, '');
    cleanText = cleanText.replace(/\{[^}]*"fonte"[^}]*\}/g, '');
    cleanText = cleanText.replace(/\s*---\s*$/g, '');
    cleanText = cleanText.trim();
    
    // Separar múltiplos comentários por "---" se houver
    const parts = cleanText.split(/\s*---\s*/).filter(p => p.trim());
    
    if (parts.length > 1) {
      return parts.map((part, index) => {
        // Tentar extrair data/hora do formato "QUALIFICAÇÃO IA (DD/MM/YYYY, HH:MM:SS)"
        const dateMatch = part.match(/\((\d{2}\/\d{2}\/\d{4}),?\s*(\d{2}:\d{2}:\d{2})\)/);
        let createdAt = new Date().toISOString();
        let userName = "Histórico";
        let commentText = part.trim();
        
        if (dateMatch) {
          const [, datePart, timePart] = dateMatch;
          const [day, month, year] = datePart.split('/');
          createdAt = new Date(`${year}-${month}-${day}T${timePart}`).toISOString();
          
          // Verificar se é qualificação IA
          if (part.includes('QUALIFICAÇÃO IA')) {
            userName = "IA";
            commentText = part.replace(/QUALIFICAÇÃO IA\s*\([^)]+\)\s*/, '').trim();
          }
        }
        
        return {
          id: generateId(),
          comment: commentText || part.trim(),
          created_at: createdAt,
          user_id: "",
          user_name: userName,
          user_email: null,
        };
      });
    }
    
    // Comentário único
    if (cleanText) {
      return [{
        id: generateId(),
        comment: cleanText,
        created_at: new Date().toISOString(),
        user_id: "",
        user_name: "Histórico",
        user_email: null,
      }];
    }
  }
  return [];
}

export function LeadComments({ leadId, initialNotes, onCommentAdded, open, onOpenChange, hideToggle }: LeadCommentsProps) {
  const [comments, setComments] = useState<Comment[]>(() => parseComments(initialNotes));
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const showComments = open !== undefined ? open : internalOpen;
  const setShowComments = (v: boolean) => {
    if (onOpenChange) onOpenChange(v);
    else setInternalOpen(v);
  };

  useEffect(() => {
    setComments(parseComments(initialNotes));
  }, [initialNotes]);

  useEffect(() => {
    if (showComments) {
      loadComments();
    }
  }, [showComments, leadId]);

  // ✅ CRÍTICO: Carrega comentários do campo notes do lead (NÃO da tabela lead_comments)
  const loadComments = async () => {
    try {
      const { data, error } = await supabase
        .from("leads") // ✅ IMPORTANTE: Usa leads.notes diretamente
        .select("notes")
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      setComments(parseComments(data?.notes));
    } catch (error: any) {
      console.error("Erro ao carregar comentários:", error);
      toast.error(`Erro ao carregar comentários: ${error?.message || ''}`);
    }
  };

  // ✅ CRÍTICO: Salva comentários no campo notes como JSON (NÃO na tabela lead_comments)
  const persistComments = async (updated: Comment[]) => {
    // 🔒 Buscar lead para preservar company_id
    const { data: leadData } = await supabase
      .from("leads")
      .select("company_id")
      .eq("id", leadId)
      .single();

    const { error } = await supabase
      .from("leads") // ✅ IMPORTANTE: Atualiza leads.notes diretamente
      .update({ 
        notes: JSON.stringify(updated),
        company_id: leadData?.company_id // 🔒 Preservar company_id
      })
      .eq("id", leadId);
    if (error) throw error;
  };

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Usuário não autenticado");
        return;
      }

      // Buscar o nome completo do perfil
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", session.user.id)
        .maybeSingle();

      const userName = profile?.full_name || session.user.email?.split('@')[0] || "Usuário";
      
      const newEntry: Comment = {
        id: generateId(),
        comment: newComment.trim(),
        created_at: new Date().toISOString(),
        user_id: session.user.id,
        user_name: userName,
        user_email: session.user.email,
      };

      const updated = [newEntry, ...comments];
      await persistComments(updated);
      setComments(updated);
      setNewComment("");
      toast.success("Comentário adicionado");
      onCommentAdded?.();
    } catch (error: any) {
      console.error("Erro ao adicionar comentário:", error);
      toast.error(`Erro ao adicionar comentário: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      const updated = comments.filter((c) => c.id !== commentId);
      await persistComments(updated);
      setComments(updated);
      toast.success("Comentário removido");
      onCommentAdded?.();
    } catch (error: any) {
      console.error("Erro ao remover comentário:", error);
      toast.error(`Erro ao remover comentário: ${error?.message || 'Erro desconhecido'}`);
    }
  };

  return (
    <div className="w-full">
      {!hideToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-xs w-full justify-between"
        >
          <span className="flex items-center gap-2">
            <MessageCircle className="h-3 w-3" />
            Comentários ({comments.length})
          </span>
          {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      )}

      {showComments && (
        <div className="mt-2 space-y-3 border-t pt-3">
          <form onSubmit={addComment} className="flex gap-2">
            <Input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Digite seu comentário..."
              className="flex-1 text-foreground bg-background h-8 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={loading || !newComment.trim()}
              className="px-3 h-8"
            >
              <Send className="h-3 w-3" />
            </Button>
          </form>

          <ScrollArea className="max-h-48">
            <div className="flex flex-col gap-2 pr-2">
              {comments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3">
                  Nenhum comentário ainda
                </p>
              ) : (
                comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2 p-2 bg-muted/50 rounded-md">
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-3 w-3 text-primary" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-medium text-foreground">
                          {comment.user_name || "Usuário"}
                        </span>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(comment.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      <p className="text-xs text-foreground break-words whitespace-pre-wrap">
                        {comment.comment}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 flex-shrink-0 hover:bg-destructive/10"
                      onClick={() => deleteComment(comment.id)}
                    >
                      <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
