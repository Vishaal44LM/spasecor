import { useNavigate } from "@/lib/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { ShieldAlert, Satellite, FileText } from "lucide-react";

export function GlobalSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const { data } = useQuery({
    queryKey: ["search", q],
    enabled: open && q.length > 1,
    queryFn: async () => {
      const [incidents, assets, reports] = await Promise.all([
        supabase
          .from("incidents")
          .select("id, incident_number, title, status")
          .or(`title.ilike.%${q}%,incident_number.ilike.%${q}%,threat_category.ilike.%${q}%`)
          .limit(8),
        supabase.from("space_assets").select("id, name, asset_type").ilike("name", `%${q}%`).limit(6),
        supabase.from("incident_reports").select("id, incident_id, title").ilike("title", `%${q}%`).limit(6),
      ]);
      return {
        incidents: incidents.data ?? [],
        assets: assets.data ?? [],
        reports: reports.data ?? [],
      };
    },
  });

  function go(path: string) {
    onOpenChange(false);
    setQ("");
    navigate({ to: path });
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search incidents, assets, reports…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        <CommandEmpty>{q.length < 2 ? "Type to search…" : "No results."}</CommandEmpty>
        {(data?.incidents ?? []).length > 0 && (
          <CommandGroup heading="Incidents">
            {data!.incidents.map((i) => (
              <CommandItem key={i.id} onSelect={() => go(`/incidents/${i.id}`)}>
                <ShieldAlert className="size-4" />
                <span className="font-mono text-xs text-muted-foreground">{i.incident_number}</span>
                <span className="truncate">{i.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(data?.assets ?? []).length > 0 && (
          <CommandGroup heading="Assets">
            {data!.assets.map((a) => (
              <CommandItem key={a.id} onSelect={() => go(`/assets/${a.id}`)}>
                <Satellite className="size-4" />
                <span>{a.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{a.asset_type}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {(data?.reports ?? []).length > 0 && (
          <CommandGroup heading="Reports">
            {data!.reports.map((r) => (
              <CommandItem key={r.id} onSelect={() => go(`/incidents/${r.incident_id}`)}>
                <FileText className="size-4" />
                <span>{r.title}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
