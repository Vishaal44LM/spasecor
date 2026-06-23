import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useOrgMembers() {
  return useQuery({
    queryKey: ["org-members"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name, email");
      const map = new Map<string, { name: string; email: string }>();
      (data ?? []).forEach((p) => map.set(p.id, { name: p.name, email: p.email }));
      return map;
    },
    staleTime: 5 * 60_000,
  });
}

export function memberName(map: Map<string, { name: string; email: string }> | undefined, id: string | null) {
  if (!id) return "System";
  return map?.get(id)?.name || map?.get(id)?.email || "Member";
}
