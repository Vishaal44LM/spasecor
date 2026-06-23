import jsPDF from "jspdf";

type Section = { heading: string; body?: string; list?: string[] };

export function buildIncidentReportSections(args: {
  incident: {
    incident_number: string;
    title: string;
    threat_category: string;
    priority: string;
    status: string;
    description?: string | null;
    summary?: string | null;
    created_at: string;
    resolution_date?: string | null;
  };
  asset?: { name?: string; asset_type?: string; mission_name?: string | null } | null;
  ai?: Record<string, unknown> | null;
  mitigations?: string[];
  resolutionNote?: string;
}): Section[] {
  const { incident, asset, ai, mitigations, resolutionNote } = args;
  const exec =
    (ai?.executive_summary as string) ??
    incident.summary ??
    `Incident ${incident.incident_number} (${incident.threat_category}) on asset ${asset?.name ?? "unknown"} at priority ${incident.priority}.`;

  const threat = (ai?.threat_analysis ?? {}) as Record<string, string>;
  const scenario = ((ai?.attack_scenario ?? []) as string[]) ?? [];
  const impact = (ai?.mission_impact ?? {}) as Record<string, string>;
  const risk = (ai?.risk_assessment ?? {}) as Record<string, string>;
  const mit = (ai?.mitigation ?? {}) as Record<string, string[]>;

  return [
    { heading: "Executive Summary", body: exec },
    {
      heading: "Incident Overview",
      list: [
        `ID: ${incident.incident_number}`,
        `Title: ${incident.title}`,
        `Asset: ${asset?.name ?? "—"} (${asset?.asset_type ?? "—"})`,
        `Mission: ${asset?.mission_name ?? "—"}`,
        `Threat category: ${incident.threat_category}`,
        `Priority: ${incident.priority}`,
        `Status: ${incident.status}`,
        `Created: ${new Date(incident.created_at).toLocaleString()}`,
        ...(incident.resolution_date
          ? [`Resolved: ${new Date(incident.resolution_date).toLocaleString()}`]
          : []),
      ],
    },
    {
      heading: "Threat Analysis",
      body: threat.technical_summary ?? incident.description ?? "—",
      list: [
        threat.likely_threat_type ? `Likely threat: ${threat.likely_threat_type}` : "",
        threat.threat_severity ? `Severity: ${threat.threat_severity}` : "",
        threat.possible_attack_method ? `Method: ${threat.possible_attack_method}` : "",
      ].filter(Boolean),
    },
    { heading: "Attack Scenario", list: scenario.length ? scenario : ["No scenario generated."] },
    {
      heading: "Mission Impact",
      list: Object.entries(impact).map(([k, v]) => `${labelize(k)}: ${v}`),
    },
    {
      heading: "Risk Assessment",
      list: Object.entries(risk).map(([k, v]) => `${labelize(k)}: ${v}`),
    },
    {
      heading: "Mitigation Actions",
      list: [
        ...(mit.immediate ?? []).map((x) => `Immediate · ${x}`),
        ...(mit.short_term ?? []).map((x) => `Short-term · ${x}`),
        ...(mit.long_term ?? []).map((x) => `Long-term · ${x}`),
        ...(mitigations ?? []),
      ],
    },
    {
      heading: "Resolution Summary",
      body:
        resolutionNote ??
        incident.summary ??
        (incident.status === "closed" || incident.status === "resolved"
          ? "Incident resolved and closed."
          : "Incident is still in progress."),
    },
    {
      heading: "Lessons Learned",
      body: "Document observations, detection gaps, response improvements and operational follow-ups.",
    },
  ];
}

function labelize(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function downloadIncidentPdf(args: {
  fileName: string;
  title: string;
  subtitle: string;
  sections: Section[];
}) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Header band
  doc.setFillColor(102, 78, 174);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SPASECOR", margin, 30);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Space Cyber Incident Report", margin, 48);
  doc.setFontSize(9);
  doc.text(new Date().toLocaleString(), pageW - margin, 48, { align: "right" });

  y = 96;
  doc.setTextColor(20, 20, 30);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(args.title, margin, y, { maxWidth: pageW - margin * 2 });
  y += 22;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(110, 110, 120);
  doc.text(args.subtitle, margin, y);
  y += 24;

  function ensure(space: number) {
    if (y + space > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  }

  args.sections.forEach((s) => {
    ensure(50);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(102, 78, 174);
    doc.text(s.heading.toUpperCase(), margin, y);
    y += 6;
    doc.setDrawColor(102, 78, 174);
    doc.line(margin, y, margin + 36, y);
    y += 14;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(30, 30, 36);

    if (s.body) {
      const lines = doc.splitTextToSize(s.body, pageW - margin * 2);
      lines.forEach((line: string) => {
        ensure(16);
        doc.text(line, margin, y);
        y += 14;
      });
      y += 4;
    }
    if (s.list && s.list.length) {
      s.list.forEach((item) => {
        const lines = doc.splitTextToSize(`•  ${item}`, pageW - margin * 2 - 8);
        lines.forEach((line: string, idx: number) => {
          ensure(16);
          doc.text(line, margin + (idx === 0 ? 0 : 12), y);
          y += 14;
        });
      });
    }
    y += 10;
  });

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 150);
    doc.text(`Spasecor · Confidential · Page ${i} of ${total}`, pageW / 2, pageH - 24, { align: "center" });
  }

  doc.save(args.fileName);
}
