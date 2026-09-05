-- ==============================================================================
-- 🔬 HISTOLAB - TABLAS DE ESTUDIANTES POR CARRERA (MODELO JSONB FLEXIBLE)
-- Carreras: Medicina, Enfermería, Odontología, Microbiología, Nutrición
-- ==============================================================================

-- 1. TABLA ESTUDIANTES MEDICINA
CREATE TABLE IF NOT EXISTS public.estudiantes_medicina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(5,2) DEFAULT 0.00,
    primer_examen NUMERIC(5,2) DEFAULT 0.00,
    segundo_examen NUMERIC(5,2) DEFAULT 0.00,
    tercer_examen NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_estudiantes_medicina_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);

ALTER TABLE public.estudiantes_medicina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_medicina" ON public.estudiantes_medicina;
CREATE POLICY "Acceso total API estudiantes_medicina" ON public.estudiantes_medicina FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_med_seccion ON public.estudiantes_medicina(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_med_cuenta ON public.estudiantes_medicina(numero_cuenta);

-- ------------------------------------------------------------------------------

-- 2. TABLA ESTUDIANTES ENFERMERÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_enfermeria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(5,2) DEFAULT 0.00,
    primer_examen NUMERIC(5,2) DEFAULT 0.00,
    segundo_examen NUMERIC(5,2) DEFAULT 0.00,
    tercer_examen NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_estudiantes_enfermeria_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);

ALTER TABLE public.estudiantes_enfermeria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_enfermeria" ON public.estudiantes_enfermeria;
CREATE POLICY "Acceso total API estudiantes_enfermeria" ON public.estudiantes_enfermeria FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_enf_seccion ON public.estudiantes_enfermeria(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_enf_cuenta ON public.estudiantes_enfermeria(numero_cuenta);

-- ------------------------------------------------------------------------------

-- 3. TABLA ESTUDIANTES ODONTOLOGÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_odontologia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(5,2) DEFAULT 0.00,
    primer_examen NUMERIC(5,2) DEFAULT 0.00,
    segundo_examen NUMERIC(5,2) DEFAULT 0.00,
    tercer_examen NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_estudiantes_odontologia_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);

ALTER TABLE public.estudiantes_odontologia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_odontologia" ON public.estudiantes_odontologia;
CREATE POLICY "Acceso total API estudiantes_odontologia" ON public.estudiantes_odontologia FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_odo_seccion ON public.estudiantes_odontologia(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_odo_cuenta ON public.estudiantes_odontologia(numero_cuenta);

-- ------------------------------------------------------------------------------

-- 4. TABLA ESTUDIANTES MICROBIOLOGÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_microbiologia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(5,2) DEFAULT 0.00,
    primer_examen NUMERIC(5,2) DEFAULT 0.00,
    segundo_examen NUMERIC(5,2) DEFAULT 0.00,
    tercer_examen NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_estudiantes_microbiologia_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);

ALTER TABLE public.estudiantes_microbiologia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_microbiologia" ON public.estudiantes_microbiologia;
CREATE POLICY "Acceso total API estudiantes_microbiologia" ON public.estudiantes_microbiologia FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_mic_seccion ON public.estudiantes_microbiologia(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_mic_cuenta ON public.estudiantes_microbiologia(numero_cuenta);

-- ------------------------------------------------------------------------------

-- 5. TABLA ESTUDIANTES NUTRICIÓN
CREATE TABLE IF NOT EXISTS public.estudiantes_nutricion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(5,2) DEFAULT 0.00,
    primer_examen NUMERIC(5,2) DEFAULT 0.00,
    segundo_examen NUMERIC(5,2) DEFAULT 0.00,
    tercer_examen NUMERIC(5,2) DEFAULT 0.00,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_estudiantes_nutricion_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);

ALTER TABLE public.estudiantes_nutricion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_nutricion" ON public.estudiantes_nutricion;
CREATE POLICY "Acceso total API estudiantes_nutricion" ON public.estudiantes_nutricion FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_nut_seccion ON public.estudiantes_nutricion(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_nut_cuenta ON public.estudiantes_nutricion(numero_cuenta);
