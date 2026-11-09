-- Reposiciones individuales. No modifica matrículas ni notas existentes.
BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS public.reposiciones_estudiantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seccion_origen_id uuid NOT NULL REFERENCES public.secciones(id) ON DELETE RESTRICT,
  seccion_destino_id uuid REFERENCES public.secciones(id) ON DELETE RESTRICT,
  carrera text NOT NULL CHECK (carrera IN ('MEDICINA','ENFERMERIA','ODONTOLOGIA','MICROBIOLOGIA','NUTRICION')),
  numero_cuenta text NOT NULL,
  nombre_estudiante text NOT NULL,
  numero_semana integer NOT NULL CHECK (numero_semana > 0),
  origen_codigo text NOT NULL,
  destino_codigo text,
  motivo text NOT NULL CHECK (length(motivo) BETWEEN 10 AND 1000),
  estado text NOT NULL DEFAULT 'solicitada' CHECK (estado IN ('solicitada','asignada','completada','rechazada','cancelada')),
  solicitado_por uuid REFERENCES public.instructores(id) ON DELETE SET NULL,
  resuelto_por uuid REFERENCES public.instructores(id) ON DELETE SET NULL,
  observacion text NOT NULL DEFAULT '',
  practica_at timestamptz,
  manual_ids text[] NOT NULL DEFAULT '{}',
  asistio boolean NOT NULL DEFAULT false,
  asistencia_reposicion text CHECK (asistencia_reposicion IN ('Asistio','Falta injustificada')),
  manual_notas jsonb NOT NULL DEFAULT '{}'::jsonb,
  notas_aplicadas jsonb NOT NULL DEFAULT '{}'::jsonb,
  prueba_entrega_id uuid REFERENCES public.entregas_pruebas(id) ON DELETE RESTRICT,
  revisado_por uuid REFERENCES public.instructores(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (seccion_destino_id IS NULL OR seccion_destino_id <> seccion_origen_id),
  CHECK (estado NOT IN ('asignada','completada') OR (seccion_destino_id IS NOT NULL AND practica_at IS NOT NULL))
);
ALTER TABLE public.reposiciones_estudiantes ADD COLUMN IF NOT EXISTS asistencia_reposicion text CHECK (asistencia_reposicion IN ('Asistio','Falta injustificada'));
UPDATE public.reposiciones_estudiantes SET asistencia_reposicion='Asistio' WHERE asistio=true AND asistencia_reposicion IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS makeup_origin_once ON public.reposiciones_estudiantes(seccion_origen_id,numero_cuenta,numero_semana)
  WHERE estado IN ('solicitada','asignada','completada');
CREATE UNIQUE INDEX IF NOT EXISTS makeup_destination_once ON public.reposiciones_estudiantes(seccion_destino_id,numero_cuenta,numero_semana)
  WHERE estado IN ('asignada','completada');
CREATE INDEX IF NOT EXISTS makeup_inbox ON public.reposiciones_estudiantes(estado,created_at);
CREATE INDEX IF NOT EXISTS makeup_origin_student ON public.reposiciones_estudiantes(seccion_origen_id,numero_cuenta,estado);
ALTER TABLE public.reposiciones_estudiantes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reposiciones_estudiantes FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.reposiciones_estudiantes TO service_role;
DROP POLICY IF EXISTS makeup_service ON public.reposiciones_estudiantes;
CREATE POLICY makeup_service ON public.reposiciones_estudiantes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Asignación condicional: dos administradores no pueden resolver la misma solicitud.
CREATE OR REPLACE FUNCTION public.assign_student_makeup(p_id uuid,p_destino uuid,p_practica timestamptz,p_actor uuid)
RETURNS public.reposiciones_estudiantes LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r public.reposiciones_estudiantes; origin public.secciones; destination public.secciones;
BEGIN
  SELECT * INTO STRICT r FROM public.reposiciones_estudiantes WHERE id=p_id FOR UPDATE;
  IF r.estado <> 'solicitada' THEN RAISE EXCEPTION 'La solicitud ya fue resuelta'; END IF;
  SELECT * INTO STRICT origin FROM public.secciones WHERE id=r.seccion_origen_id;
  SELECT * INTO STRICT destination FROM public.secciones WHERE id=p_destino;
  IF destination.id=origin.id OR upper(translate(destination.carrera,'áéíóúÁÉÍÓÚ','aeiouAEIOU'))<>r.carrera
     OR destination.periodo_academico IS DISTINCT FROM origin.periodo_academico
     OR p_practica IS NULL OR p_practica<=now() THEN RAISE EXCEPTION 'La sección receptora no es elegible'; END IF;
  IF EXISTS(SELECT 1 FROM public.entregas_pruebas WHERE seccion_id=p_destino AND numero_semana=r.numero_semana)
     OR EXISTS(SELECT 1 FROM public.sesiones_pruebas_en_vivo WHERE seccion_id=p_destino AND numero_semana=r.numero_semana
       AND estado IN ('en_pregunta','esperando_siguiente','finalizada')) THEN RAISE EXCEPTION 'Esta sección ya inició la práctica'; END IF;
  UPDATE public.reposiciones_estudiantes SET seccion_destino_id=p_destino,destino_codigo=destination.codigo,
    practica_at=p_practica,estado='asignada',resuelto_por=p_actor,updated_at=now() WHERE id=p_id RETURNING * INTO r;
  RETURN r;
END $$;

-- Guarda notas y su procedencia en una sola transacción; bloquea el registro original.
CREATE OR REPLACE FUNCTION public.apply_student_makeup(p_id uuid,p_manuales jsonb DEFAULT NULL,p_asistio boolean DEFAULT NULL,p_entrega uuid DEFAULT NULL,p_actor uuid DEFAULT NULL)
RETURNS public.reposiciones_estudiantes LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r public.reposiciones_estudiantes; delivery public.entregas_pruebas; patch jsonb:='{}'; tab text; affected integer;
BEGIN
  SELECT * INTO STRICT r FROM public.reposiciones_estudiantes WHERE id=p_id FOR UPDATE;
  IF r.estado NOT IN ('asignada','completada') THEN RAISE EXCEPTION 'La reposición no está asignada'; END IF;
  IF r.practica_at>now() THEN RAISE EXCEPTION 'La práctica todavía no ha iniciado'; END IF;
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
    patch:=patch || jsonb_build_object('prueba_'||r.numero_semana,delivery.nota_obtenida,
      'prueba_'||r.numero_semana||'_real',coalesce(nullif(to_jsonb(delivery)->'nota_real','null'::jsonb),to_jsonb(delivery.nota_obtenida)));
    r.prueba_entrega_id:=delivery.id;
  END IF;
  r.asistio:=coalesce(p_asistio,r.asistio);
  IF p_asistio IS NOT NULL THEN r.asistencia_reposicion:=CASE WHEN p_asistio THEN 'Asistio' ELSE 'Falta injustificada' END; END IF;
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

-- Una carga antigua de la sección original no puede borrar las notas de reposición.
CREATE OR REPLACE FUNCTION public.preserve_student_makeup_grades() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE patch jsonb;
BEGIN
  FOR patch IN SELECT notas_aplicadas FROM public.reposiciones_estudiantes
    WHERE seccion_origen_id=NEW.seccion_id AND numero_cuenta=NEW.numero_cuenta AND estado IN ('asignada','completada')
    ORDER BY numero_semana LOOP
    NEW.notas:=coalesce(NEW.notas,'{}'::jsonb)||patch;
  END LOOP;
  RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS preserve_makeup_grades ON public.%I',tab);
    EXECUTE format('CREATE TRIGGER preserve_makeup_grades BEFORE UPDATE OF notas ON public.%I FOR EACH ROW EXECUTE FUNCTION public.preserve_student_makeup_grades()',tab);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.assign_student_makeup(uuid,uuid,timestamptz,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.apply_student_makeup(uuid,jsonb,boolean,uuid,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.preserve_student_makeup_grades() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.assign_student_makeup(uuid,uuid,timestamptz,uuid),public.apply_student_makeup(uuid,jsonb,boolean,uuid,uuid),public.preserve_student_makeup_grades() TO service_role;
CREATE OR REPLACE FUNCTION public.preserve_student_makeup_attendance() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT numero_semana,asistencia_reposicion FROM public.reposiciones_estudiantes
    WHERE seccion_origen_id=NEW.seccion_id AND numero_cuenta=NEW.numero_cuenta AND estado IN ('asignada','completada') AND asistencia_reposicion IS NOT NULL LOOP
    NEW.asistencias:=coalesce(NEW.asistencias,'{}'::jsonb)||jsonb_build_object('reposicion_'||r.numero_semana,CASE WHEN r.asistencia_reposicion='Asistio' THEN 'Repuso' ELSE 'No repuso' END);
  END LOOP;
  RETURN NEW;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='preserve_makeup_attendance' AND tgrelid=format('public.%I',tab)::regclass AND NOT tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER preserve_makeup_attendance BEFORE UPDATE OF asistencias ON public.%I FOR EACH ROW EXECUTE FUNCTION public.preserve_student_makeup_attendance()',tab);
    END IF;
    EXECUTE format('UPDATE public.%I s SET asistencias=coalesce(s.asistencias,''{}''::jsonb) WHERE EXISTS (SELECT 1 FROM public.reposiciones_estudiantes r WHERE r.seccion_origen_id=s.seccion_id AND r.numero_cuenta=s.numero_cuenta AND r.estado IN (''asignada'',''completada'') AND r.asistencia_reposicion IS NOT NULL)',tab);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.preserve_student_makeup_attendance() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.preserve_student_makeup_attendance() TO service_role;
COMMIT;
