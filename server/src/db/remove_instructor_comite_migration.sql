BEGIN;

SET LOCAL lock_timeout = '5s';

ALTER TABLE public.instructores DROP COLUMN IF EXISTS comite;

COMMIT;
