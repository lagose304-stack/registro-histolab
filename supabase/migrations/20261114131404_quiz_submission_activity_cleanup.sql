BEGIN;

-- La API no recibe DELETE sobre la bitácora. Solo este trigger puede limpiar
-- los intentos explícitamente vinculados a una entrega eliminada definitivamente.
CREATE FUNCTION public.cleanup_deleted_quiz_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE linked_attempt uuid;
BEGIN
  -- La reapertura elimina y reinserta la misma entrega en su transacción.
  -- Al comprobar al COMMIT, sus respuestas y su bitácora siguen intactas.
  IF EXISTS (SELECT 1 FROM public.entregas_pruebas WHERE id = OLD.id) THEN
    RETURN NULL;
  END IF;

  FOR linked_attempt IN
    SELECT a.id FROM public.quiz_activity_attempts a
    WHERE a.seccion_id = OLD.seccion_id::text
      AND a.numero_semana = OLD.numero_semana
      AND a.numero_cuenta = OLD.numero_cuenta
      AND a.quiz_id = OLD.quiz_id::text
      AND a.id::text IN (
        SELECT lower(OLD.auditoria #>> '{actividad,intento_id}')
        UNION
        SELECT lower(item #>> '{entrega,auditoria,actividad,intento_id}')
        FROM jsonb_array_elements(CASE
          WHEN jsonb_typeof(OLD.auditoria->'reaperturas') = 'array'
          THEN OLD.auditoria->'reaperturas' ELSE '[]'::jsonb END) AS history(item)
      )
    ORDER BY a.id FOR UPDATE
  LOOP
    -- El bloqueo del intento serializa el borrado con nuevos eventos y lotes.
    DELETE FROM public.quiz_activity_events WHERE intento_id = linked_attempt;
    -- Los lotes de diagnóstico se eliminan por su FK ON DELETE CASCADE.
    DELETE FROM public.quiz_activity_attempts WHERE id = linked_attempt;
  END LOOP;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_deleted_quiz_activity()
  FROM PUBLIC, anon, authenticated, service_role;

CREATE CONSTRAINT TRIGGER quiz_delivery_activity_cleanup
  AFTER DELETE ON public.entregas_pruebas
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_deleted_quiz_activity();

COMMIT;
