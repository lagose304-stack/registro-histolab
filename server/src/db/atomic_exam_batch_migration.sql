CREATE OR REPLACE FUNCTION public.save_academic_exam_batch(
  target_career text, existing_ids uuid[], replacement_exams jsonb
)
RETURNS SETOF public.agenda_academica
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  previous_exams jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('academic_exam_batch'), hashtext(target_career));

  -- Release the old time slots together so exams in the same batch can swap slots.
  WITH removed AS (
    DELETE FROM public.agenda_academica
    WHERE carrera = target_career AND tipo = 'examen' AND id = ANY(existing_ids)
    RETURNING id, created_at
  )
  SELECT coalesce(jsonb_agg(removed), '[]'::jsonb) INTO previous_exams FROM removed;

  IF jsonb_array_length(previous_exams) <> cardinality(existing_ids) THEN
    RAISE EXCEPTION 'An exam no longer exists' USING ERRCODE = 'P0002';
  END IF;

  RETURN QUERY
  INSERT INTO public.agenda_academica (
    id, carrera, tipo, seccion_id, titulo, fecha, hora_inicio, hora_fin, created_at
  )
  SELECT exam.id, target_career, 'examen', exam.seccion_id, exam.titulo,
         exam.fecha, exam.hora_inicio, exam.hora_fin, coalesce(previous.created_at, now())
  FROM jsonb_populate_recordset(NULL::public.agenda_academica, replacement_exams) AS exam
  LEFT JOIN jsonb_to_recordset(previous_exams) AS previous(id uuid, created_at timestamptz)
    ON previous.id = exam.id
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.save_academic_exam_batch(text, uuid[], jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_academic_exam_batch(text, uuid[], jsonb) TO service_role;
