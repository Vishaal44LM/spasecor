ALTER TABLE public.incidents REPLICA IDENTITY FULL;
ALTER TABLE public.space_assets REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.space_assets;