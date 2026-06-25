import { Link } from "@/lib/navigation";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, PriorityBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { PlusCircle, Filter, Search as SearchIcon, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { INCIDENT_STAGES, STAGE_LABELS, PRIORITIES } from "@/lib/incident-constants";

export function IncidentsList() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [assetId, setAssetId] = useState<string>("all");
  const [category, setCategory] = useState<string>("all");

  const { data: assets } = useQuery({
    queryKey: ["assets-min"],
    queryFn: async () => {
      const { data } = await supabase
        .from("space_assets")
        .select("id, name")
        .order("name");
      return data ?? [];
    },
  });

  const { data: incidents } = useQuery({
    queryKey: ["incidents", { status, priority, assetId, category, search }],
    queryFn: async () => {
      let q = supabase
        .from("incidents")
        .select("*, space_assets(name)")
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status as never);
      if (priority !== "all") q = q.eq("priority", priority as never);
      if (assetId !== "all") q = q.eq("asset_id", assetId);
      if (category !== "all") q = q.eq("threat_category", category);
      if (search) q = q.or(`title.ilike.%${search}%,incident_number.ilike.%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    (incidents ?? []).forEach((i) => set.add(i.threat_category));
    return Array.from(set);
  }, [incidents]);

  const hasFilters = status !== "all" || priority !== "all" || assetId !== "all" || category !== "all" || !!search;

  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="text-sm text-muted-foreground">
            All cyber incidents across your space operations.
          </p>
        </div>
        <Button asChild>
          <Link to="/incidents/new"><PlusCircle className="size-4" /> New incident</Link>
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-3">
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or ID…"
            className="pl-8"
          />
        </div>
        <Filter className="size-4 text-muted-foreground" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {INCIDENT_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={assetId} onValueChange={setAssetId}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Asset" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assets</SelectItem>
            {(assets ?? []).map((a) => (
              <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSearch(""); setStatus("all"); setPriority("all"); setAssetId("all"); setCategory("all");
            }}
          >
            <X className="size-3.5" /> Clear
          </Button>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">ID</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Asset</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[140px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(incidents ?? []).map((i) => (
              <TableRow key={i.id} className="cursor-pointer">
                <TableCell className="font-mono text-xs">
                  <Link to="/incidents/$incidentId" params={{ incidentId: i.id }} className="hover:text-primary">
                    {i.incident_number}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link to="/incidents/$incidentId" params={{ incidentId: i.id }} className="font-medium hover:text-primary">
                    {i.title}
                  </Link>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {(i.space_assets as { name?: string } | null)?.name ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{i.threat_category}</TableCell>
                <TableCell><PriorityBadge priority={i.priority} /></TableCell>
                <TableCell><StatusBadge status={i.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(i.created_at).toLocaleDateString()}
                </TableCell>
              </TableRow>
            ))}
            {(incidents ?? []).length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">
                  No incidents match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
