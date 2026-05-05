import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, BarChart3, TrendingUp, AlertTriangle, Info } from "lucide-react";
import { useProdutosServicos } from "@/hooks/useRevenueEngine";
import { classificarCurvaABC, type ProdutoABC } from "@/hooks/useDiagnostico360";
import { cn } from "@/lib/utils";

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(n || 0);

interface Props {
  value: ProdutoABC[];
  onChange: (next: ProdutoABC[]) => void;
}

export function CurvaABCEditor({ value, onChange }: Props) {
  const { data: produtosCadastro } = useProdutosServicos();
  const [novo, setNovo] = useState<ProdutoABC>({
    nome: "", receita_mensal: 0, custo_unitario: 0, qtd_vendas_mes: 0,
  });

  const classificados = useMemo(() => classificarCurvaABC(value), [value]);
  const totalReceita = classificados.reduce((s, p) => s + p.receita_mensal, 0);

  const addProduto = (p: ProdutoABC) => {
    if (!p.nome || !p.receita_mensal) return;
    onChange([...value, { ...p, id: crypto.randomUUID() }]);
    setNovo({ nome: "", receita_mensal: 0, custo_unitario: 0, qtd_vendas_mes: 0 });
  };

  const removeProduto = (id?: string) => {
    onChange(value.filter((p) => p.id !== id));
  };

  const addFromCadastro = (produtoId: string) => {
    const p = produtosCadastro?.find((x) => x.id === produtoId);
    if (!p) return;
    addProduto({
      produto_servico_id: p.id,
      nome: p.nome,
      receita_mensal: Number(p.preco_sugerido) || 0,
      custo_unitario: 0,
      qtd_vendas_mes: 1,
    });
  };

  // Resumos
  const grupoA = classificados.filter((p) => p.curva === "A");
  const grupoB = classificados.filter((p) => p.curva === "B");
  const grupoC = classificados.filter((p) => p.curva === "C");
  const pctA = grupoA.reduce((s, p) => s + (p.pct_receita || 0), 0);
  const pctB = grupoB.reduce((s, p) => s + (p.pct_receita || 0), 0);
  const pctC = grupoC.reduce((s, p) => s + (p.pct_receita || 0), 0);

  const concentracao = grupoA.length === 1 && pctA > 60;

  return (
    <div className="space-y-4 p-4 rounded-lg border-2 border-dashed bg-muted/20">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded bg-gradient-to-br from-cyan-500 to-blue-500 text-white">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <Label className="text-base font-semibold">Curva ABC — Concentração de receita</Label>
          <p className="text-xs text-muted-foreground">
            Liste seus produtos/serviços e a IA classifica em A (80% da receita), B (15%) e C (5%).
          </p>
        </div>
      </div>

      {/* Adicionar do cadastro */}
      {!!produtosCadastro?.length && (
        <div className="flex items-center gap-2">
          <Select onValueChange={addFromCadastro}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="+ Adicionar produto do cadastro" />
            </SelectTrigger>
            <SelectContent>
              {produtosCadastro.map((p: any) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome} {p.preco_sugerido ? `· ${fmt(Number(p.preco_sugerido))}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Lista de produtos */}
      {classificados.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground px-2">
            <div className="col-span-4">Produto</div>
            <div className="col-span-2 text-right">Receita/mês</div>
            <div className="col-span-2 text-right">Custo unit.</div>
            <div className="col-span-1 text-right">Qtd</div>
            <div className="col-span-2 text-right">% Receita</div>
            <div className="col-span-1 text-center">Curva</div>
          </div>
          {classificados.map((p) => (
            <div
              key={p.id}
              className={cn(
                "grid grid-cols-12 gap-2 items-center p-2 rounded-md border bg-background text-sm",
                p.curva === "A" && "border-emerald-500/40 bg-emerald-500/5",
                p.curva === "B" && "border-amber-500/40 bg-amber-500/5",
                p.curva === "C" && "border-slate-500/30",
              )}
            >
              <Input
                className="col-span-4 h-8"
                value={p.nome}
                onChange={(e) =>
                  onChange(value.map((x) => (x.id === p.id ? { ...x, nome: e.target.value } : x)))
                }
              />
              <Input
                type="number"
                className="col-span-2 h-8 text-right"
                value={p.receita_mensal || ""}
                onChange={(e) =>
                  onChange(
                    value.map((x) =>
                      x.id === p.id ? { ...x, receita_mensal: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
              <Input
                type="number"
                className="col-span-2 h-8 text-right"
                value={p.custo_unitario || ""}
                onChange={(e) =>
                  onChange(
                    value.map((x) =>
                      x.id === p.id ? { ...x, custo_unitario: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
              <Input
                type="number"
                className="col-span-1 h-8 text-right"
                value={p.qtd_vendas_mes || ""}
                onChange={(e) =>
                  onChange(
                    value.map((x) =>
                      x.id === p.id ? { ...x, qtd_vendas_mes: Number(e.target.value) || 0 } : x,
                    ),
                  )
                }
              />
              <div className="col-span-2 text-right text-xs">
                <span className="font-semibold">{(p.pct_receita || 0).toFixed(1)}%</span>
                <span className="text-muted-foreground"> · acum {(p.pct_acumulado || 0).toFixed(0)}%</span>
              </div>
              <div className="col-span-1 flex items-center justify-center gap-1">
                <Badge
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    p.curva === "A" && "bg-emerald-500 hover:bg-emerald-500",
                    p.curva === "B" && "bg-amber-500 hover:bg-amber-500",
                    p.curva === "C" && "bg-slate-500 hover:bg-slate-500",
                  )}
                >
                  {p.curva}
                </Badge>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => removeProduto(p.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Adicionar manual */}
      <div className="grid grid-cols-12 gap-2 items-end p-2 rounded-md border-2 border-dashed">
        <div className="col-span-4">
          <Label className="text-[11px]">Produto/Serviço</Label>
          <Input
            className="h-8"
            placeholder="Ex: Consultoria Premium"
            value={novo.nome}
            onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px]">Receita/mês (R$)</Label>
          <Input
            type="number"
            className="h-8 text-right"
            value={novo.receita_mensal || ""}
            onChange={(e) => setNovo({ ...novo, receita_mensal: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-2">
          <Label className="text-[11px]">Custo unit. (R$)</Label>
          <Input
            type="number"
            className="h-8 text-right"
            value={novo.custo_unitario || ""}
            onChange={(e) => setNovo({ ...novo, custo_unitario: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-1">
          <Label className="text-[11px]">Qtd</Label>
          <Input
            type="number"
            className="h-8 text-right"
            value={novo.qtd_vendas_mes || ""}
            onChange={(e) => setNovo({ ...novo, qtd_vendas_mes: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="col-span-3">
          <Button onClick={() => addProduto(novo)} size="sm" className="w-full gap-1">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
      </div>

      {/* Resumo ABC */}
      {classificados.length > 0 && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 rounded-lg border bg-emerald-500/5 border-emerald-500/30">
              <div className="text-xs text-muted-foreground">Curva A · {grupoA.length} produto(s)</div>
              <div className="text-lg font-bold text-emerald-600">{pctA.toFixed(0)}% da receita</div>
              <div className="text-[11px] text-muted-foreground">
                {fmt(grupoA.reduce((s, p) => s + p.receita_mensal, 0))}/mês
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-amber-500/5 border-amber-500/30">
              <div className="text-xs text-muted-foreground">Curva B · {grupoB.length} produto(s)</div>
              <div className="text-lg font-bold text-amber-600">{pctB.toFixed(0)}% da receita</div>
              <div className="text-[11px] text-muted-foreground">
                {fmt(grupoB.reduce((s, p) => s + p.receita_mensal, 0))}/mês
              </div>
            </div>
            <div className="p-3 rounded-lg border bg-slate-500/5 border-slate-500/30">
              <div className="text-xs text-muted-foreground">Curva C · {grupoC.length} produto(s)</div>
              <div className="text-lg font-bold text-slate-600">{pctC.toFixed(0)}% da receita</div>
              <div className="text-[11px] text-muted-foreground">
                {fmt(grupoC.reduce((s, p) => s + p.receita_mensal, 0))}/mês
              </div>
            </div>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Receita total mapeada: <span className="font-semibold text-foreground">{fmt(totalReceita)}/mês</span>
          </div>

          {concentracao && (
            <div className="flex items-start gap-2 p-2 rounded border border-rose-500/40 bg-rose-500/5 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>
                <strong>Risco de concentração:</strong> 1 único produto representa mais de 60% da
                receita. A IA vai sugerir diversificação no plano de ação.
              </span>
            </div>
          )}
        </div>
      )}

      {classificados.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-2 bg-muted/40 rounded">
          <Info className="h-3 w-3" />
          Opcional, mas recomendado: adicionar pelo menos 3 produtos para uma análise ABC útil.
        </div>
      )}
    </div>
  );
}
