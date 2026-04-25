import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ExternalLink, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScriptsLibrary } from "@/components/ia/ScriptsLibrary";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Biblioteca de Scripts da Prospecção.
 *
 * Vinculada ao módulo "Processos Comerciais" — a fonte única dos scripts
 * de vendas e atendimento da empresa (tabela `ia_scripts`). Assim, qualquer
 * script criado/editado em Processos Comerciais aparece automaticamente aqui
 * e vice-versa, mantendo a cultura comercial sincronizada.
 */
export function ScriptLibrary({ open, onOpenChange }: Props) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Biblioteca de Scripts Comerciais
          </DialogTitle>
          <DialogDescription className="flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs">
              <Target className="h-3.5 w-3.5" />
              Sincronizado com o módulo <strong>Processos Comerciais</strong>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate("/processos");
              }}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Abrir Processos Comerciais
            </Button>
          </DialogDescription>
        </DialogHeader>

        <div className="pt-2">
          <ScriptsLibrary />
        </div>
      </DialogContent>
    </Dialog>
  );
}
