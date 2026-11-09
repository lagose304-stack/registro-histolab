BEGIN;

-- Reserva global: la PK evita carreras entre escrituras en tablas distintas.
-- El esquema privado no se expone a la API ni permite liberar reservas al cliente.
CREATE SCHEMA IF NOT EXISTS histolab_private;
REVOKE ALL ON SCHEMA histolab_private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS histolab_private.student_enrollments (
  numero_cuenta text PRIMARY KEY CHECK (numero_cuenta <> '' AND numero_cuenta = btrim(numero_cuenta)),
  student_table text NOT NULL CHECK (student_table IN ('estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion')),
  student_id uuid NOT NULL,
  UNIQUE (student_table, student_id)
);
ALTER TABLE histolab_private.student_enrollments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON histolab_private.student_enrollments FROM PUBLIC, anon, authenticated, service_role;

-- Congela las matrículas durante el inventario y la instalación de los triggers.
LOCK TABLE public.estudiantes_medicina, public.estudiantes_enfermeria,
  public.estudiantes_odontologia, public.estudiantes_microbiologia,
  public.estudiantes_nutricion IN SHARE ROW EXCLUSIVE MODE;

DO $$
DECLARE t text; conflicts boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT btrim(numero_cuenta) cuenta FROM public.estudiantes_medicina WHERE activo IS TRUE
      UNION ALL SELECT btrim(numero_cuenta) FROM public.estudiantes_enfermeria WHERE activo IS TRUE
      UNION ALL SELECT btrim(numero_cuenta) FROM public.estudiantes_odontologia WHERE activo IS TRUE
      UNION ALL SELECT btrim(numero_cuenta) FROM public.estudiantes_microbiologia WHERE activo IS TRUE
      UNION ALL SELECT btrim(numero_cuenta) FROM public.estudiantes_nutricion WHERE activo IS TRUE
    ) active_accounts GROUP BY cuenta HAVING count(*) > 1
  ) INTO conflicts;
  IF conflicts THEN
    RAISE EXCEPTION 'Existen matrículas activas duplicadas. Resuélvelas antes de instalar la protección; no se ha eliminado ningún registro.';
  END IF;
  -- La migración no modifica estudiantes, notas, asistencias ni matrículas.
  DELETE FROM histolab_private.student_enrollments;
  FOREACH t IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
    EXECUTE format('INSERT INTO histolab_private.student_enrollments(numero_cuenta,student_table,student_id) SELECT btrim(numero_cuenta), %L, id FROM public.%I WHERE activo IS TRUE', t, t);
  END LOOP;
END $$;

-- SECURITY DEFINER solo para el mantenimiento interno de la reserva privada.
-- No recibe SQL ni identidades del cliente; se invoca desde las cinco tablas.
CREATE OR REPLACE FUNCTION histolab_private.enforce_student_enrollment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
DECLARE claimed integer;
BEGIN
  IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN ('estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion') THEN
    RAISE EXCEPTION 'Tabla de matrícula no válida';
  END IF;
  IF TG_OP = 'DELETE' THEN
    DELETE FROM histolab_private.student_enrollments
      WHERE student_table = TG_TABLE_NAME AND student_id = OLD.id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'No se puede cambiar el identificador de una matrícula';
  END IF;
  NEW.numero_cuenta := btrim(NEW.numero_cuenta);
  IF NEW.numero_cuenta IS NULL OR NEW.numero_cuenta = '' THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'El número de cuenta es obligatorio.';
  END IF;
  IF TG_OP = 'UPDATE' AND (NEW.activo IS NOT TRUE OR NEW.numero_cuenta IS DISTINCT FROM btrim(OLD.numero_cuenta)) THEN
    DELETE FROM histolab_private.student_enrollments
      WHERE student_table = TG_TABLE_NAME AND student_id = OLD.id;
  END IF;
  IF NEW.activo IS TRUE THEN
    INSERT INTO histolab_private.student_enrollments AS existing(numero_cuenta,student_table,student_id)
      VALUES (NEW.numero_cuenta,TG_TABLE_NAME,NEW.id)
      ON CONFLICT (numero_cuenta) DO UPDATE SET student_id = EXCLUDED.student_id
      WHERE existing.student_table = EXCLUDED.student_table AND existing.student_id = EXCLUDED.student_id;
    GET DIAGNOSTICS claimed = ROW_COUNT;
    IF claimed = 0 THEN
      RAISE EXCEPTION USING ERRCODE = '23505', CONSTRAINT = 'unique_active_student_account',
        MESSAGE = 'Este número de cuenta ya tiene una matrícula activa en otra sección o carrera.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION histolab_private.enforce_student_enrollment() FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS enforce_global_student_account ON public.%I', t);
    EXECUTE format('CREATE TRIGGER enforce_global_student_account BEFORE INSERT OR UPDATE OF id,numero_cuenta,seccion_id,activo OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION histolab_private.enforce_student_enrollment()', t);
  END LOOP;
END $$;

COMMIT;
