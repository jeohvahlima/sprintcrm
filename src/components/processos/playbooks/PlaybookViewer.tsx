import { useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, X, Copy, Loader2, FileText } from "lucide-react";
import { CommercialPlaybook } from "@/hooks/useCommercialPlaybooks";
import { toast } from "sonner";

interface Props {
  playbook: CommercialPlaybook | null;
  open: boolean;
  onClose: () => void;
  onDuplicate?: (p: CommercialPlaybook) => void;
  canDuplicate?: boolean;
}

export function PlaybookViewer({ playbook, open, onClose, onDuplicate, canDuplicate }: Props) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (!playbook) return null;
  const accent = playbook.accent_color || "#22C55E";

  const handleExportPDF = async () => {
    if (!contentRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const node = contentRef.current;
      const canvas = await html2canvas(node, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: node.scrollWidth,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;

      while (heightLeft > 0) {
        position -= pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;
      }

      pdf.save(`${playbook.title.replace(/[^\w\s-]/g, "")}.pdf`);
      toast.success("PDF gerado!");
    } catch (e: any) {
      toast.error("Erro ao gerar PDF: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-background sticky top-0 z-10">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-2xl">{playbook.cover_emoji || "📘"}</span>
            <div className="min-w-0">
              <p className="font-semibold truncate text-sm">{playbook.title}</p>
              <p className="text-xs text-muted-foreground">
                {playbook.is_global ? "Modelo oficial" : "Cópia da empresa"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canDuplicate && playbook.is_global && onDuplicate && (
              <Button size="sm" variant="outline" onClick={() => onDuplicate(playbook)}>
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar e editar
              </Button>
            )}
            <Button size="sm" variant="default" onClick={handleExportPDF} disabled={exporting}>
              {exporting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5 mr-1" />
              )}
              Exportar PDF
            </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Conteúdo da revista */}
        <div className="flex-1 overflow-y-auto bg-muted/30">
          <div
            ref={contentRef}
            className="mx-auto bg-white text-slate-900"
            style={{ maxWidth: "820px", width: "100%" }}
          >
            {playbook.sections.map((section, i) => (
              <SectionRenderer key={i} section={section} accent={accent} playbook={playbook} />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionRenderer({
  section,
  accent,
  playbook,
}: {
  section: any;
  accent: string;
  playbook: CommercialPlaybook;
}) {
  switch (section.type) {
    case "hero":
      return (
        <div
          className="relative px-12 py-20 text-white overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${accent}, ${shade(accent, -25)})`,
          }}
        >
          <div className="absolute -right-20 -top-20 w-80 h-80 rounded-full opacity-20 bg-white" />
          <div className="absolute -left-10 -bottom-10 w-60 h-60 rounded-full opacity-10 bg-white" />
          <div className="relative">
            <div className="text-7xl mb-6">{playbook.cover_emoji || "📘"}</div>
            {section.badge && (
              <Badge className="bg-white/20 text-white border-white/30 backdrop-blur mb-4">
                {section.badge}
              </Badge>
            )}
            <h1 className="text-5xl font-bold leading-tight mb-3">{section.title}</h1>
            {section.subtitle && (
              <p className="text-xl text-white/90 max-w-2xl">{section.subtitle}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-6">
              {playbook.estimated_time && (
                <Badge variant="outline" className="bg-white/10 text-white border-white/30">
                  ⏱ {playbook.estimated_time}
                </Badge>
              )}
              {playbook.difficulty && (
                <Badge variant="outline" className="bg-white/10 text-white border-white/30 capitalize">
                  📊 {playbook.difficulty}
                </Badge>
              )}
            </div>
          </div>
        </div>
      );

    case "intro":
      return (
        <div className="px-12 py-12 border-b">
          <h2 className="text-3xl font-bold mb-4" style={{ color: accent }}>
            {section.title}
          </h2>
          <p className="text-lg text-slate-700 leading-relaxed whitespace-pre-line">
            {section.content}
          </p>
        </div>
      );

    case "section_divider":
      return (
        <div
          className="px-12 py-6 my-0"
          style={{
            background: `linear-gradient(90deg, ${section.color || accent}, ${shade(section.color || accent, -20)})`,
          }}
        >
          <h2 className="text-2xl font-bold text-white tracking-wide uppercase">
            {section.title}
          </h2>
        </div>
      );

    case "benefits":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="p-5 rounded-xl border-2 hover:shadow-md transition"
                style={{ borderColor: `${accent}33` }}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{item.icon}</span>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-1">{item.title}</h4>
                    <p className="text-sm text-slate-600">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "steps":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="space-y-4">
            {section.items?.map((item: any, idx: number) => (
              <div key={idx} className="flex gap-4">
                <div
                  className="flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center font-bold text-white text-lg"
                  style={{ background: accent }}
                >
                  {item.step}
                </div>
                <div className="flex-1 pt-1">
                  <h4 className="font-bold text-lg text-slate-900">{item.title}</h4>
                  <p className="text-slate-600">{item.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "script":
      return (
        <div className="px-12 py-10 border-b">
          <div className="flex items-start gap-4 mb-4">
            <div
              className="text-5xl font-black opacity-20"
              style={{ color: accent }}
            >
              {section.number}
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-slate-900">{section.title}</h3>
              {section.situation && (
                <p className="text-sm text-slate-500 italic mt-1">📍 {section.situation}</p>
              )}
            </div>
          </div>
          <div
            className="p-6 rounded-xl border-l-4 bg-slate-50"
            style={{ borderColor: accent }}
          >
            <p className="text-slate-800 whitespace-pre-line leading-relaxed font-medium">
              {section.script}
            </p>
          </div>
          {section.branches && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
              {section.branches.map((b: any, idx: number) => (
                <div key={idx} className="p-4 rounded-lg bg-white border-2" style={{ borderColor: `${accent}55` }}>
                  <Badge className="mb-2" style={{ background: accent }}>
                    Se: {b.label}
                  </Badge>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{b.reply}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      );

    case "objection":
      return (
        <div className="px-12 py-8 border-b">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 w-14 h-14 rounded-xl flex items-center justify-center font-black text-white text-lg"
              style={{ background: "#EF4444" }}
            >
              {section.number}
            </div>
            <div className="flex-1">
              <p className="text-sm text-red-600 font-semibold uppercase tracking-wide mb-1">
                Objeção
              </p>
              <h4 className="text-xl font-bold text-slate-900 mb-3">"{section.title}"</h4>
              <div className="p-4 rounded-lg bg-emerald-50 border-l-4 border-emerald-500">
                <p className="text-xs text-emerald-700 font-semibold uppercase mb-1">
                  💬 Como responder
                </p>
                <p className="text-slate-800 leading-relaxed">{section.reply}</p>
              </div>
            </div>
          </div>
        </div>
      );

    case "raci":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead style={{ background: accent }} className="text-white">
                <tr>
                  {section.headers?.map((h: string, i: number) => (
                    <th key={i} className="px-4 py-3 text-left font-bold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {section.rows?.map((row: string[], i: number) => (
                  <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                    {row.map((cell, j) => (
                      <td key={j} className={`px-4 py-3 ${j === 0 ? "font-semibold" : "text-slate-700"}`}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );

    case "kpis":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items?.map((kpi: any, idx: number) => (
              <div
                key={idx}
                className="p-5 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${accent}11, ${accent}05)`,
                  borderLeft: `4px solid ${accent}`,
                }}
              >
                <div className="flex items-baseline justify-between mb-1">
                  <h4 className="font-bold text-slate-900">{kpi.name}</h4>
                  <span className="text-2xl font-black" style={{ color: accent }}>
                    {kpi.target}
                  </span>
                </div>
                <p className="text-sm text-slate-600">{kpi.desc}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "cadence":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="relative pl-8 border-l-2" style={{ borderColor: accent }}>
            {section.items?.map((step: any, idx: number) => (
              <div key={idx} className="relative mb-6 last:mb-0">
                <div
                  className="absolute -left-[42px] w-5 h-5 rounded-full border-4 border-white"
                  style={{ background: accent }}
                />
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <Badge style={{ background: accent }} className="text-white font-bold">
                    {step.day}
                  </Badge>
                  <Badge variant="outline">{step.channel}</Badge>
                </div>
                <p className="text-slate-700">{step.action}</p>
              </div>
            ))}
          </div>
        </div>
      );

    case "profiles":
      return (
        <div className="px-12 py-10 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.items?.map((p: any, idx: number) => (
              <div
                key={idx}
                className="rounded-2xl p-6 text-white"
                style={{ background: `linear-gradient(135deg, ${p.color}, ${shade(p.color, -25)})` }}
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center text-4xl font-black">
                    {p.letter}
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold">{p.name}</h4>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.traits?.map((t: string, i: number) => (
                        <span key={i} className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="bg-white/10 rounded-lg p-3 backdrop-blur">
                    <p className="font-bold uppercase text-xs opacity-90 mb-1">✅ Como vender</p>
                    <p>{p.how_to_sell}</p>
                  </div>
                  <div className="bg-black/20 rounded-lg p-3 backdrop-blur">
                    <p className="font-bold uppercase text-xs opacity-90 mb-1">❌ Evite</p>
                    <p>{p.avoid}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );

    case "detection":
      return (
        <div className="px-12 py-10 border-b">
          <h3 className="text-2xl font-bold mb-6" style={{ color: accent }}>
            {section.title}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {section.items?.map((item: any, idx: number) => (
              <div
                key={idx}
                className="flex items-center justify-between p-4 rounded-lg bg-slate-50 border"
              >
                <span className="text-slate-700">{item.signal}</span>
                <Badge style={{ background: accent }} className="text-white font-bold ml-2">
                  {item.profile}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      );

    case "closing":
      return (
        <div
          className="px-12 py-12"
          style={{
            background: `linear-gradient(135deg, ${accent}11, ${accent}05)`,
          }}
        >
          <div className="flex items-start gap-4">
            <FileText className="h-8 w-8 flex-shrink-0" style={{ color: accent }} />
            <div>
              <h3 className="text-2xl font-bold mb-3" style={{ color: accent }}>
                {section.title}
              </h3>
              <p className="text-slate-700 leading-relaxed text-lg whitespace-pre-line">
                {section.content}
              </p>
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// helpers
function shade(hex: string, percent: number) {
  const f = parseInt(hex.slice(1), 16);
  const t = percent < 0 ? 0 : 255;
  const p = Math.abs(percent) / 100;
  const R = f >> 16;
  const G = (f >> 8) & 0x00ff;
  const B = f & 0x0000ff;
  const to = (c: number) => Math.round((t - c) * p) + c;
  return `#${(0x1000000 + (to(R) << 16) + (to(G) << 8) + to(B))
    .toString(16)
    .slice(1)}`;
}
