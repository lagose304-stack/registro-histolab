CREATE OR REPLACE FUNCTION public.replace_academic_weeks(
  target_career text,
  replacement_weeks jsonb,
  topic_moves jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF target_career IS NULL OR btrim(target_career) = ''
     OR replacement_weeks IS NULL OR jsonb_array_length(replacement_weeks) = 0 THEN
    RAISE EXCEPTION 'A career and at least one week are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize replacements for the same career, even when it has no rows yet.
  PERFORM pg_advisory_xact_lock(hashtext('academic_weeks'), hashtext(lower(target_career)));

  IF jsonb_array_length(topic_moves) > 0 THEN
    WITH moves AS (
      SELECT *
      FROM jsonb_to_recordset(topic_moves)
        AS move(old_week integer, new_week integer, is_exam boolean, topic_ids uuid[])
    ), assignments AS (
      SELECT DISTINCT ON (topic.id) topic.id, move.new_week
      FROM public.temario AS topic
      JOIN moves AS move ON (
        topic.id = ANY(move.topic_ids)
        OR (cardinality(move.topic_ids) = 0 AND NOT move.is_exam
            AND move.old_week > 0 AND topic.semana = move.old_week)
      )
      WHERE strpos(lower(topic.carrera), lower(target_career)) > 0
      -- Explicit assignments override the fallback based on the old week.
      ORDER BY topic.id, cardinality(move.topic_ids) > 0 DESC, move.new_week
    )
    UPDATE public.temario AS topic
    SET semana = assignments.new_week, updated_at = now()
    FROM assignments
    WHERE topic.id = assignments.id AND topic.semana IS DISTINCT FROM assignments.new_week;
  END IF;

  DELETE FROM public.configuracion_semanas
  WHERE strpos(lower(carrera), lower(target_career)) > 0;

  INSERT INTO public.configuracion_semanas (
    carrera, numero_semana, parcial, temas, fecha_inicio, fecha_fin,
    es_semana_actual, descripcion, updated_at
  )
  SELECT target_career, week.numero_semana, week.parcial, week.temas,
         week.fecha_inicio, week.fecha_fin, week.es_semana_actual,
         week.descripcion, week.updated_at
  FROM jsonb_populate_recordset(NULL::public.configuracion_semanas, replacement_weeks) AS week;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.replace_academic_weeks(text, jsonb, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_academic_weeks(text, jsonb, jsonb)
  TO service_role;
