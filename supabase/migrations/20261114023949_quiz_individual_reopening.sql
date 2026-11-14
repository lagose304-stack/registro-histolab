BEGIN;

-- Solo la API docente puede autorizar una reapertura. La entrega anterior y
-- la bitácora permanecen; retirar la nota y habilitar el borrador es atómico.
CREATE FUNCTION public.reopen_quiz_submission(
  p_section uuid, p_week integer, p_account text, p_version timestamptz,
  p_request uuid, p_reason text, p_actor uuid, p_actor_name text
)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  delivery public.entregas_pruebas;
  snapshot jsonb;
  history jsonb;
  reopened jsonb;
  stamp timestamptz := clock_timestamp();
BEGIN
  IF p_reason IS NULL OR length(trim(p_reason)) NOT BETWEEN 5 AND 500 OR p_actor IS NULL OR p_request IS NULL THEN
    RAISE EXCEPTION 'Indica el motivo de la reapertura y el docente responsable';
  END IF;
  -- Mismo orden de bloqueo que la eliminación y sincronización de reposiciones.
  PERFORM 1 FROM public.reposiciones_estudiantes r
    WHERE r.seccion_destino_id = p_section AND r.numero_semana = p_week
      AND r.numero_cuenta = p_account AND r.estado IN ('asignada', 'completada')
    FOR UPDATE;
  SELECT * INTO delivery FROM public.entregas_pruebas
    WHERE seccion_id = p_section AND numero_semana = p_week AND numero_cuenta = p_account
    FOR UPDATE;
  IF delivery.id IS NULL THEN RAISE EXCEPTION 'Entrega no encontrada'; END IF;
  IF delivery.estado = 'borrador' AND delivery.auditoria->'reapertura'->>'id' = p_request::text THEN
    RETURN to_jsonb(delivery);
  END IF;
  IF delivery.estado = 'borrador' OR delivery.updated_at IS DISTINCT FROM p_version THEN
    RAISE EXCEPTION 'La entrega cambió; actualiza el panel antes de reabrir';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sesiones_pruebas_en_vivo
    WHERE seccion_id = p_section AND numero_semana = p_week AND habilitada
      AND estado IN ('lobby', 'en_pregunta', 'esperando_siguiente')) THEN
    RAISE EXCEPTION 'Abre la sala antes de autorizar la reapertura';
  END IF;

  snapshot := (to_jsonb(delivery) - 'auditoria') || jsonb_build_object(
    'auditoria', coalesce(delivery.auditoria, '{}'::jsonb) - 'reaperturas');
  history := coalesce(delivery.auditoria->'reaperturas', '[]'::jsonb);
  reopened := jsonb_build_object('id', p_request, 'fecha', stamp, 'motivo', trim(p_reason),
    'instructor_id', p_actor, 'instructor_nombre', p_actor_name);
  PERFORM public.delete_quiz_submission_with_grade(p_section, p_week, p_account, delivery.id);
  delivery := jsonb_populate_record(delivery, jsonb_build_object(
    'estado', 'borrador', 'nota_obtenida', NULL, 'nota_real', NULL, 'nota_con_bonus', NULL,
    'comentarios', '', 'calificado_por', '', 'instructor_calificador_id', NULL,
    'auditoria', jsonb_build_object('reapertura', reopened,
      'reaperturas', history || jsonb_build_array(jsonb_build_object('autorizacion', reopened, 'entrega', snapshot))),
    'updated_at', stamp));
  INSERT INTO public.entregas_pruebas SELECT delivery.*;
  UPDATE public.quiz_activity_attempts SET reemplazado_at = stamp,
    finalizado_at = coalesce(finalizado_at, stamp)
    WHERE seccion_id = p_section::text AND numero_semana = p_week
      AND numero_cuenta = p_account AND reemplazado_at IS NULL;
  RETURN to_jsonb(delivery);
END;
$$;

REVOKE ALL ON FUNCTION public.reopen_quiz_submission(uuid,integer,text,timestamptz,uuid,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_quiz_submission(uuid,integer,text,timestamptz,uuid,text,uuid,text)
  TO service_role;
COMMIT;
