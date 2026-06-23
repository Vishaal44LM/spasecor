import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandWordmark } from "@/components/brand";
import {
  ShieldCheck,
  Satellite,
  Workflow,
  FileText,
  Sparkles,
  ArrowRight,
  Radio,
  Activity,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Spasecor — Space Cyber Incident Management Platform" },
      {
        name: "description",
        content:
          "Enterprise incident management for satellite operators, mission control and aerospace cyber teams. Track, investigate, mitigate and resolve space cyber incidents end-to-end.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <BrandWordmark />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="bg-grid-faint absolute inset-0 opacity-60" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
              <span className="size-1.5 rounded-full bg-success" />
              Mission-critical incident operations
            </div>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-6xl">
              Space cyber incident management,{" "}
              <span className="text-primary">built for mission teams.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              Spasecor brings a structured incident workflow to satellites, ground stations and
              mission infrastructure — from detection through resolution, with AI-assisted
              investigation built in.
            </p>
            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start free <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">Sign in</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto mt-16 max-w-5xl overflow-hidden rounded-2xl border bg-card shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="size-2.5 rounded-full bg-muted-foreground/30" />
              <span className="ml-3 font-mono text-xs text-muted-foreground">
                spasecor.app / incidents
              </span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-4">
              {[
                { label: "Open", n: 12, tone: "bg-muted" },
                { label: "Investigating", n: 5, tone: "bg-warning/15" },
                { label: "Mitigation", n: 3, tone: "bg-primary/10" },
                { label: "Critical", n: 2, tone: "bg-destructive/10" },
              ].map((s) => (
                <div key={s.label} className={`rounded-lg p-4 ${s.tone}`}>
                  <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
                  <div className="mt-1 font-mono text-2xl font-semibold">{s.n}</div>
                </div>
              ))}
            </div>
            <div className="border-t p-6">
              <div className="grid gap-2 font-mono text-xs">
                {[
                  ["INC-1042", "GPS Spoofing — Sat-NORDIC-3", "Investigating", "Critical"],
                  ["INC-1041", "Ground Station Intrusion — GS-CASCADE", "Mitigation", "High"],
                  ["INC-1038", "Telemetry Manipulation — PAYLOAD-X", "Resolved", "Medium"],
                ].map(([id, title, status, prio]) => (
                  <div
                    key={id}
                    className="grid grid-cols-[100px_1fr_auto_auto] items-center gap-4 rounded-md border bg-background px-3 py-2"
                  >
                    <span className="text-muted-foreground">{id}</span>
                    <span className="truncate text-foreground">{title}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/80">
                      {status}
                    </span>
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                      {prio}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight">
              Purpose-built for space cybersecurity operations
            </h2>
            <p className="mt-3 text-muted-foreground">
              Spasecor is not a generic ticketing tool. Every surface — from the asset registry to
              the workflow — is shaped around how mission teams actually run incidents.
            </p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Satellite,
                title: "Space Asset Registry",
                desc: "Catalogue satellites, ground stations, payloads and mission infrastructure. Every incident links to a real asset.",
              },
              {
                icon: Workflow,
                title: "Structured Workflow",
                desc: "Open → Assigned → Investigating → Mitigation → Resolved → Closed. Full stage history with time-in-state.",
              },
              {
                icon: Sparkles,
                title: "AI Investigation Assist",
                desc: "Optional analysis surfaces likely threat, attack scenario, mission impact and mitigation recommendations.",
              },
              {
                icon: ShieldCheck,
                title: "Evidence & Audit",
                desc: "Attach logs, screenshots and reports. Every action is recorded in an immutable audit trail.",
              },
              {
                icon: FileText,
                title: "Mission-grade Reports",
                desc: "Export PDF reports with executive summary, threat analysis, mitigation and lessons learned.",
              },
              {
                icon: Activity,
                title: "Operations Analytics",
                desc: "Resolution time, incidents by category, asset hotspots, monthly trends. Built for ops reviews.",
              },
            ].map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-5">
                <div className="grid size-9 place-items-center rounded-md bg-primary/10 text-primary">
                  <f.icon className="size-4.5" />
                </div>
                <h3 className="mt-4 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-20 text-center">
          <Radio className="mx-auto size-8 text-primary" />
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">
            Stand up your space SOC in minutes
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Bring your team in, register your space assets and start running incidents through a
            real workflow today.
          </p>
          <div className="mt-8">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create your organization
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} Spasecor</div>
          <div>Space Cybersecurity Operations</div>
        </div>
      </footer>
    </div>
  );
}
