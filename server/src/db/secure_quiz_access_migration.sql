-- Las pruebas usan la API Express con service_role; el navegador no consulta estas tablas.
-- Aplicar en el proyecto correcto después de verificar la clave del backend.
-- No borra pruebas, respuestas ni sesiones. Revoca únicamente el acceso directo público.
BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.sesiones_pruebas_en_vivo WHERE habilitada AND estado IN ('lobby', 'en_pregunta', 'esperando_siguiente')) THEN
    RAISE EXCEPTION 'Hay una prueba activa; no se modificaron permisos';
  END IF;
END $$;
ALTER TABLE public.pruebas_semanales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_pruebas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sesiones_pruebas_en_vivo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en pruebas_semanales" ON public.pruebas_semanales;
DROP POLICY IF EXISTS "Acceso total para API en entregas_pruebas" ON public.entregas_pruebas;
DROP POLICY IF EXISTS "Acceso total para API en sesiones_pruebas_en_vivo" ON public.sesiones_pruebas_en_vivo;

DROP POLICY IF EXISTS "Bloquear acceso directo de alumnos" ON public.pruebas_semanales;
CREATE POLICY "Bloquear acceso directo de alumnos" ON public.pruebas_semanales AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Bloquear acceso directo de alumnos" ON public.entregas_pruebas;
CREATE POLICY "Bloquear acceso directo de alumnos" ON public.entregas_pruebas AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS "Bloquear acceso directo de alumnos" ON public.sesiones_pruebas_en_vivo;
CREATE POLICY "Bloquear acceso directo de alumnos" ON public.sesiones_pruebas_en_vivo AS RESTRICTIVE FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

REVOKE ALL ON TABLE public.pruebas_semanales, public.entregas_pruebas, public.sesiones_pruebas_en_vivo FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.pruebas_semanales, public.entregas_pruebas, public.sesiones_pruebas_en_vivo TO service_role;
COMMIT;

-- Verificación de permisos (deben devolver false para anon y authenticated):
-- SELECT role_name, table_name,
--   has_table_privilege(role_name, 'public.' || table_name, 'SELECT') AS can_read,
--   has_table_privilege(role_name, 'public.' || table_name, 'INSERT') AS can_insert,
--   has_table_privilege(role_name, 'public.' || table_name, 'UPDATE') AS can_update,
--   has_table_privilege(role_name, 'public.' || table_name, 'DELETE') AS can_delete
-- FROM (VALUES ('anon'), ('authenticated')) roles(role_name)
-- CROSS JOIN (VALUES ('pruebas_semanales'), ('entregas_pruebas'), ('sesiones_pruebas_en_vivo')) tables(table_name);
