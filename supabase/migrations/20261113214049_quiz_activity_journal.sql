-- Registro independiente de señales declaradas por el navegador. No borra datos académicos.
CREATE TABLE public.quiz_activity_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id text NOT NULL,
  seccion_id text NOT NULL,
  numero_semana integer NOT NULL CHECK (numero_semana > 0),
  alumno_id text NOT NULL,
  numero_cuenta text NOT NULL,
  nombre_completo text NOT NULL DEFAULT '',
  politica text NOT NULL CHECK (politica = 'salidas-tres-faltas-v1'),
  aceptado_at timestamptz NOT NULL DEFAULT now(),
  aceptado_cliente_at timestamptz NOT NULL,
  faltas integer NOT NULL DEFAULT 0 CHECK (faltas BETWEEN 0 AND 3),
  episodio_abierto uuid,
  finalizado_at timestamptz,
  reemplazado_at timestamptz
);
CREATE UNIQUE INDEX quiz_activity_current_idx ON public.quiz_activity_attempts (quiz_id, seccion_id, numero_semana, alumno_id, numero_cuenta) WHERE reemplazado_at IS NULL;
CREATE INDEX quiz_activity_review_idx ON public.quiz_activity_attempts (seccion_id, numero_semana, numero_cuenta);

CREATE TABLE public.quiz_activity_events (
  secuencia bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id uuid NOT NULL,
  intento_id uuid NOT NULL REFERENCES public.quiz_activity_attempts(id) ON DELETE RESTRICT,
  episodio_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('salida','regreso')),
  falta integer NOT NULL CHECK (falta BETWEEN 1 AND 3),
  senales jsonb NOT NULL,
  pregunta_id text NOT NULL DEFAULT '',
  pregunta_indice integer NOT NULL CHECK (pregunta_indice BETWEEN 0 AND 999),
  hora_cliente timestamptz NOT NULL,
  recibido_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  origen text NOT NULL DEFAULT 'navegador_declarado' CHECK (origen = 'navegador_declarado'),
  UNIQUE (intento_id, id),
  UNIQUE (intento_id, episodio_id, tipo)
);

ALTER TABLE public.quiz_activity_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_activity_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_activity_attempts, public.quiz_activity_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.quiz_activity_attempts TO service_role;
GRANT SELECT, INSERT ON public.quiz_activity_events TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.quiz_activity_events_secuencia_seq TO service_role;

-- Serializa todos los eventos de un intento. Reintentar conserva el registro original.
CREATE FUNCTION public.append_quiz_activity(p_attempt uuid, p_student text, p_events jsonb)
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
        OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(event->'senales') s WHERE s NOT IN ('pagina_oculta','ventana_sin_foco','documento_abandonado','salida_del_portal')) THEN
        RAISE EXCEPTION 'Señal inválida';
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
