import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-role";

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  roles: AppRole[];
};

/** Everyone in the current organization — the shared workspace roster. */
export function useTeam() {
  return useQuery({
    queryKey: ["org-team"],
    queryFn: async (): Promise<TeamMember[]> => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("id, name, email").order("name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      const roleMap = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const list = roleMap.get(r.user_id) ?? [];
        list.push(r.role as AppRole);
        roleMap.set(r.user_id, list);
      });
      return (profiles ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        roles: roleMap.get(p.id) ?? [],
      }));
    },
    staleTime: 60_000,
  });
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  mission_manager: "Mission manager",
  security_analyst: "Security analyst",
  satellite_engineer: "Satellite engineer",
  viewer: "Viewer",
};

export function initialsOf(value: string) {
  return value
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
