import { CheckCircle2, Circle, ChevronDown, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type ApiProvider = "meta" | "evolution";

interface ApiProviderSelectorProps {
  current?: ApiProvider;
  available: { meta: boolean; evolution: boolean };
  onChange: (api: ApiProvider) => void;
  channel?: "whatsapp" | "instagram" | "facebook";
}

export function ApiProviderSelector({ current, available, onChange, channel = "whatsapp" }: ApiProviderSelectorProps) {
  // Apenas WhatsApp tem duas APIs. Instagram/Facebook sempre via Meta.
  if (channel !== "whatsapp") return null;

  const count = (available.meta ? 1 : 0) + (available.evolution ? 1 : 0);
  // Se só uma API estiver disponível, mostra apenas o badge informativo (não interativo).
  if (count < 2) {
    if (!current) return null;
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center justify-center h-8 w-8 rounded-md border border-border bg-background">
              {current === "meta" ? (
                <CheckCircle2 className="h-4 w-4 text-blue-500" />
              ) : (
                <Circle className="h-4 w-4 text-green-500 fill-green-500" />
              )}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {current === "meta" ? "WhatsApp Oficial (Meta API)" : "WhatsApp Não Oficial (Evolution API)"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  const label = current === "meta" ? "Oficial" : current === "evolution" ? "Não Oficial" : "Auto";
  const Icon = current === "meta" ? CheckCircle2 : Circle;
  const iconClass = current === "meta" ? "text-blue-500" : "text-green-500 fill-green-500";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 px-2" title="Selecionar API de envio">
          <Icon className={`h-3.5 w-3.5 ${iconClass}`} />
          <span className="text-xs font-medium hidden md:inline">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Enviar resposta via</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onChange("meta")} className="gap-2">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">WhatsApp Oficial</span>
            <span className="text-[10px] text-muted-foreground">Meta Cloud API</span>
          </div>
          {current === "meta" && <Check className="ml-auto h-4 w-4 text-primary" />}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("evolution")} className="gap-2">
          <Circle className="h-4 w-4 text-green-500 fill-green-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium">WhatsApp Não Oficial</span>
            <span className="text-[10px] text-muted-foreground">Evolution API</span>
          </div>
          {current === "evolution" && <Check className="ml-auto h-4 w-4 text-primary" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// import Check from lucide for the active indicator
import { Check } from "lucide-react";
