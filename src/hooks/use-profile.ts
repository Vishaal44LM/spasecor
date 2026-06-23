import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*, organizations(*)")
        .eq("id", u.user.id)
        .single();
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}
