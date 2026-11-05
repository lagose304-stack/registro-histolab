ALTER TABLE public.configuracion_semanas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en configuracion_semanas" ON public.configuracion_semanas;

REVOKE ALL ON TABLE public.configuracion_semanas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.configuracion_semanas TO service_role;
