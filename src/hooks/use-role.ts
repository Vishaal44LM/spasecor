import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "mission_manager"
  | "security_analyst"
  | "satellite_engineer"
  | "viewer";

export function useRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [] as AppRole[];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (error) return [] as AppRole[];
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 60_000,
  });
}

export function useHasRole(...roles: AppRole[]) {
  const { data } = useRoles();
  if (!data) return false;
  return roles.some((r) => data.includes(r));
}

export function useIsAdmin() {
  return useHasRole("admin");
}

export function useCanManage() {
  return useHasRole("admin", "mission_manager");
}
