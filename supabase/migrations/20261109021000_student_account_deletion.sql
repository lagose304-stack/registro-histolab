BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE IF NOT EXISTS histolab_private.student_auth_deletions (
 auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 profile_table text NOT NULL,profile_id uuid NOT NULL,expires_at timestamptz NOT NULL
);
ALTER TABLE histolab_private.student_auth_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON histolab_private.student_auth_deletions FROM PUBLIC,anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.prepare_student_auth_delete(p_table text,p_profile uuid,p_section uuid,p_account text,p_auth uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE linked uuid;
BEGIN
 IF p_table NOT IN ('estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion') THEN RETURN jsonb_build_object('allowed',false); END IF;
 EXECUTE format('SELECT auth_user_id FROM public.%I WHERE id=$1 AND seccion_id=$2 AND numero_cuenta=$3 FOR UPDATE',p_table) INTO linked USING p_profile,p_section,p_account;
 IF linked IS NULL OR linked IS DISTINCT FROM p_auth THEN RETURN jsonb_build_object('allowed',false); END IF;
 DELETE FROM histolab_private.student_auth_deletions WHERE expires_at<now();
 INSERT INTO histolab_private.student_auth_deletions VALUES(p_auth,p_table,p_profile,now()+interval '5 minutes')
 ON CONFLICT(auth_user_id) DO UPDATE SET profile_table=EXCLUDED.profile_table,profile_id=EXCLUDED.profile_id,expires_at=EXCLUDED.expires_at;
 RETURN jsonb_build_object('allowed',true);
END $$;
REVOKE ALL ON FUNCTION public.prepare_student_auth_delete(text,uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.prepare_student_auth_delete(text,uuid,uuid,text,uuid) TO service_role;
-- Las cascadas se ejecutan dentro de la transacción de Supabase Auth.
DO $$ DECLARE tab text; fk record; BEGIN
 FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion','account_activation_challenges'] LOOP
  FOR fk IN SELECT con.conname FROM pg_constraint con JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=ANY(con.conkey)
    WHERE con.conrelid=format('public.%I',tab)::regclass AND con.confrelid='auth.users'::regclass AND con.contype='f' AND a.attname='auth_user_id'
  LOOP EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',tab,fk.conname); END LOOP;
  EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY(auth_user_id) REFERENCES auth.users(id) ON DELETE CASCADE',tab,tab||'_auth_user_id_fkey');
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION histolab_private.guard_student_auth_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE tab text; n integer; total integer:=0; ids uuid[]; target_table text; target_id uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.instructores WHERE id=OLD.id) THEN RAISE EXCEPTION 'La identidad pertenece a un instructor'; END IF;
 FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('SELECT count(*),array_agg(id) FROM (SELECT id FROM public.%I WHERE auth_user_id=$1 FOR UPDATE) locked',tab) INTO n,ids USING OLD.id;
  IF n=1 THEN target_table:=tab;target_id:=ids[1]; END IF;
  total:=total+n;
 END LOOP;
 IF total>1 THEN RAISE EXCEPTION 'La identidad pertenece a varios perfiles'; END IF;
 IF total=1 AND NOT EXISTS(SELECT 1 FROM histolab_private.student_auth_deletions WHERE auth_user_id=OLD.id AND profile_table=target_table AND profile_id=target_id AND expires_at>now()) THEN
  RAISE EXCEPTION 'La eliminación no corresponde al estudiante autorizado';
 END IF;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION histolab_private.guard_student_auth_delete() FROM PUBLIC,anon,authenticated,service_role;
DROP TRIGGER IF EXISTS guard_student_auth_delete ON auth.users;
CREATE TRIGGER guard_student_auth_delete BEFORE DELETE ON auth.users FOR EACH ROW EXECUTE FUNCTION histolab_private.guard_student_auth_delete();
CREATE OR REPLACE FUNCTION histolab_private.cleanup_deleted_student() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE deliveries uuid[]:='{}'; sections uuid[];
BEGIN
 sections:=ARRAY[OLD.seccion_id];
 IF to_regclass('public.reposiciones_estudiantes') IS NOT NULL THEN
  SELECT coalesce(array_agg(prueba_entrega_id) FILTER(WHERE prueba_entrega_id IS NOT NULL),'{}'),
    ARRAY[OLD.seccion_id]||coalesce(array_agg(seccion_destino_id) FILTER(WHERE seccion_destino_id IS NOT NULL),'{}')
    INTO deliveries,sections FROM public.reposiciones_estudiantes WHERE seccion_origen_id=OLD.seccion_id AND numero_cuenta=OLD.numero_cuenta;
  DELETE FROM public.reposiciones_estudiantes WHERE seccion_origen_id=OLD.seccion_id AND numero_cuenta=OLD.numero_cuenta;
 END IF;
 IF to_regclass('public.entregas_pruebas') IS NOT NULL THEN
  IF to_regclass('public.reposiciones_estudiantes') IS NOT NULL THEN
   DELETE FROM public.entregas_pruebas e WHERE (e.seccion_id=OLD.seccion_id AND e.numero_cuenta=OLD.numero_cuenta OR e.id=ANY(deliveries))
     AND NOT EXISTS(SELECT 1 FROM public.reposiciones_estudiantes r WHERE r.prueba_entrega_id=e.id);
  ELSE
   DELETE FROM public.entregas_pruebas WHERE seccion_id=OLD.seccion_id AND numero_cuenta=OLD.numero_cuenta;
  END IF;
 END IF;
 IF to_regclass('public.sesiones_pruebas_en_vivo') IS NOT NULL THEN
  UPDATE public.sesiones_pruebas_en_vivo SET alumnos_conectados=alumnos_conectados-OLD.numero_cuenta,
    respuestas_globales=respuestas_globales-OLD.numero_cuenta WHERE seccion_id=ANY(sections)
    AND (alumnos_conectados ? OLD.numero_cuenta OR respuestas_globales ? OLD.numero_cuenta);
 END IF;
 DELETE FROM public.account_activation_challenges WHERE profile_table=TG_TABLE_NAME AND profile_id=OLD.id;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION histolab_private.cleanup_deleted_student() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS cleanup_deleted_student ON public.%I',tab);
  EXECUTE format('CREATE TRIGGER cleanup_deleted_student AFTER DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION histolab_private.cleanup_deleted_student()',tab);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.student_account_deletion_ready() RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.student_account_deletion_ready() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.student_account_deletion_ready() TO service_role;
COMMIT;
