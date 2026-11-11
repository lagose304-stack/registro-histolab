-- Aplicar después de student_makeup_attendance_migration.sql.
BEGIN;
SET LOCAL lock_timeout='5s';
CREATE OR REPLACE FUNCTION public.apply_student_makeup(p_id uuid,p_manuales jsonb DEFAULT NULL,p_asistio boolean DEFAULT NULL,p_entrega uuid DEFAULT NULL,p_actor uuid DEFAULT NULL)
RETURNS public.reposiciones_estudiantes LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r public.reposiciones_estudiantes; delivery public.entregas_pruebas; patch jsonb:='{}'; tab text; affected integer; absent boolean;
BEGIN
  SELECT * INTO STRICT r FROM public.reposiciones_estudiantes WHERE id=p_id FOR UPDATE;
  IF r.estado NOT IN ('asignada','completada') THEN RAISE EXCEPTION 'La reposición no está asignada'; END IF;
  IF r.practica_at>now() THEN RAISE EXCEPTION 'La práctica todavía no ha iniciado'; END IF;
  absent:=CASE WHEN p_asistio IS NOT NULL THEN NOT p_asistio ELSE r.asistencia_reposicion='Falta injustificada' END;
  IF coalesce(absent,false) AND EXISTS(SELECT 1 FROM jsonb_each_text(coalesce(p_manuales,'{}'::jsonb)) e WHERE e.value::numeric>0) THEN
    RAISE EXCEPTION 'No puedes registrar manuales positivos con falta injustificada en la reposición';
  END IF;
  IF p_manuales IS NOT NULL THEN
    IF jsonb_typeof(p_manuales)<>'object' THEN RAISE EXCEPTION 'Formato de manuales inválido'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each(p_manuales) e WHERE NOT(e.key=ANY(r.manual_ids))
      OR jsonb_typeof(e.value)<>'number') THEN RAISE EXCEPTION 'Manual o nota inválidos'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_each_text(p_manuales) e WHERE e.value::numeric<0 OR e.value::numeric>1
      OR round(e.value::numeric,3)<>e.value::numeric) THEN RAISE EXCEPTION 'Las notas de manual deben estar entre 0 y 1 con hasta tres decimales'; END IF;
    patch:=patch || p_manuales;
    r.manual_notas:=r.manual_notas || p_manuales;
  END IF;
  IF p_entrega IS NOT NULL THEN
    SELECT * INTO STRICT delivery FROM public.entregas_pruebas WHERE id=p_entrega;
    IF delivery.seccion_id<>r.seccion_destino_id OR delivery.numero_cuenta<>r.numero_cuenta
      OR delivery.numero_semana<>r.numero_semana OR delivery.estado<>'calificado' OR delivery.nota_obtenida IS NULL THEN
      RAISE EXCEPTION 'La entrega no corresponde a esta reposición o está pendiente'; END IF;
    IF coalesce(absent,false) AND delivery.nota_obtenida>0 THEN RAISE EXCEPTION 'La reposición tiene falta injustificada'; END IF;
    patch:=patch || jsonb_build_object('prueba_'||r.numero_semana,delivery.nota_obtenida,
      'prueba_'||r.numero_semana||'_real',coalesce(nullif(to_jsonb(delivery)->'nota_real','null'::jsonb),to_jsonb(delivery.nota_obtenida)));
    r.prueba_entrega_id:=delivery.id;
  END IF;
  r.asistio:=coalesce(p_asistio,r.asistio);
  IF p_asistio IS NOT NULL THEN r.asistencia_reposicion:=CASE WHEN p_asistio THEN 'Asistio' ELSE 'Falta injustificada' END; END IF;
  IF coalesce(absent,false) THEN
    patch:=patch || jsonb_build_object('prueba_'||r.numero_semana,0,'prueba_'||r.numero_semana||'_real',0);
    patch:=patch || coalesce((SELECT jsonb_object_agg(k,0) FROM unnest(r.manual_ids) k),'{}'::jsonb);
    r.manual_notas:=r.manual_notas || coalesce((SELECT jsonb_object_agg(k,0) FROM unnest(r.manual_ids) k),'{}'::jsonb);
  END IF;
  r.notas_aplicadas:=r.notas_aplicadas || patch;
  IF r.asistio AND r.prueba_entrega_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM unnest(r.manual_ids) k WHERE NOT(r.manual_notas ? k))
    THEN r.estado:='completada'; ELSE r.estado:='asignada'; END IF;
  UPDATE public.reposiciones_estudiantes SET asistio=r.asistio,asistencia_reposicion=r.asistencia_reposicion,manual_notas=r.manual_notas,notas_aplicadas=r.notas_aplicadas,
    prueba_entrega_id=r.prueba_entrega_id,estado=r.estado,revisado_por=coalesce(p_actor,revisado_por),updated_at=now() WHERE id=p_id;
  tab:=CASE r.carrera WHEN 'MEDICINA' THEN 'estudiantes_medicina' WHEN 'ENFERMERIA' THEN 'estudiantes_enfermeria'
    WHEN 'ODONTOLOGIA' THEN 'estudiantes_odontologia' WHEN 'MICROBIOLOGIA' THEN 'estudiantes_microbiologia' WHEN 'NUTRICION' THEN 'estudiantes_nutricion' END;
  EXECUTE format('UPDATE public.%I SET notas=coalesce(notas,''{}''::jsonb)||$1,asistencias=coalesce(asistencias,''{}''::jsonb)||$4,updated_at=now() WHERE seccion_id=$2 AND numero_cuenta=$3 AND activo=true',tab)
    USING r.notas_aplicadas,r.seccion_origen_id,r.numero_cuenta,
      CASE WHEN r.asistencia_reposicion IS NULL THEN '{}'::jsonb ELSE jsonb_build_object('reposicion_'||r.numero_semana,CASE WHEN r.asistencia_reposicion='Asistio' THEN 'Repuso' ELSE 'No repuso' END) END;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RAISE EXCEPTION 'El estudiante ya no pertenece a su sección original'; END IF;
  RETURN r;
END $$;

REVOKE ALL ON FUNCTION public.apply_student_makeup(uuid,jsonb,boolean,uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_student_makeup(uuid,jsonb,boolean,uuid,uuid) TO service_role;
COMMIT;
