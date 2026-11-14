BEGIN;
ALTER TABLE public.quiz_activity_attempts ADD COLUMN diagnostico_version integer
  CHECK (diagnostico_version IS NULL OR diagnostico_version = 1);

CREATE TABLE public.quiz_diagnostic_batches (
  id uuid PRIMARY KEY,
  intento_id uuid NOT NULL REFERENCES public.quiz_activity_attempts(id) ON DELETE CASCADE,
  recibido_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  datos jsonb NOT NULL CHECK (octet_length(datos::text) <= 16384)
);
CREATE INDEX quiz_diagnostics_attempt_idx ON public.quiz_diagnostic_batches(intento_id, recibido_at);
ALTER TABLE public.quiz_diagnostic_batches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.quiz_diagnostic_batches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.quiz_diagnostic_batches TO service_role;
CREATE POLICY diagnostic_api_read ON public.quiz_diagnostic_batches FOR SELECT TO service_role USING (true);
CREATE POLICY diagnostic_api_insert ON public.quiz_diagnostic_batches FOR INSERT TO service_role WITH CHECK (true);

CREATE FUNCTION public.append_quiz_diagnostic(p_attempt uuid, p_student text, p_batch uuid, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE attempt public.quiz_activity_attempts;
BEGIN
  SELECT * INTO attempt FROM public.quiz_activity_attempts
    WHERE id = p_attempt AND alumno_id = p_student FOR UPDATE;
  IF attempt.id IS NULL OR attempt.diagnostico_version IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Este intento no tiene aceptación del diagnóstico';
  END IF;
  IF EXISTS (SELECT 1 FROM public.quiz_diagnostic_batches WHERE id = p_batch AND intento_id = p_attempt) THEN
    RETURN jsonb_build_object('aceptado',true,'limite',false);
  END IF;
  IF coalesce(attempt.finalizado_at, attempt.reemplazado_at) < clock_timestamp() - interval '1 day' THEN
    RETURN jsonb_build_object('aceptado',false,'limite',true);
  END IF;
  IF p_payload IS NULL OR p_payload->>'version' IS DISTINCT FROM '1'
    OR jsonb_typeof(p_payload->'muestras') IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_payload->'muestras') NOT BETWEEN 1 AND 16
    OR octet_length(p_payload::text) > 16384 THEN
    RAISE EXCEPTION 'Diagnóstico inválido';
  END IF;
  IF (SELECT count(*) FROM public.quiz_diagnostic_batches WHERE intento_id = p_attempt) >= 64 THEN
    RETURN jsonb_build_object('aceptado',false,'limite',true);
  END IF;
  INSERT INTO public.quiz_diagnostic_batches(id,intento_id,datos) VALUES(p_batch,p_attempt,p_payload);
  RETURN jsonb_build_object('aceptado',true,'limite',false);
END;
$$;
REVOKE ALL ON FUNCTION public.append_quiz_diagnostic(uuid,text,uuid,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.append_quiz_diagnostic(uuid,text,uuid,jsonb) TO service_role;
COMMIT;
