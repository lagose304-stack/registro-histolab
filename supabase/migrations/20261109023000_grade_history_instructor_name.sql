CREATE OR REPLACE FUNCTION public.registrar_historial_notas() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  actor text;
  actor_name text;
  profile jsonb;
  previous jsonb := '{}'::jsonb;
  career text := upper(replace(TG_TABLE_NAME, 'estudiantes_', ''));
BEGIN
  IF current_user <> 'service_role' THEN RETURN NEW; END IF;
  actor := nullif(current_setting('request.headers', true), '')::jsonb->>'x-histolab-grade-actor';
  IF actor IS NULL THEN RETURN NEW; END IF;
  -- Hay instalaciones con nombre completo y otras con los nombres separados.
  profile := (SELECT to_jsonb(i) FROM public.instructores i WHERE i.id = actor::uuid);
  IF profile IS NULL THEN RAISE no_data_found; END IF;
  actor_name := coalesce(
    nullif(btrim(profile->>'nombre_completo'), ''),
    nullif(concat_ws(' ',
      nullif(btrim(profile->>'primer_nombre'), ''),
      nullif(btrim(profile->>'segundo_nombre'), ''),
      nullif(btrim(profile->>'primer_apellido'), ''),
      nullif(btrim(profile->>'segundo_apellido'), '')
    ), ''),
    'Instructor'
  );
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
