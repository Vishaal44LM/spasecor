import jsPDF from "jspdf";
import { Document, Packer, Paragraph, HeadingLevel, TextRun } from "docx";
import JSZip from "jszip";
import { evidenceDownload } from "@/lib/evidence";

export type SummaryDoc = {
  title: string;
  sections: { heading: string; body: string }[];
};

export function summaryToMarkdown(doc: SummaryDoc): string {
  return [
    `# ${doc.title}`,
    "",
    ...doc.sections.flatMap((s) => [`## ${s.heading}`, "", s.body, ""]),
  ].join("\n");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSummaryPdf(doc: SummaryDoc, filename = "summary.pdf") {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;

  pdf.setFontSize(18);
  pdf.text(doc.title, margin, y);
  y += 28;

  for (const s of doc.sections) {
    if (y > 760) {
      pdf.addPage();
      y = margin;
    }
    pdf.setFontSize(13);
    pdf.text(s.heading, margin, y);
    y += 18;
    pdf.setFontSize(10);
    const lines = pdf.splitTextToSize(s.body || "—", width);
    for (const line of lines) {
      if (y > 800) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(line, margin, y);
      y += 14;
    }
    y += 10;
  }
  pdf.save(filename);
}

export async function exportSummaryDocx(doc: SummaryDoc, filename = "summary.docx") {
  const children = [
    new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(doc.title)] }),
    ...doc.sections.flatMap((s) => [
      new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(s.heading)] }),
      ...(s.body || "—").split("\n").map(
        (line) => new Paragraph({ children: [new TextRun(line)] }),
      ),
    ]),
  ];
  const d = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(d);
  downloadBlob(blob, filename);
}

export async function copyToClipboard(text: string) {
  await navigator.clipboard.writeText(text);
}

export async function exportInvestigationPackage(opts: {
  incidentNumber: string;
  files: { file_name: string; file_path: string; sha256: string | null; uploaded_by: string | null; created_at: string; version: number; category: string | null }[];
  manifest?: Record<string, unknown>;
}) {
  const zip = new JSZip();
  const folder = zip.folder(opts.incidentNumber)!;
  const manifest: Record<string, unknown>[] = [];
  for (const f of opts.files) {
    try {
      const blob = await evidenceDownload(f.file_path);
      const name = `v${f.version}_${f.file_name}`;
      folder.file(name, blob);
      manifest.push({
        file: name,
        original_name: f.file_name,
        sha256: f.sha256,
        version: f.version,
        category: f.category,
        uploaded_at: f.created_at,
      });
    } catch (e) {
      manifest.push({ file: f.file_name, error: (e as Error).message });
    }
  }
  folder.file(
    "MANIFEST.json",
    JSON.stringify({ incident: opts.incidentNumber, exported_at: new Date().toISOString(), ...opts.manifest, files: manifest }, null, 2),
  );
  const out = await zip.generateAsync({ type: "blob" });
  downloadBlob(out, `${opts.incidentNumber}_investigation_package.zip`);
}
