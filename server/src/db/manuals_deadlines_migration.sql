CREATE TABLE IF NOT EXISTS public.fechas_carga_manuales (
  seccion_id uuid NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
  numero_semana integer NOT NULL CHECK (numero_semana > 0),
  fecha_carga date NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (seccion_id, numero_semana)
);

ALTER TABLE public.fechas_carga_manuales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fechas_carga_manuales FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.fechas_carga_manuales TO service_role;
