BEGIN;

ALTER TABLE public.instructores
  DROP CONSTRAINT IF EXISTS instructores_rol_check,
  ALTER COLUMN rol SET DEFAULT 'Instructor';

UPDATE public.instructores
SET rol = CASE lower(btrim(rol))
  WHEN 'admin' THEN 'Administrador'
  WHEN 'administrador' THEN 'Administrador'
  WHEN 'creador' THEN 'Creador'
  WHEN 'coordinador' THEN 'Coordinador'
  WHEN 'instructor' THEN 'Instructor'
  ELSE rol
END
WHERE rol IS NOT NULL
  AND rol NOT IN ('Instructor', 'Coordinador', 'Administrador', 'Creador');

ALTER TABLE public.instructores
  ADD CONSTRAINT instructores_rol_check
  CHECK (rol IN ('Instructor', 'Coordinador', 'Administrador', 'Creador'));

COMMIT;
