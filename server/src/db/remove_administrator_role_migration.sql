BEGIN;

ALTER TABLE public.instructores
  DROP CONSTRAINT IF EXISTS instructores_rol_check,
  ALTER COLUMN rol SET DEFAULT 'Instructor';

UPDATE public.instructores
SET rol = 'Instructor'
WHERE rol IS NULL OR lower(btrim(rol)) IN ('admin', 'administrador');

ALTER TABLE public.instructores
  ALTER COLUMN rol SET NOT NULL,
  ADD CONSTRAINT instructores_rol_check CHECK (rol IN ('Instructor', 'Coordinador', 'Creador'));

COMMIT;
