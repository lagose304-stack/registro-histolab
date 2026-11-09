BEGIN;
SET LOCAL lock_timeout = '5s';
DO $$ DECLARE source text; tab text; BEGIN
 source:=pg_get_functiondef('histolab_private.protect_account_email()'::regprocedure);
 source:=replace(source,' NEW.contrasena:=NULL;','');
 EXECUTE source;
 source:=pg_get_functiondef('public.account_activation_action(text,uuid,text,text)'::regprocedure);
 source:=replace(source,'contrasena=NULL,','');
 EXECUTE source;
 FOREACH tab IN ARRAY ARRAY['estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('ALTER TABLE public.%I DROP COLUMN IF EXISTS contrasena',tab);
  EXECUTE format('UPDATE public.%I SET activation_required=true,current_session_token=NULL WHERE auth_user_id IS NULL OR activation_completed_at IS NULL',tab);
 END LOOP;
END $$;
COMMIT;
