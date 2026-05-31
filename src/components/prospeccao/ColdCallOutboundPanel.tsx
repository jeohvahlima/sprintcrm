import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Sparkles, Phone, Clock3, ArrowRight } from "lucide-react";
import { ChannelProspectPanel } from "./channels/ChannelProspectPanel";
import { SDRQueuePanel } from "./comercial/SDRQueuePanel";

export function ColdCallOutboundPanel() {
  return (
    <div className="space-y-4">
      <Card className="border-border">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">📞 Funil de Prospecção — Cold Call</CardTitle>
            <CardDescription>
              Pipeline exclusivo para prospecção ativa por telefone · contatos priorizados pela IA.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm">🔍 Filtrar</Button>
            <Button size="sm">+ Novo lead</Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <div className="space-y-4">
          <Card className="border-border bg-blue-50">
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-600" /> IA detectou
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    Sua taxa de conexão está 8% abaixo do benchmark do setor. Melhor horário para ligar: terças 10h–12h e quintas 15h–17h.
                  </p>
                </div>
                <Badge className="bg-violet-100 text-violet-700">Insight IA</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[.18em] text-slate-500">Taxa de conexão</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">18%</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[.18em] text-slate-500">Conexões hoje</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">6</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="text-xs uppercase tracking-[.18em] text-slate-500">Conversão p/ reunião</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">9%</div>
                </div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-white p-4 text-sm text-slate-600">
                <div className="font-semibold text-slate-900">Gargalo identificado:</div>
                etapa "Conectou → Interesse" com queda de 50%. Revise o pitch e use o script sugerido pela IA para aumentar +12pp a taxa de interesse.
              </div>
            </CardContent>
          </Card>

          <ChannelProspectPanel channel="coldcall" />
        </div>

        <div className="space-y-4">
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">🎯 Meta de Cold Call</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Ligações</span>
                  <span className="font-semibold">36 / 200</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full w-[18%] bg-blue-600" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Conexões</span>
                  <span className="font-semibold">6 / 36</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full w-[17%] bg-amber-500" />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-600">
                  <span>Reuniões</span>
                  <span className="font-semibold text-emerald-700">4 / 40</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full w-[10%] bg-emerald-500" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base">📊 Resultado hoje</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4 text-center">
                <div className="text-sm text-slate-500">Ligações</div>
                <div className="mt-2 text-2xl font-bold">36</div>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4 text-center">
                <div className="text-sm text-amber-700">Conexões</div>
                <div className="mt-2 text-2xl font-bold text-amber-700">6</div>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4 text-center">
                <div className="text-sm text-emerald-700">Reuniões</div>
                <div className="mt-2 text-2xl font-bold text-emerald-700">4</div>
              </div>
              <div className="rounded-2xl bg-violet-50 p-4 text-center">
                <div className="text-sm text-violet-700">Propostas</div>
                <div className="mt-2 text-2xl font-bold text-violet-700">2</div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border bg-slate-50">
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-slate-900 font-semibold">
                <AlertTriangle className="h-4 w-4 text-amber-600" /> Dica de IA
              </div>
              <p className="text-sm text-slate-600">
                Com base nas suas últimas 36 ligações, o trigger de abertura “Você atende clínicas de médio porte?” tem 2x mais chance de manter o decisor na linha do que perguntas genéricas.
              </p>
              <Button variant="outline" className="w-full">
                Ver script recomendado <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <SDRQueuePanel />
    </div>
  );
}
