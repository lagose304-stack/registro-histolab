CREATE TABLE public.creator_sessions (
  instructor_id uuid NOT NULL REFERENCES public.instructores(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (instructor_id, session_id)
);

ALTER TABLE public.creator_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.creator_sessions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON TABLE public.creator_sessions TO service_role;

INSERT INTO public.creator_sessions (instructor_id, session_id, expires_at)
SELECT id, current_session_token, session_created_at + interval '168 hours'
FROM public.instructores
WHERE rol = 'Creador'
  AND current_session_token IS NOT NULL
  AND session_created_at + interval '168 hours' > now();
