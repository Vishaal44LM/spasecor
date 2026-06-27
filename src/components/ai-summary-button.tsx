import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sparkles, Loader2, Download, FileText, FileType2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { summarizeIncident, type IncidentSummary } from "@/lib/summary";
import { exportSummaryPdf, exportSummaryDocx, summaryToMarkdown, copyToClipboard, downloadBlob } from "@/lib/exports";

const SECTION_ORDER: { key: keyof IncidentSummary; label: string }[] = [
  { key: "executive", label: "Executive summary" },
  { key: "timeline", label: "Timeline" },
  { key: "investigation", label: "Investigation" },
  { key: "collaboration", label: "Collaboration" },
  { key: "documents", label: "Documents" },
  { key: "tasks", label: "Tasks" },
  { key: "closure", label: "Closure" },
];

export function AISummaryButton({ incidentId, incidentNumber }: { incidentId: string; incidentNumber: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate() {
    setLoading(true); setSummary(null); setOpen(true);
    try {
      const s = await summarizeIncident(incidentId);
      setSummary(s);
    } catch (e) {
      toast.error((e as Error).message);
      setOpen(false);
    } finally { setLoading(false); }
  }

  function buildDoc() {
    if (!summary) return null;
    return {
      title: `Incident Summary — ${incidentNumber}`,
      sections: SECTION_ORDER.map((s) => ({ heading: s.label, body: summary[s.key] || "—" })),
    };
  }

  async function doCopy() {
    const doc = buildDoc(); if (!doc) return;
    await copyToClipboard(summaryToMarkdown(doc));
    setCopied(true); setTimeout(() => setCopied(false), 1500);
    toast.success("Copied to clipboard");
  }
  function doPdf() { const d = buildDoc(); if (d) exportSummaryPdf(d, `${incidentNumber}_summary.pdf`); }
  function doDocx() { const d = buildDoc(); if (d) exportSummaryDocx(d, `${incidentNumber}_summary.docx`); }
  function doMd() {
    const d = buildDoc(); if (!d) return;
    downloadBlob(new Blob([summaryToMarkdown(d)], { type: "text/markdown" }), `${incidentNumber}_summary.md`);
  }

  return (
    <>
      <Button onClick={generate} variant="outline" size="sm">
        <Sparkles className="size-4 text-primary" /> Generate Incident Summary
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> AI Incident Intelligence Summary — {incidentNumber}
            </DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Summarizing incident data…</p>
            </div>
          )}

          {summary && (
            <>
              <div className="flex flex-wrap gap-2 border-b pb-3">
                <Button size="sm" variant="outline" onClick={doPdf}><FileText className="size-3.5" /> PDF</Button>
                <Button size="sm" variant="outline" onClick={doDocx}><FileType2 className="size-3.5" /> DOCX</Button>
                <Button size="sm" variant="outline" onClick={doMd}><Download className="size-3.5" /> Markdown</Button>
                <Button size="sm" variant="outline" onClick={doCopy}>
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} Copy
                </Button>
              </div>
              <Tabs defaultValue="executive" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="flex-wrap h-auto justify-start">
                  {SECTION_ORDER.map((s) => (
                    <TabsTrigger key={s.key} value={s.key}>{s.label}</TabsTrigger>
                  ))}
                </TabsList>
                <div className="flex-1 overflow-y-auto pt-4">
                  {SECTION_ORDER.map((s) => (
                    <TabsContent key={s.key} value={s.key}>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{summary[s.key] || "No data available."}</p>
                    </TabsContent>
                  ))}
                </div>
              </Tabs>
              <p className="border-t pt-2 text-[10px] text-muted-foreground">
                AI summarizes verified information only. It never recommends mitigation, predicts attacks, or changes incident status.
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
