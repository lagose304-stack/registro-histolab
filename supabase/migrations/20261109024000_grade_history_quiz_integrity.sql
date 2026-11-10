BEGIN;
SET LOCAL lock_timeout = '5s';

-- Identidad de revisión escrita únicamente por el servidor. Se conserva aunque se retire la cuenta docente.
ALTER TABLE public.entregas_pruebas ADD COLUMN instructor_calificador_id uuid;

CREATE OR REPLACE FUNCTION public.notas_para_historial(student jsonb, career text)
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
      ARRAY['manual_' || id, id::text, 'Manual de ' || titulo] AS keys
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
    WHERE raw.key !~ '_real$' AND raw.key NOT LIKE 'manual_tema_%'
  )
  SELECT DISTINCT ON (evaluation) evaluation, label, value
  FROM resolved ORDER BY evaluation, source_priority, priority, label
$$;

-- Elimina una entrega autorizada y su nota en la misma transacción.
CREATE FUNCTION public.delete_quiz_submission_with_grade(
  p_section uuid, p_week integer, p_account text, p_id uuid
)
RETURNS uuid LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  delivery public.entregas_pruebas;
  makeup public.reposiciones_estudiantes;
  target_section uuid;
  career text;
  tab text;
  keys text[];
BEGIN
  delivery := (SELECT d FROM public.entregas_pruebas d
    WHERE seccion_id = p_section AND numero_semana = p_week AND numero_cuenta = p_account
      AND (p_id IS NULL OR id = p_id));
  IF delivery.id IS NULL THEN RETURN NULL; END IF;

  -- La aplicación de una reposición también bloquea primero su solicitud.
  makeup := (SELECT r FROM public.reposiciones_estudiantes r
    WHERE prueba_entrega_id = delivery.id OR
      (seccion_destino_id = p_section AND numero_semana = p_week AND numero_cuenta = p_account
        AND estado IN ('asignada', 'completada'))
    ORDER BY (prueba_entrega_id IS NOT DISTINCT FROM delivery.id) DESC LIMIT 1 FOR UPDATE);

  PERFORM 1 FROM public.entregas_pruebas WHERE id = delivery.id FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  keys := ARRAY['prueba_' || p_week, 'examencito_' || p_week,
    'Prueba de la semana ' || p_week, 'prueba_' || p_week || '_real'];

  IF makeup.prueba_entrega_id = delivery.id THEN
    UPDATE public.reposiciones_estudiantes
    SET prueba_entrega_id = NULL, notas_aplicadas = notas_aplicadas - keys,
      estado = 'asignada', updated_at = now()
    WHERE id = makeup.id;
    target_section := makeup.seccion_origen_id;
  ELSIF makeup.id IS NULL THEN
    target_section := p_section;
  END IF;

  IF target_section IS NOT NULL THEN
    career := (SELECT s.carrera FROM public.secciones s WHERE s.id = target_section);
    tab := CASE translate(lower(trim(career)), 'áéíóú', 'aeiou')
      WHEN 'medicina' THEN 'estudiantes_medicina' WHEN 'enfermeria' THEN 'estudiantes_enfermeria'
      WHEN 'odontologia' THEN 'estudiantes_odontologia' WHEN 'microbiologia' THEN 'estudiantes_microbiologia'
      WHEN 'nutricion' THEN 'estudiantes_nutricion' END;
    IF tab IS NULL THEN RAISE EXCEPTION 'No se pudo identificar la matrícula de la prueba'; END IF;

    EXECUTE format('UPDATE public.%I SET notas = notas - $1, updated_at = now()
      WHERE seccion_id = $2 AND numero_cuenta = $3 AND notas ?| $1', tab)
      USING keys, target_section, p_account;
  END IF;

  DELETE FROM public.entregas_pruebas WHERE id = delivery.id;
  RETURN delivery.id;
END;
$$;

-- Impide que una sincronización atrasada restaure la nota de una entrega borrada
-- o atribuya a un docente la revisión guardada por otra sesión.
CREATE FUNCTION public.sync_quiz_student_grade(
  p_delivery uuid, p_version timestamptz, p_section uuid, p_account text,
  p_table text, p_previous jsonb, p_grades jsonb
)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE affected integer;
BEGIN
  IF p_table NOT IN ('estudiantes_medicina', 'estudiantes_enfermeria', 'estudiantes_odontologia',
    'estudiantes_microbiologia', 'estudiantes_nutricion') OR p_table IS NULL THEN
    RAISE EXCEPTION 'Tabla de matrícula inválida';
  END IF;
  PERFORM 1 FROM public.entregas_pruebas
  WHERE id = p_delivery AND seccion_id = p_section AND numero_cuenta = p_account
    AND estado = 'calificado' AND updated_at IS NOT DISTINCT FROM p_version
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;

  EXECUTE format('UPDATE public.%I SET notas = $1, updated_at = now()
    WHERE seccion_id = $2 AND numero_cuenta = $3 AND notas IS NOT DISTINCT FROM $4', p_table)
    USING p_grades, p_section, p_account, p_previous;
  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_quiz_submission_with_grade(uuid,integer,text,uuid),
  public.sync_quiz_student_grade(uuid,timestamptz,uuid,text,text,jsonb,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_quiz_submission_with_grade(uuid,integer,text,uuid),
  public.sync_quiz_student_grade(uuid,timestamptz,uuid,text,text,jsonb,jsonb)
  TO service_role;

CREATE FUNCTION public.sync_quiz_makeup_grade(p_makeup uuid, p_delivery uuid, p_version timestamptz)
RETURNS boolean LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  PERFORM 1 FROM public.reposiciones_estudiantes WHERE id = p_makeup FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM 1 FROM public.entregas_pruebas
  WHERE id = p_delivery AND estado = 'calificado' AND updated_at IS NOT DISTINCT FROM p_version
  FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  PERFORM public.apply_student_makeup(p_id => p_makeup, p_entrega => p_delivery);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_quiz_makeup_grade(uuid,uuid,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_quiz_makeup_grade(uuid,uuid,timestamptz) TO service_role;

COMMIT;
