BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;

CREATE TABLE IF NOT EXISTS public.agenda_academica (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    carrera text NOT NULL CHECK (carrera IN ('MEDICINA', 'ENFERMERIA', 'ODONTOLOGIA', 'MICROBIOLOGIA', 'NUTRICION')),
    tipo text NOT NULL CHECK (tipo IN ('reposicion', 'examen')),
    seccion_id uuid REFERENCES public.secciones(id) ON DELETE CASCADE,
    titulo text NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 160),
    fecha date NOT NULL,
    hora_inicio time NOT NULL,
    hora_fin time NOT NULL,
    fecha_original date,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (hora_inicio < hora_fin AND hora_fin < time '24:00'),
    CHECK (
        (tipo = 'reposicion' AND seccion_id IS NOT NULL AND fecha_original IS NOT NULL AND fecha_original <> fecha)
        OR (tipo = 'examen' AND fecha_original IS NULL)
    ),
    EXCLUDE USING gist (carrera WITH =, tsrange(fecha + hora_inicio, fecha + hora_fin, '[)') WITH &&)
);

CREATE INDEX IF NOT EXISTS agenda_academica_carrera_fecha_idx ON public.agenda_academica (carrera, fecha);
CREATE INDEX IF NOT EXISTS agenda_academica_seccion_idx ON public.agenda_academica (seccion_id);
CREATE UNIQUE INDEX IF NOT EXISTS agenda_academica_reposicion_unica
    ON public.agenda_academica (seccion_id, fecha_original) WHERE tipo = 'reposicion';

ALTER TABLE public.agenda_academica ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.agenda_academica FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.agenda_academica TO service_role;

COMMIT;
