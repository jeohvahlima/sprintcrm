import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Calculator, DollarSign, Percent, TrendingUp, Briefcase, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isNaN(v) ? 0 : v);

const num = (v: string | number) => {
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? 0 : n;
};

// Taxas mensais médias aproximadas (configurável). Idealmente vir de API/BCB.
const TAXAS_MENSAIS: Record<string, number> = {
  selic: 0.0095, // ~0.95% a.m.
  ipca: 0.0035,
  inpc: 0.0033,
  tr: 0.0005,
  poupanca: 0.0055,
  igpm: 0.0040,
};

// Custas aproximadas por UF (% sobre valor da causa). Editável pelo usuário.
const CUSTAS_UF: Record<string, { taxa: number; minimo: number; teto: number }> = {
  SP: { taxa: 0.01, minimo: 119.36, teto: 119362.50 },
  RJ: { taxa: 0.02, minimo: 67.30, teto: 67300.00 },
  MG: { taxa: 0.02, minimo: 134.60, teto: 134600.00 },
  RS: { taxa: 0.02, minimo: 99.30, teto: 99300.00 },
  PR: { taxa: 0.018, minimo: 110.00, teto: 110000.00 },
  BA: { taxa: 0.015, minimo: 90.00, teto: 90000.00 },
  SC: { taxa: 0.015, minimo: 95.00, teto: 95000.00 },
  GO: { taxa: 0.015, minimo: 80.00, teto: 80000.00 },
  PE: { taxa: 0.015, minimo: 75.00, teto: 75000.00 },
  CE: { taxa: 0.015, minimo: 70.00, teto: 70000.00 },
  DF: { taxa: 0.015, minimo: 100.00, teto: 100000.00 },
};

interface Props {
  companyId: string | null;
  legalProcessId?: string;
}

export default function CalculadoraProcessos({ companyId, legalProcessId }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          Calculadora de Processos
        </CardTitle>
        <CardDescription>
          Honorários, custas processuais, correção monetária e cálculo trabalhista
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="honorarios" className="space-y-4">
          <TabsList className="grid grid-cols-2 lg:grid-cols-4 h-auto">
            <TabsTrigger value="honorarios" className="gap-2">
              <Percent className="h-4 w-4" /> Honorários
            </TabsTrigger>
            <TabsTrigger value="custas" className="gap-2">
              <DollarSign className="h-4 w-4" /> Custas
            </TabsTrigger>
            <TabsTrigger value="correcao" className="gap-2">
              <TrendingUp className="h-4 w-4" /> Correção
            </TabsTrigger>
            <TabsTrigger value="trabalhista" className="gap-2">
              <Briefcase className="h-4 w-4" /> Trabalhista
            </TabsTrigger>
          </TabsList>

          <TabsContent value="honorarios">
            <CalcHonorarios companyId={companyId} legalProcessId={legalProcessId} />
          </TabsContent>
          <TabsContent value="custas">
            <CalcCustas companyId={companyId} legalProcessId={legalProcessId} />
          </TabsContent>
          <TabsContent value="correcao">
            <CalcCorrecao companyId={companyId} legalProcessId={legalProcessId} />
          </TabsContent>
          <TabsContent value="trabalhista">
            <CalcTrabalhista companyId={companyId} legalProcessId={legalProcessId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// ── Salvar histórico ──
async function saveCalculation(
  companyId: string | null,
  legalProcessId: string | undefined,
  tipo: string,
  descricao: string,
  inputs: any,
  resultado: any,
  valor_total: number,
) {
  if (!companyId) return;
  const { error } = await supabase.from("legal_calculations").insert({
    company_id: companyId,
    legal_process_id: legalProcessId || null,
    tipo,
    descricao,
    inputs,
    resultado,
    valor_total,
  });
  if (error) toast.error("Erro ao salvar: " + error.message);
  else toast.success("Cálculo salvo no histórico");
}

// =================== HONORÁRIOS ===================
function CalcHonorarios({ companyId, legalProcessId }: Props) {
  const [valorCausa, setValorCausa] = useState("0,00");
  const [modalidade, setModalidade] = useState<"percentual" | "fixo" | "exito" | "sucumbencia">("percentual");
  const [percentual, setPercentual] = useState("20");
  const [valorFixo, setValorFixo] = useState("0,00");
  const [valorExito, setValorExito] = useState("0,00");
  const [percExito, setPercExito] = useState("30");
  const [percSucumbencia, setPercSucumbencia] = useState("15");

  const result = useMemo(() => {
    const causa = num(valorCausa);
    switch (modalidade) {
      case "percentual":
        return { honorarios: causa * (num(percentual) / 100), detalhe: `${percentual}% sobre ${fmtBRL(causa)}` };
      case "fixo":
        return { honorarios: num(valorFixo), detalhe: "Valor fixo contratual" };
      case "exito":
        return {
          honorarios: num(valorExito) * (num(percExito) / 100),
          detalhe: `${percExito}% sobre êxito de ${fmtBRL(num(valorExito))}`,
        };
      case "sucumbencia":
        return {
          honorarios: causa * (num(percSucumbencia) / 100),
          detalhe: `${percSucumbencia}% (sucumbenciais — art. 85 §2º CPC)`,
        };
    }
  }, [valorCausa, modalidade, percentual, valorFixo, valorExito, percExito, percSucumbencia]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Modalidade</Label>
          <Select value={modalidade} onValueChange={(v: any) => setModalidade(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percentual">Contratual (% sobre causa)</SelectItem>
              <SelectItem value="fixo">Valor fixo</SelectItem>
              <SelectItem value="exito">Êxito (% sobre ganho)</SelectItem>
              <SelectItem value="sucumbencia">Sucumbenciais (CPC art. 85)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(modalidade === "percentual" || modalidade === "sucumbencia") && (
          <div>
            <Label>Valor da Causa (R$)</Label>
            <Input value={valorCausa} onChange={(e) => setValorCausa(e.target.value)} placeholder="0,00" />
          </div>
        )}

        {modalidade === "percentual" && (
          <div>
            <Label>Percentual (%)</Label>
            <Input value={percentual} onChange={(e) => setPercentual(e.target.value)} type="number" />
          </div>
        )}

        {modalidade === "fixo" && (
          <div>
            <Label>Valor Fixo (R$)</Label>
            <Input value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} placeholder="0,00" />
          </div>
        )}

        {modalidade === "exito" && (
          <>
            <div>
              <Label>Valor obtido em êxito (R$)</Label>
              <Input value={valorExito} onChange={(e) => setValorExito(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>Percentual de êxito (%)</Label>
              <Input value={percExito} onChange={(e) => setPercExito(e.target.value)} type="number" />
            </div>
          </>
        )}

        {modalidade === "sucumbencia" && (
          <div>
            <Label>Percentual sucumbencial (10–20%)</Label>
            <Input value={percSucumbencia} onChange={(e) => setPercSucumbencia(e.target.value)} type="number" />
          </div>
        )}
      </div>

      <Separator />

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
        <div className="text-xs text-muted-foreground">{result.detalhe}</div>
        <div className="text-3xl font-bold text-primary">{fmtBRL(result.honorarios)}</div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            saveCalculation(
              companyId,
              legalProcessId,
              "honorarios",
              `Honorários ${modalidade}`,
              { valorCausa, modalidade, percentual, valorFixo, valorExito, percExito, percSucumbencia },
              result,
              result.honorarios,
            )
          }
        >
          <Save className="h-3 w-3 mr-1" /> Salvar no histórico
        </Button>
      </div>
    </div>
  );
}

// =================== CUSTAS ===================
function CalcCustas({ companyId, legalProcessId }: Props) {
  const [uf, setUf] = useState("SP");
  const [valorCausa, setValorCausa] = useState("0,00");
  const [taxaJudiciaria, setTaxaJudiciaria] = useState("");
  const [usarTaxaCustomizada, setUsarTaxaCustomizada] = useState(false);

  const result = useMemo(() => {
    const cfg = CUSTAS_UF[uf];
    const causa = num(valorCausa);
    const taxa = usarTaxaCustomizada ? num(taxaJudiciaria) / 100 : cfg.taxa;
    let custas = causa * taxa;
    if (custas < cfg.minimo) custas = cfg.minimo;
    if (custas > cfg.teto) custas = cfg.teto;
    const distribuicao = custas * 0.5; // estimativa: 50% no protocolo
    const finais = custas * 0.5;
    return { custas, distribuicao, finais, taxa };
  }, [uf, valorCausa, taxaJudiciaria, usarTaxaCustomizada]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>UF / Tribunal</Label>
          <Select value={uf} onValueChange={setUf}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.keys(CUSTAS_UF).map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Valor da Causa (R$)</Label>
          <Input value={valorCausa} onChange={(e) => setValorCausa(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label>Taxa estimada</Label>
          <div className="text-sm h-10 flex items-center text-muted-foreground">
            {(result.taxa * 100).toFixed(2)}% • mín {fmtBRL(CUSTAS_UF[uf].minimo)}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={usarTaxaCustomizada} onCheckedChange={setUsarTaxaCustomizada} />
        <Label className="text-sm">Usar taxa customizada</Label>
        {usarTaxaCustomizada && (
          <Input
            className="w-24 ml-2"
            value={taxaJudiciaria}
            onChange={(e) => setTaxaJudiciaria(e.target.value)}
            placeholder="2.0"
          />
        )}
      </div>

      <Separator />

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Distribuição</div>
          <div className="text-lg font-semibold">{fmtBRL(result.distribuicao)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Custas finais</div>
          <div className="text-lg font-semibold">{fmtBRL(result.finais)}</div>
        </div>
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
          <div className="text-xs text-muted-foreground">Total</div>
          <div className="text-lg font-bold text-primary">{fmtBRL(result.custas)}</div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ Valores estimados. Consulte a tabela oficial do TJ-{uf} para o cálculo exato (UPF/UFESP/UFEMG vigente).
      </p>

      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          saveCalculation(
            companyId,
            legalProcessId,
            "custas",
            `Custas TJ-${uf}`,
            { uf, valorCausa, taxaJudiciaria, usarTaxaCustomizada },
            result,
            result.custas,
          )
        }
      >
        <Save className="h-3 w-3 mr-1" /> Salvar no histórico
      </Button>
    </div>
  );
}

// =================== CORREÇÃO MONETÁRIA + JUROS ===================
function CalcCorrecao({ companyId, legalProcessId }: Props) {
  const [valor, setValor] = useState("0,00");
  const [dataInicial, setDataInicial] = useState(new Date().toISOString().slice(0, 10));
  const [dataFinal, setDataFinal] = useState(new Date().toISOString().slice(0, 10));
  const [indice, setIndice] = useState("selic");
  const [jurosMora, setJurosMora] = useState("1");
  const [aplicarJuros, setAplicarJuros] = useState(true);

  const result = useMemo(() => {
    const v = num(valor);
    const di = new Date(dataInicial);
    const df = new Date(dataFinal);
    const meses = Math.max(0, (df.getFullYear() - di.getFullYear()) * 12 + (df.getMonth() - di.getMonth()));
    const taxaMensal = TAXAS_MENSAIS[indice] ?? 0;
    // Juros compostos do índice
    const fatorIndice = Math.pow(1 + taxaMensal, meses);
    const valorCorrigido = v * fatorIndice;
    const juros = aplicarJuros ? v * (num(jurosMora) / 100) * meses : 0; // juros simples 1% a.m.
    const total = valorCorrigido + juros;
    return { meses, taxaMensal, valorCorrigido, juros, total };
  }, [valor, dataInicial, dataFinal, indice, jurosMora, aplicarJuros]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Valor original (R$)</Label>
          <Input value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label>Índice de correção</Label>
          <Select value={indice} onValueChange={setIndice}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="selic">SELIC (~0,95% a.m.)</SelectItem>
              <SelectItem value="ipca">IPCA (~0,35% a.m.)</SelectItem>
              <SelectItem value="inpc">INPC (~0,33% a.m.)</SelectItem>
              <SelectItem value="igpm">IGP-M (~0,40% a.m.)</SelectItem>
              <SelectItem value="poupanca">Poupança (~0,55% a.m.)</SelectItem>
              <SelectItem value="tr">TR (~0,05% a.m.)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data inicial</Label>
          <Input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} />
        </div>
        <div>
          <Label>Data final</Label>
          <Input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border p-3">
        <Switch checked={aplicarJuros} onCheckedChange={setAplicarJuros} />
        <Label>Juros de mora</Label>
        <Input
          className="w-24"
          value={jurosMora}
          onChange={(e) => setJurosMora(e.target.value)}
          disabled={!aplicarJuros}
        />
        <span className="text-sm text-muted-foreground">% a.m. (simples — art. 406 CC)</span>
      </div>

      <Separator />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Período</div>
          <div className="text-lg font-semibold">{result.meses} meses</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Valor corrigido</div>
          <div className="text-lg font-semibold">{fmtBRL(result.valorCorrigido)}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">+ Juros de mora</div>
          <div className="text-lg font-semibold">{fmtBRL(result.juros)}</div>
        </div>
      </div>

      <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
        <div className="text-xs text-muted-foreground">Valor atualizado total</div>
        <div className="text-3xl font-bold text-primary">{fmtBRL(result.total)}</div>
      </div>

      <p className="text-xs text-muted-foreground">
        ⚠️ Taxas médias estimadas. Para cálculos oficiais use as tabelas BCB/IBGE/CJF do período.
      </p>

      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          saveCalculation(
            companyId,
            legalProcessId,
            "correcao",
            `Correção ${indice.toUpperCase()} ${dataInicial} → ${dataFinal}`,
            { valor, dataInicial, dataFinal, indice, jurosMora, aplicarJuros },
            result,
            result.total,
          )
        }
      >
        <Save className="h-3 w-3 mr-1" /> Salvar no histórico
      </Button>
    </div>
  );
}

// =================== TRABALHISTA ===================
function CalcTrabalhista({ companyId, legalProcessId }: Props) {
  const [salario, setSalario] = useState("0,00");
  const [admissao, setAdmissao] = useState("");
  const [demissao, setDemissao] = useState(new Date().toISOString().slice(0, 10));
  const [tipoRescisao, setTipoRescisao] = useState<"sem_justa_causa" | "justa_causa" | "pedido" | "acordo">("sem_justa_causa");
  const [horasExtras, setHorasExtras] = useState("0");
  const [adicionalNoturno, setAdicionalNoturno] = useState(false);
  const [feriasVencidas, setFeriasVencidas] = useState(false);

  const result = useMemo(() => {
    const sal = num(salario);
    if (!admissao || sal <= 0) return null;
    const adm = new Date(admissao);
    const dem = new Date(demissao);
    const meses = Math.max(0, (dem.getFullYear() - adm.getFullYear()) * 12 + (dem.getMonth() - adm.getMonth()));
    const anos = meses / 12;

    // Saldo de salário (proporcional aos dias trabalhados no mês da demissão)
    const diasMes = dem.getDate();
    const saldo = (sal / 30) * diasMes;

    // Aviso prévio (30 dias + 3 dias por ano)
    const diasAviso = tipoRescisao === "sem_justa_causa" || tipoRescisao === "acordo"
      ? Math.min(90, 30 + Math.floor(anos) * 3)
      : 0;
    const avisoPrevio = (sal / 30) * diasAviso;

    // 13º proporcional (meses trabalhados no ano / 12)
    const mesNo13 = dem.getMonth() + 1; // qtd de meses do ano até a demissão
    const decimoTerceiro = (sal / 12) * mesNo13;

    // Férias proporcionais (1/12 por mês trabalhado no período aquisitivo) + 1/3
    const mesesFerias = mesNo13;
    const feriasProporc = ((sal / 12) * mesesFerias) * (4 / 3); // já com 1/3
    const feriasVencidasV = feriasVencidas ? sal * (4 / 3) : 0;

    // Horas extras (50% sobre hora normal — hora = salário/220)
    const valorHora = sal / 220;
    const valorHoraExtra = valorHora * 1.5;
    const heTotal = num(horasExtras) * valorHoraExtra;
    const adNoturno = adicionalNoturno ? sal * 0.2 : 0;

    // FGTS (8% sobre salário durante todo o vínculo) + multa 40%
    const fgtsTotal = sal * 0.08 * meses;
    const multaFgts = tipoRescisao === "sem_justa_causa" ? fgtsTotal * 0.4
      : tipoRescisao === "acordo" ? fgtsTotal * 0.2 : 0;

    // Multa art. 477 CLT (1 salário se atrasar pagamento)
    // — não inclusa por padrão

    let total = saldo + decimoTerceiro + feriasProporc + feriasVencidasV + heTotal + adNoturno;
    if (tipoRescisao === "sem_justa_causa") total += avisoPrevio + multaFgts;
    if (tipoRescisao === "acordo") total += avisoPrevio * 0.5 + multaFgts;

    return {
      meses, anos: anos.toFixed(2),
      saldo, avisoPrevio, decimoTerceiro, feriasProporc, feriasVencidasV,
      heTotal, adNoturno, fgtsTotal, multaFgts, total,
    };
  }, [salario, admissao, demissao, tipoRescisao, horasExtras, adicionalNoturno, feriasVencidas]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Último salário (R$)</Label>
          <Input value={salario} onChange={(e) => setSalario(e.target.value)} placeholder="0,00" />
        </div>
        <div>
          <Label>Tipo de rescisão</Label>
          <Select value={tipoRescisao} onValueChange={(v: any) => setTipoRescisao(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sem_justa_causa">Sem justa causa (empregador)</SelectItem>
              <SelectItem value="justa_causa">Com justa causa</SelectItem>
              <SelectItem value="pedido">Pedido de demissão</SelectItem>
              <SelectItem value="acordo">Acordo (art. 484-A CLT)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Data de admissão</Label>
          <Input type="date" value={admissao} onChange={(e) => setAdmissao(e.target.value)} />
        </div>
        <div>
          <Label>Data de demissão</Label>
          <Input type="date" value={demissao} onChange={(e) => setDemissao(e.target.value)} />
        </div>
        <div>
          <Label>Horas extras (qtd no contrato)</Label>
          <Input value={horasExtras} onChange={(e) => setHorasExtras(e.target.value)} type="number" />
        </div>
        <div className="flex flex-col gap-2 justify-center">
          <div className="flex items-center gap-2">
            <Switch checked={adicionalNoturno} onCheckedChange={setAdicionalNoturno} />
            <Label className="text-sm">Adicional noturno (20%)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={feriasVencidas} onCheckedChange={setFeriasVencidas} />
            <Label className="text-sm">Férias vencidas em aberto</Label>
          </div>
        </div>
      </div>

      <Separator />

      {result && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
            <Linha label="Saldo de salário" value={result.saldo} />
            {tipoRescisao === "sem_justa_causa" && <Linha label="Aviso prévio" value={result.avisoPrevio} />}
            {tipoRescisao === "acordo" && <Linha label="Aviso prévio (50%)" value={result.avisoPrevio * 0.5} />}
            <Linha label="13º proporcional" value={result.decimoTerceiro} />
            <Linha label="Férias proporc. + 1/3" value={result.feriasProporc} />
            {feriasVencidas && <Linha label="Férias vencidas + 1/3" value={result.feriasVencidasV} />}
            {num(horasExtras) > 0 && <Linha label="Horas extras (50%)" value={result.heTotal} />}
            {adicionalNoturno && <Linha label="Adic. noturno" value={result.adNoturno} />}
            {(tipoRescisao === "sem_justa_causa" || tipoRescisao === "acordo") && (
              <Linha label={`Multa FGTS (${tipoRescisao === "acordo" ? "20%" : "40%"})`} value={result.multaFgts} />
            )}
            <Linha label="FGTS depositado (estimado)" value={result.fgtsTotal} info />
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4">
            <div className="text-xs text-muted-foreground">Total a receber (verbas rescisórias)</div>
            <div className="text-3xl font-bold text-primary">{fmtBRL(result.total)}</div>
            <div className="text-xs text-muted-foreground mt-1">
              Vínculo: {result.meses} meses ({result.anos} anos)
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              saveCalculation(
                companyId,
                legalProcessId,
                "trabalhista",
                `Rescisão ${tipoRescisao}`,
                { salario, admissao, demissao, tipoRescisao, horasExtras, adicionalNoturno, feriasVencidas },
                result,
                result.total,
              )
            }
          >
            <Save className="h-3 w-3 mr-1" /> Salvar no histórico
          </Button>
        </>
      )}

      {!result && (
        <p className="text-sm text-muted-foreground text-center py-6">
          Preencha o salário e a data de admissão para calcular.
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        ⚠️ Cálculo estimativo. Não substitui análise jurídica detalhada de horas, adicionais, comissões e CCT/ACT específicos.
      </p>
    </div>
  );
}

function Linha({ label, value, info }: { label: string; value: number; info?: boolean }) {
  return (
    <div className={`flex justify-between rounded border p-2 ${info ? "bg-muted/30" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{fmtBRL(value)}</span>
    </div>
  );
}
