BEGIN;
CREATE SCHEMA IF NOT EXISTS histolab_private;
REVOKE ALL ON SCHEMA histolab_private FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS histolab_private.account_emails (
  correo text PRIMARY KEY,
  profile_table text NOT NULL,
  profile_id uuid NOT NULL,
  UNIQUE(profile_table,profile_id)
);
ALTER TABLE histolab_private.account_emails ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON histolab_private.account_emails FROM PUBLIC,anon,authenticated,service_role;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS activation_required boolean NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS activation_completed_at timestamptz',t);
  EXECUTE format('ALTER TABLE public.%I ALTER COLUMN activation_required SET DEFAULT true',t);
  IF t <> 'instructores' THEN
   EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS correo text, ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id)',t);
   EXECUTE format('ALTER TABLE public.%I ALTER COLUMN contrasena DROP DEFAULT, ALTER COLUMN contrasena DROP NOT NULL',t);
  END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (correo) WHERE activo IS TRUE',t||'_active_email',t);
 END LOOP;
END $$;
LOCK TABLE public.instructores,public.estudiantes_medicina,public.estudiantes_enfermeria,public.estudiantes_odontologia,public.estudiantes_microbiologia,public.estudiantes_nutricion IN SHARE ROW EXCLUSIVE MODE;
DELETE FROM histolab_private.account_emails;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('INSERT INTO histolab_private.account_emails(correo,profile_table,profile_id) SELECT lower(btrim(correo)),%L,id FROM public.%I WHERE activo IS TRUE AND nullif(btrim(correo),'''') IS NOT NULL',t,t);
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION histolab_private.protect_account_email() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE claimed integer;
BEGIN
 IF TG_TABLE_SCHEMA <> 'public' OR TG_TABLE_NAME NOT IN ('instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion') THEN RAISE EXCEPTION 'Tabla no válida'; END IF;
 IF TG_OP='DELETE' THEN DELETE FROM histolab_private.account_emails WHERE profile_table=TG_TABLE_NAME AND profile_id=OLD.id; RETURN OLD; END IF;
 NEW.correo:=nullif(lower(btrim(NEW.correo)),'');
 IF NEW.correo IS NOT NULL AND (length(NEW.correo)>254 OR NEW.correo !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$') THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Ingresa un correo válido.'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.correo IS DISTINCT FROM nullif(lower(btrim(OLD.correo)),'') OR NEW.activo IS NOT TRUE THEN
   DELETE FROM histolab_private.account_emails WHERE profile_table=TG_TABLE_NAME AND profile_id=OLD.id;
  END IF;
  IF NEW.correo IS DISTINCT FROM nullif(lower(btrim(OLD.correo)),'') THEN
   NEW.activation_required:=true; NEW.activation_completed_at:=NULL; NEW.current_session_token:=NULL;
   IF TG_TABLE_NAME <> 'instructores' THEN NEW.auth_user_id:=NULL; NEW.contrasena:=NULL; END IF;
  END IF;
 END IF;
 IF NEW.activo IS TRUE AND NEW.correo IS NOT NULL THEN
  INSERT INTO histolab_private.account_emails AS existing VALUES (NEW.correo,TG_TABLE_NAME,NEW.id)
  ON CONFLICT(correo) DO UPDATE SET profile_id=EXCLUDED.profile_id WHERE existing.profile_table=EXCLUDED.profile_table AND existing.profile_id=EXCLUDED.profile_id;
  GET DIAGNOSTICS claimed=ROW_COUNT;
  IF claimed=0 THEN RAISE EXCEPTION USING ERRCODE='23505',CONSTRAINT='unique_account_email',MESSAGE='Este correo ya está registrado en otra cuenta activa.'; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION histolab_private.protect_account_email() FROM PUBLIC,anon,authenticated,service_role;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS protect_account_email ON public.%I',t);
  EXECUTE format('CREATE TRIGGER protect_account_email BEFORE INSERT OR UPDATE OF correo,activo OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION histolab_private.protect_account_email()',t);
 END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public.account_activation_limits(key text PRIMARY KEY,count integer NOT NULL,expires_at timestamptz NOT NULL);
CREATE TABLE IF NOT EXISTS public.account_activation_challenges (
 id uuid PRIMARY KEY,profile_table text NOT NULL CHECK(profile_table IN ('instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion')),
 profile_id uuid NOT NULL,auth_user_id uuid NOT NULL REFERENCES auth.users(id),correo text NOT NULL,
 state text NOT NULL DEFAULT 'issuing' CHECK(state IN ('issuing','sent','verifying','verified','saving','completed','cancelled')),
 attempts integer NOT NULL DEFAULT 0,expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes',
 grant_hash text,grant_expires_at timestamptz,lease text,lease_until timestamptz,created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activation_subject ON public.account_activation_challenges(profile_table,profile_id);
CREATE INDEX IF NOT EXISTS activation_expiry ON public.account_activation_challenges(created_at);
ALTER TABLE public.account_activation_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_activation_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_activation_limits,public.account_activation_challenges FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.account_activation_limits,public.account_activation_challenges TO service_role;

CREATE OR REPLACE FUNCTION public.account_activation_rate(p_email text,p_ip text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE spec record; n integer; wait_seconds integer:=0;
BEGIN
 FOR spec IN SELECT * FROM (VALUES ('email-minute:'||p_email,1,60),('email-hour:'||p_email,3,3600),('email-day:'||p_email,10,86400),('ip-hour:'||p_ip,500,3600)) AS limits(key,max_count,seconds) ORDER BY key LOOP
  INSERT INTO public.account_activation_limits AS old(key,count,expires_at) VALUES(spec.key,1,now()+make_interval(secs=>spec.seconds))
  ON CONFLICT(key) DO UPDATE SET count=CASE WHEN old.expires_at<=now() THEN 1 ELSE old.count+1 END,expires_at=CASE WHEN old.expires_at<=now() THEN EXCLUDED.expires_at ELSE old.expires_at END RETURNING count INTO n;
  IF n>spec.max_count THEN SELECT greatest(wait_seconds,ceil(extract(epoch FROM expires_at-now()))::integer) INTO wait_seconds FROM public.account_activation_limits WHERE key=spec.key; END IF;
 END LOOP;
 DELETE FROM public.account_activation_limits WHERE expires_at<now()-interval '1 day';
 DELETE FROM public.account_activation_challenges WHERE created_at<now()-interval '1 day';
 RETURN jsonb_build_object('allowed',wait_seconds=0,'retry_after',wait_seconds);
END $$;

CREATE OR REPLACE FUNCTION public.account_activation_mail_budget() RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.account_activation_limits AS old VALUES('gmail-daily-budget',1,now()+interval '24 hours')
 ON CONFLICT(key) DO UPDATE SET count=CASE WHEN old.expires_at<=now() THEN 1 ELSE old.count+1 END,expires_at=CASE WHEN old.expires_at<=now() THEN EXCLUDED.expires_at ELSE old.expires_at END RETURNING count INTO n;
 RETURN jsonb_build_object('allowed',n<=400);
END $$;

CREATE OR REPLACE FUNCTION public.account_activation_issue(p_id uuid,p_table text,p_profile uuid,p_auth uuid,p_email text) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE student record;
BEGIN
 IF p_table NOT IN ('instructores','estudiantes_medicina','estudiantes_enfermeria','estudiantes_odontologia','estudiantes_microbiologia','estudiantes_nutricion') THEN RETURN jsonb_build_object('allowed',false); END IF;
 EXECUTE format('SELECT correo,activo,activation_completed_at FROM public.%I WHERE id=$1 FOR UPDATE',p_table) INTO student USING p_profile;
 IF student IS NULL OR student.activo IS NOT TRUE OR student.correo IS DISTINCT FROM p_email OR student.activation_completed_at IS NOT NULL THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF EXISTS(SELECT 1 FROM public.account_activation_challenges WHERE profile_table=p_table AND profile_id=p_profile AND state='saving' AND lease_until>now()) THEN RETURN jsonb_build_object('allowed',false); END IF;
 UPDATE public.account_activation_challenges SET state='cancelled',grant_hash=NULL WHERE profile_table=p_table AND profile_id=p_profile AND state<>'completed';
 INSERT INTO public.account_activation_challenges(id,profile_table,profile_id,auth_user_id,correo) VALUES(p_id,p_table,p_profile,p_auth,p_email);
 RETURN jsonb_build_object('allowed',true);
END $$;

CREATE OR REPLACE FUNCTION public.account_activation_action(p_action text,p_id uuid,p_nonce text DEFAULT NULL,p_grant text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE c public.account_activation_challenges; affected integer;
BEGIN
 SELECT * INTO c FROM public.account_activation_challenges WHERE id=p_id FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('allowed',false); END IF;
 IF p_action='sent' AND c.state='issuing' THEN UPDATE public.account_activation_challenges SET state='sent' WHERE id=p_id;
 ELSIF p_action='cancel' AND c.state IN ('issuing','sent') THEN UPDATE public.account_activation_challenges SET state='cancelled' WHERE id=p_id;
 ELSIF p_action='verify' AND c.expires_at>now() AND c.attempts<5 AND (c.state='sent' OR c.state='verifying' AND c.lease_until<=now()) THEN
  UPDATE public.account_activation_challenges SET attempts=attempts+1,state='verifying',lease=p_nonce,lease_until=now()+interval '30 seconds' WHERE id=p_id;
 ELSIF p_action='invalid' AND c.state='verifying' AND c.lease=p_nonce THEN
  UPDATE public.account_activation_challenges SET state=CASE WHEN attempts>=5 THEN 'cancelled' ELSE 'sent' END,lease=NULL,lease_until=NULL WHERE id=p_id;
 ELSIF p_action='verified' AND c.state='verifying' AND c.lease=p_nonce AND c.expires_at>now() THEN
  UPDATE public.account_activation_challenges SET state='verified',grant_hash=p_grant,grant_expires_at=now()+interval '5 minutes',lease=NULL,lease_until=NULL WHERE id=p_id;
 ELSIF p_action='save' AND c.grant_hash=p_grant AND c.grant_expires_at>now() THEN
  IF c.state='completed' THEN RETURN jsonb_build_object('allowed',true,'completed',true); END IF;
  IF c.state<>'verified' AND NOT(c.state='saving' AND c.lease_until<=now()) THEN RETURN jsonb_build_object('allowed',false); END IF;
  UPDATE public.account_activation_challenges SET state='saving',lease=p_nonce,lease_until=now()+interval '60 seconds' WHERE id=p_id;
 ELSIF p_action='retry' AND c.state='saving' AND c.lease=p_nonce THEN
  UPDATE public.account_activation_challenges SET state='verified',lease=NULL,lease_until=NULL WHERE id=p_id;
 ELSIF p_action='complete' AND c.state='saving' AND c.lease=p_nonce AND c.grant_hash=p_grant AND c.grant_expires_at>now() THEN
  IF c.profile_table='instructores' THEN
   UPDATE public.instructores SET activation_required=false,activation_completed_at=now(),current_session_token=NULL WHERE id=c.profile_id AND id=c.auth_user_id AND correo=c.correo AND activo IS TRUE;
  ELSE
   EXECUTE format('UPDATE public.%I SET activation_required=false,activation_completed_at=now(),contrasena=NULL,current_session_token=NULL WHERE id=$1 AND auth_user_id=$2 AND correo=$3 AND activo IS TRUE',c.profile_table) USING c.profile_id,c.auth_user_id,c.correo;
  END IF;
  GET DIAGNOSTICS affected=ROW_COUNT;
  IF affected<>1 THEN RETURN jsonb_build_object('allowed',false); END IF;
  UPDATE public.account_activation_challenges SET state='completed',lease=NULL,lease_until=NULL WHERE id=p_id;
 ELSE RETURN jsonb_build_object('allowed',false);
 END IF;
 RETURN jsonb_build_object('allowed',true);
END $$;
REVOKE ALL ON FUNCTION public.account_activation_rate(text,text),public.account_activation_issue(uuid,text,uuid,uuid,text),public.account_activation_action(text,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_activation_rate(text,text),public.account_activation_issue(uuid,text,uuid,uuid,text),public.account_activation_action(text,uuid,text,text) TO service_role;
REVOKE ALL ON FUNCTION public.account_activation_mail_budget() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.account_activation_mail_budget() TO service_role;
COMMIT;
