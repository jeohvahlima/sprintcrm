import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { HardDrive, Trash2, Search, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface StorageAnalysis {
  totalFiles: number;
  totalSizeMB: number;
  orphanedFiles: number;
  orphanedSizeMB: number;
  referencedFiles: number;
  referencedSizeMB: number;
}

export function StorageCleanup() {
  const [analyzing, setAnalyzing] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [analysis, setAnalysis] = useState<StorageAnalysis | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cleanResult, setCleanResult] = useState<{ deletedCount: number; deletedSizeMB?: number } | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [scopeAll, setScopeAll] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single();
      if (data?.role === "super_admin") setIsSuperAdmin(true);
    })();
  }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysis(null);
    setCleanResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-storage", {
        body: { action: "analyze", scope: scopeAll ? "all" : "company" },
      });

      if (error) throw error;
      if (data?.analysis) {
        setAnalysis(data.analysis);
        if (data.analysis.orphanedFiles === 0) {
          toast.success("Armazenamento limpo! Nenhum arquivo órfão encontrado.");
        } else {
          toast.info(`${data.analysis.orphanedFiles} arquivos órfãos encontrados (${data.analysis.orphanedSizeMB} MB)`);
        }
      }
    } catch (error: any) {
      console.error("Erro ao analisar:", error);
      toast.error("Erro ao analisar armazenamento: " + (error.message || "Tente novamente"));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCleanup = async () => {
    setConfirmOpen(false);
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-storage", {
        body: { action: "cleanup", limit: 10000, scope: scopeAll ? "all" : "company" },
      });

      if (error) throw error;
      if (data) {
        setCleanResult({ deletedCount: data.deletedCount || 0, deletedSizeMB: data.deletedSizeMB });
        toast.success(`${data.deletedCount} arquivos removidos (${data.deletedSizeMB || 0} MB liberados)!`);
        setTimeout(handleAnalyze, 2000);
      }
    } catch (error: any) {
      console.error("Erro ao limpar:", error);
      toast.error("Erro na limpeza: " + (error.message || "Tente novamente"));
    } finally {
      setCleaning(false);
    }
  };

  const formatSize = (mb: number) => {
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
    return `${mb} MB`;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Gerenciamento de Armazenamento
          </CardTitle>
          <CardDescription>
            Analise e limpe arquivos órfãos que não são mais referenciados por conversas,
            liberando espaço no banco de dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Analysis Results */}
          {analysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <p className="text-xs text-muted-foreground mb-1">Total de Arquivos</p>
                <p className="text-lg font-bold">{analysis.totalFiles.toLocaleString()}</p>
                <Badge variant="outline">{formatSize(analysis.totalSizeMB)}</Badge>
              </div>
              <div className="p-3 rounded-lg border bg-green-500/10 border-green-500/20">
                <p className="text-xs text-muted-foreground mb-1">Arquivos em Uso</p>
                <p className="text-lg font-bold text-green-600">{analysis.referencedFiles.toLocaleString()}</p>
                <Badge variant="outline" className="border-green-500/30 text-green-600">
                  {formatSize(analysis.referencedSizeMB)}
                </Badge>
              </div>
              <div className="p-3 rounded-lg border bg-destructive/10 border-destructive/20">
                <p className="text-xs text-muted-foreground mb-1">Arquivos Órfãos</p>
                <p className="text-lg font-bold text-destructive">{analysis.orphanedFiles.toLocaleString()}</p>
                <Badge variant="destructive">
                  {formatSize(analysis.orphanedSizeMB)} para liberar
                </Badge>
              </div>
            </div>
          )}

          {analysis && analysis.orphanedFiles > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-muted-foreground">
                Foram encontrados <strong>{analysis.orphanedFiles.toLocaleString()}</strong> arquivos 
                ({formatSize(analysis.orphanedSizeMB)}) que não são referenciados por nenhuma conversa. 
                Esses arquivos podem ser removidos com segurança para liberar espaço.
              </p>
            </div>
          )}

          {cleanResult && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <span className="text-green-600 font-medium text-sm">
                ✅ {cleanResult.deletedCount.toLocaleString()} arquivos removidos com sucesso!
              </span>
            </div>
          )}

          {/* Progress */}
          {(analyzing || cleaning) && (
            <div className="space-y-2">
              <Progress value={undefined} className="h-2" />
              <p className="text-xs text-muted-foreground text-center">
                {analyzing ? "Analisando arquivos... Isso pode levar alguns minutos." : "Removendo arquivos órfãos..."}
              </p>
            </div>
          )}

          {/* Scope toggle for super admins */}
          {isSuperAdmin && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
              <div>
                <Label htmlFor="scope-all" className="text-sm font-medium">
                  Varrer TODAS as subcontas
                </Label>
                <p className="text-xs text-muted-foreground">
                  Quando ativado, analisa e limpa arquivos de todas as empresas (recomendado para liberar espaço total).
                </p>
              </div>
              <Switch
                id="scope-all"
                checked={scopeAll}
                onCheckedChange={setScopeAll}
                disabled={analyzing || cleaning}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={handleAnalyze}
              disabled={analyzing || cleaning}
            >
              <Search className="h-4 w-4 mr-2" />
              {analyzing ? "Analisando..." : "Analisar Armazenamento"}
            </Button>

            {analysis && analysis.orphanedFiles > 0 && (
              <Button
                variant="destructive"
                onClick={() => setConfirmOpen(true)}
                disabled={analyzing || cleaning}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {cleaning ? "Limpando..." : `Limpar ${analysis.orphanedFiles.toLocaleString()} Arquivos`}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Limpeza de Armazenamento</AlertDialogTitle>
            <AlertDialogDescription>
              Serão removidos <strong>{analysis?.orphanedFiles.toLocaleString()}</strong> arquivos órfãos 
              ({analysis ? formatSize(analysis.orphanedSizeMB) : ""}). 
              Esses arquivos NÃO são referenciados por nenhuma conversa. 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirmar Limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
