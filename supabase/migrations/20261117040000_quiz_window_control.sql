-- Solo nuevos intentos aceptados; conserva contadores, permisos y registros anteriores.
ALTER TABLE public.quiz_activity_attempts ADD COLUMN ventana_version integer CHECK (ventana_version = 1);

CREATE OR REPLACE FUNCTION public.append_quiz_activity(p_attempt uuid, p_student text, p_events jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  attempt public.quiz_activity_attempts%ROWTYPE;
  event jsonb;
  episode uuid;
  kind text;
BEGIN
  IF jsonb_typeof(p_events) <> 'array' OR jsonb_array_length(p_events) > 12 THEN
    RAISE EXCEPTION 'Lote de actividad inválido';
  END IF;
  SELECT * INTO STRICT attempt FROM public.quiz_activity_attempts
    WHERE id = p_attempt AND alumno_id = p_student FOR UPDATE;
  FOR event IN SELECT value FROM jsonb_array_elements(p_events) LOOP
    episode := (event->>'episodio_id')::uuid;
    kind := event->>'tipo';
    IF kind IS NULL OR kind NOT IN ('salida','regreso') OR episode IS NULL OR event->>'id' IS NULL THEN
      RAISE EXCEPTION 'Evento inválido';
    END IF;
    IF EXISTS (SELECT 1 FROM public.quiz_activity_events WHERE intento_id = p_attempt
      AND (id = (event->>'id')::uuid OR (episodio_id = episode AND tipo = kind))) THEN CONTINUE; END IF;
    IF attempt.finalizado_at IS NOT NULL OR attempt.reemplazado_at IS NOT NULL THEN CONTINUE; END IF;
    IF kind = 'salida' THEN
      IF attempt.faltas >= 3 OR attempt.episodio_abierto IS NOT NULL THEN CONTINUE; END IF;
      IF jsonb_typeof(event->'senales') IS DISTINCT FROM 'array' OR jsonb_array_length(event->'senales') = 0
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(event->'senales') s WHERE s NOT IN ('pagina_oculta','ventana_sin_foco','documento_abandonado','salida_del_portal','ventana_reducida')) THEN
        RAISE EXCEPTION 'Señal inválida';
      END IF;
      IF event->'senales' ? 'ventana_reducida' AND attempt.ventana_version IS DISTINCT FROM 1 THEN
        RAISE EXCEPTION 'El intento no aceptó el control de ancho';
      END IF;
      attempt.faltas := attempt.faltas + 1;
      attempt.episodio_abierto := episode;
    ELSE
      IF attempt.episodio_abierto IS DISTINCT FROM episode THEN RAISE EXCEPTION 'Regreso sin salida'; END IF;
      attempt.episodio_abierto := NULL;
    END IF;
    INSERT INTO public.quiz_activity_events (id,intento_id,episodio_id,tipo,falta,senales,pregunta_id,pregunta_indice,hora_cliente)
      VALUES ((event->>'id')::uuid,p_attempt,episode,kind,attempt.faltas,event->'senales',left(coalesce(event->>'pregunta_id',''),120),(event->>'pregunta_indice')::integer,(event->>'hora_cliente')::timestamptz);
  END LOOP;
  UPDATE public.quiz_activity_attempts SET faltas = attempt.faltas, episodio_abierto = attempt.episodio_abierto WHERE id = p_attempt;
END;
$$;
REVOKE ALL ON FUNCTION public.append_quiz_activity(uuid,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_quiz_activity(uuid,text,jsonb) TO service_role;
