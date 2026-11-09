BEGIN;
-- La recuperación utiliza los mismos desafíos de un uso, límites y guardado
-- que la activación. Solo la API privilegiada puede emitirlos.
CREATE OR REPLACE FUNCTION public.account_activation_issue(p_id uuid,p_table text,p_profile uuid,p_auth uuid,p_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE student record;
BEGIN
 IF p_table NOT IN ('instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion') THEN RETURN jsonb_build_object('allowed',false); END IF;
 EXECUTE format('SELECT correo,activo FROM public.%I WHERE id=$1 FOR UPDATE',p_table) INTO student USING p_profile;
 IF student IS NULL OR student.activo IS NOT TRUE OR student.correo IS DISTINCT FROM p_email THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF EXISTS(SELECT 1 FROM public.account_activation_challenges WHERE profile_table=p_table AND profile_id=p_profile AND state='saving' AND lease_until>now()) THEN RETURN jsonb_build_object('allowed',false); END IF;
 UPDATE public.account_activation_challenges SET state='cancelled',grant_hash=NULL WHERE profile_table=p_table AND profile_id=p_profile AND state<>'completed';
 INSERT INTO public.account_activation_challenges(id,profile_table,profile_id,auth_user_id,correo) VALUES(p_id,p_table,p_profile,p_auth,p_email);
 RETURN jsonb_build_object('allowed',true);
END $$;
REVOKE ALL ON FUNCTION public.account_activation_issue(uuid,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_activation_issue(uuid,text,uuid,uuid,text) TO service_role;
COMMIT;
