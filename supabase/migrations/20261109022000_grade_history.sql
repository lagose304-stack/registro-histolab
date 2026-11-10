CREATE TABLE public.historial_notas (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  seccion_id uuid NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
  instructor_id text NOT NULL,
  instructor_nombre text NOT NULL,
  numero_cuenta text NOT NULL,
  estudiante_nombre text NOT NULL,
  evaluacion text NOT NULL,
  etiqueta text NOT NULL,
  anterior numeric,
  nueva numeric,
  fecha timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX historial_notas_seccion_idx ON public.historial_notas (seccion_id, id DESC);
ALTER TABLE public.historial_notas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.historial_notas FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.historial_notas TO service_role;

-- Consolidar representaciones históricas antes de comparar la nota efectiva.
CREATE FUNCTION public.notas_para_historial(student jsonb, career text)
RETURNS TABLE (evaluacion text, etiqueta text, nota numeric)
LANGUAGE sql STABLE SET search_path = '' AS $$
  WITH exam_columns AS (
    SELECT unnest(ARRAY['primer_examen','segundo_examen','tercer_examen']) AS key
  ), exam_weeks AS (
    SELECT numero_semana, row_number() OVER (ORDER BY numero_semana) AS ordinal
    FROM public.configuracion_semanas
    WHERE translate(upper(trim(carrera)), 'ÁÉÍÓÚ', 'AEIOU') = career AND (es_examen OR concat_ws(' ', nombre_semana, descripcion, temas) ~* 'examen')
  ), aliases AS (
    SELECT 'manual_' || id AS evaluation, 'Manual · ' || titulo AS label,
      ARRAY['manual_' || id, id::text, 'Manual de ' || titulo, 'manual_tema_' || numero_tema] AS keys
    FROM public.temario WHERE translate(upper(trim(carrera)), 'ÁÉÍÓÚ', 'AEIOU') = career
    UNION ALL
    SELECT 'examen_semana_' || numero_semana, 'Examen · Semana ' || numero_semana,
      ARRAY['examen_semana_' || numero_semana, 'examen_' || numero_semana,
        (ARRAY['primer_examen','segundo_examen','tercer_examen'])[ordinal::int],
        (ARRAY['examen_I','examen_II','examen_III'])[ordinal::int]]
    FROM exam_weeks
    UNION ALL
    SELECT key, replace(key, '_', ' '), ARRAY[key,
      CASE key WHEN 'primer_examen' THEN 'examen_I' WHEN 'segundo_examen' THEN 'examen_II' ELSE 'examen_III' END]
    FROM exam_columns
    WHERE (SELECT count(*) FROM exam_weeks) <
      CASE key WHEN 'primer_examen' THEN 1 WHEN 'segundo_examen' THEN 2 ELSE 3 END
  ), raw AS (
    SELECT key, value::numeric AS value, 0 AS source_priority
    FROM jsonb_each_text(CASE WHEN jsonb_typeof(student->'notas') = 'object' THEN student->'notas' ELSE '{}'::jsonb END)
    WHERE value ~ '^[+-]?[0-9]+(\.[0-9]+)?$'
    UNION ALL
    SELECT key, (student->>key)::numeric, 1 FROM exam_columns WHERE student->>key ~ '^[0-9]+(\.[0-9]+)?$'
      AND (student->>key)::numeric > 0
  ), resolved AS (
    SELECT coalesce(a.evaluation, regexp_replace(raw.key, '^(examencito_|Prueba de la semana )', 'prueba_')) AS evaluation,
      coalesce(a.label, CASE WHEN raw.key ~ '^(prueba_|examencito_|Prueba de la semana )[0-9]+$'
        THEN 'Prueba · Semana ' || substring(raw.key FROM '[0-9]+$') ELSE replace(raw.key, '_', ' ') END) AS label,
      raw.value, raw.source_priority,
      coalesce(array_position(a.keys, raw.key), CASE WHEN raw.key LIKE 'prueba_%' THEN 1 ELSE 2 END) AS priority
    FROM raw LEFT JOIN aliases a ON raw.key = ANY(a.keys)
    WHERE raw.key !~ '_real$'
  )
  SELECT DISTINCT ON (evaluation) evaluation, label, value
  FROM resolved ORDER BY evaluation, source_priority, priority, label
$$;

CREATE FUNCTION public.registrar_historial_notas() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  actor text;
  actor_name text;
  previous jsonb := '{}'::jsonb;
  career text := upper(replace(TG_TABLE_NAME, 'estudiantes_', ''));
BEGIN
  IF current_user <> 'service_role' THEN RETURN NEW; END IF;
  actor := nullif(current_setting('request.headers', true), '')::jsonb->>'x-histolab-grade-actor';
  IF actor IS NULL THEN RETURN NEW; END IF;
  SELECT nombre_completo INTO STRICT actor_name FROM public.instructores WHERE id = actor::uuid;
  IF TG_OP = 'UPDATE' THEN previous := to_jsonb(OLD); END IF;

  INSERT INTO public.historial_notas
    (seccion_id, instructor_id, instructor_nombre, numero_cuenta, estudiante_nombre, evaluacion, etiqueta, anterior, nueva)
  SELECT NEW.seccion_id, actor, actor_name, NEW.numero_cuenta, NEW.nombre_completo,
    coalesce(new_grade.evaluacion, old_grade.evaluacion), coalesce(new_grade.etiqueta, old_grade.etiqueta),
    old_grade.nota, new_grade.nota
  FROM public.notas_para_historial(previous, career) old_grade
  FULL JOIN public.notas_para_historial(to_jsonb(NEW), career) new_grade USING (evaluacion)
  WHERE old_grade.nota IS DISTINCT FROM new_grade.nota;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notas_para_historial(jsonb,text), public.registrar_historial_notas()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notas_para_historial(jsonb,text), public.registrar_historial_notas()
  TO service_role;

DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia',
    'estudiantes_microbiologia','estudiantes_nutricion'] LOOP
    EXECUTE format('CREATE TRIGGER historial_notas AFTER INSERT OR UPDATE OF notas, primer_examen, segundo_examen, tercer_examen
      ON public.%I FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_notas()', tab);
  END LOOP;
END $$;
