ALTER TABLE public.secciones
  ADD CONSTRAINT secciones_coordinador_obligatorio
  CHECK (coordinador IS NOT NULL AND coordinador ~ '[^[:space:]]');
