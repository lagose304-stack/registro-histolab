-- ==============================================================================
-- 🔬 HISTOLAB DATABASE SCHEMA DEFINITION (5 CARRERAS + MODELO JSONB FLEXIBLE)
-- ==============================================================================

-- 1. TABLA DE INSTRUCTORES
CREATE TABLE IF NOT EXISTS public.instructores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_empleado TEXT UNIQUE NOT NULL,
    nombre_completo TEXT NOT NULL,
    correo TEXT UNIQUE NOT NULL,
    contrasena TEXT NOT NULL,
    rol TEXT DEFAULT 'INSTRUCTOR' CHECK (rol IN ('COORDINADOR', 'INSTRUCTOR')),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.instructores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en instructores" ON public.instructores;
CREATE POLICY "Acceso total para API en instructores" ON public.instructores FOR ALL TO public USING (true) WITH CHECK (true);

-- 2. TABLA DE SECCIONES
CREATE TABLE IF NOT EXISTS public.secciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo TEXT UNIQUE NOT NULL,
    dia TEXT NOT NULL,
    hora_inicio TEXT NOT NULL,
    hora_fin TEXT NOT NULL,
    periodo_academico TEXT NOT NULL,
    carrera TEXT DEFAULT 'Medicina',
    edificio TEXT DEFAULT 'Edificio B1',
    aula TEXT DEFAULT 'Laboratorio de Histología',
    cupos_maximos INTEGER DEFAULT 30,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.secciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en secciones" ON public.secciones;
CREATE POLICY "Acceso total para API en secciones" ON public.secciones FOR ALL TO public USING (true) WITH CHECK (true);

-- 3. TABLA DE TEMARIO DE LABORATORIO
CREATE TABLE IF NOT EXISTS public.temario (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    titulo TEXT NOT NULL,
    carrera TEXT DEFAULT 'Medicina',
    semana INTEGER DEFAULT 1,
    numero_tema INTEGER DEFAULT 1,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.temario ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en temario" ON public.temario;
CREATE POLICY "Acceso total para API en temario" ON public.temario FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_temario_semana ON public.temario(semana);
CREATE INDEX IF NOT EXISTS idx_temario_carrera ON public.temario(carrera);

-- 4. TABLA DE CONFIGURACIÓN DE SEMANAS ACADÉMICAS POR CARRERA
CREATE TABLE IF NOT EXISTS public.configuracion_semanas (
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    numero_semana INT NOT NULL,
    nombre_semana TEXT DEFAULT '',
    parcial TEXT NOT NULL,
    temas TEXT DEFAULT '',
    es_examen BOOLEAN DEFAULT false,
    fecha_inicio DATE,
    fecha_fin DATE,
    es_semana_actual BOOLEAN DEFAULT false,
    descripcion TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (carrera, numero_semana)
);

ALTER TABLE public.configuracion_semanas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en configuracion_semanas" ON public.configuracion_semanas;
CREATE POLICY "Acceso total para API en configuracion_semanas" ON public.configuracion_semanas FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_config_semanas_carrera ON public.configuracion_semanas(carrera);

-- ==============================================================================
-- 🎓 5 TABLAS DE ESTUDIANTES POR CARRERA (MODELO JSONB FLEXIBLE)
-- ==============================================================================

-- 1. MEDICINA
CREATE TABLE IF NOT EXISTS public.estudiantes_medicina (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(6,3) DEFAULT 0.000,
    primer_examen NUMERIC(6,3) DEFAULT 0.000,
    segundo_examen NUMERIC(6,3) DEFAULT 0.000,
    tercer_examen NUMERIC(6,3) DEFAULT 0.000,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_est_med_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);
ALTER TABLE public.estudiantes_medicina ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_medicina" ON public.estudiantes_medicina;
CREATE POLICY "Acceso total API estudiantes_medicina" ON public.estudiantes_medicina FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_med_seccion ON public.estudiantes_medicina(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_med_cuenta ON public.estudiantes_medicina(numero_cuenta);

-- 2. ENFERMERÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_enfermeria (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(6,3) DEFAULT 0.000,
    primer_examen NUMERIC(6,3) DEFAULT 0.000,
    segundo_examen NUMERIC(6,3) DEFAULT 0.000,
    tercer_examen NUMERIC(6,3) DEFAULT 0.000,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_est_enf_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);
ALTER TABLE public.estudiantes_enfermeria ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_enfermeria" ON public.estudiantes_enfermeria;
CREATE POLICY "Acceso total API estudiantes_enfermeria" ON public.estudiantes_enfermeria FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_enf_seccion ON public.estudiantes_enfermeria(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_enf_cuenta ON public.estudiantes_enfermeria(numero_cuenta);

-- 3. ODONTOLOGÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_odontologia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(6,3) DEFAULT 0.000,
    primer_examen NUMERIC(6,3) DEFAULT 0.000,
    segundo_examen NUMERIC(6,3) DEFAULT 0.000,
    tercer_examen NUMERIC(6,3) DEFAULT 0.000,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_est_odo_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);
ALTER TABLE public.estudiantes_odontologia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_odontologia" ON public.estudiantes_odontologia;
CREATE POLICY "Acceso total API estudiantes_odontologia" ON public.estudiantes_odontologia FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_odo_seccion ON public.estudiantes_odontologia(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_odo_cuenta ON public.estudiantes_odontologia(numero_cuenta);

-- 4. MICROBIOLOGÍA
CREATE TABLE IF NOT EXISTS public.estudiantes_microbiologia (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(6,3) DEFAULT 0.000,
    primer_examen NUMERIC(6,3) DEFAULT 0.000,
    segundo_examen NUMERIC(6,3) DEFAULT 0.000,
    tercer_examen NUMERIC(6,3) DEFAULT 0.000,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_est_mic_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);
ALTER TABLE public.estudiantes_microbiologia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_microbiologia" ON public.estudiantes_microbiologia;
CREATE POLICY "Acceso total API estudiantes_microbiologia" ON public.estudiantes_microbiologia FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_mic_seccion ON public.estudiantes_microbiologia(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_mic_cuenta ON public.estudiantes_microbiologia(numero_cuenta);

-- 5. NUTRICIÓN
CREATE TABLE IF NOT EXISTS public.estudiantes_nutricion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT NOT NULL,
    contrasena TEXT DEFAULT 'histolab123',
    notas JSONB DEFAULT '{}'::jsonb,
    asistencias JSONB DEFAULT '{}'::jsonb,
    total NUMERIC(6,3) DEFAULT 0.000,
    primer_examen NUMERIC(6,3) DEFAULT 0.000,
    segundo_examen NUMERIC(6,3) DEFAULT 0.000,
    tercer_examen NUMERIC(6,3) DEFAULT 0.000,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_est_nut_seccion_cuenta UNIQUE (seccion_id, numero_cuenta)
);
ALTER TABLE public.estudiantes_nutricion ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total API estudiantes_nutricion" ON public.estudiantes_nutricion;
CREATE POLICY "Acceso total API estudiantes_nutricion" ON public.estudiantes_nutricion FOR ALL TO public USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_est_nut_seccion ON public.estudiantes_nutricion(seccion_id);
CREATE INDEX IF NOT EXISTS idx_est_nut_cuenta ON public.estudiantes_nutricion(numero_cuenta);

-- ==============================================================================
-- 📋 6. TABLA DE ASIGNACIONES DE INSTRUCTORES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.asignaciones_instructores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    instructor_id UUID REFERENCES public.instructores(id) ON DELETE SET NULL,
    tipo_asignacion TEXT NOT NULL, -- 'examen', 'prueba_semanal', 'manual', 'asistencia'
    referencia_id TEXT NOT NULL, -- Ej: 'semana_1', 'tema_2', 'examen_I'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_asignacion_seccion UNIQUE (seccion_id, tipo_asignacion, referencia_id)
);

ALTER TABLE public.asignaciones_instructores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en asignaciones_instructores" ON public.asignaciones_instructores;
CREATE POLICY "Acceso total para API en asignaciones_instructores" ON public.asignaciones_instructores FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_asignaciones_seccion ON public.asignaciones_instructores(seccion_id);

-- ==============================================================================
-- 📝 7. TABLA DE PRUEBAS SEMANALES (PREGUNTAS Y REACTIVOS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pruebas_semanales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    numero_semana INTEGER NOT NULL,
    titulo TEXT,
    descripcion TEXT,
    tiempo_limite_minutos INTEGER DEFAULT 15,
    publicada BOOLEAN DEFAULT false,
    preguntas JSONB NOT NULL DEFAULT '[]'::jsonb,
    instructor_id UUID REFERENCES public.instructores(id) ON DELETE SET NULL,
    instructor_nombre TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_prueba_seccion_semana UNIQUE (seccion_id, numero_semana)
);

ALTER TABLE public.pruebas_semanales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en pruebas_semanales" ON public.pruebas_semanales;
CREATE POLICY "Acceso total para API en pruebas_semanales" ON public.pruebas_semanales FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_pruebas_seccion ON public.pruebas_semanales(seccion_id);
CREATE INDEX IF NOT EXISTS idx_pruebas_semana ON public.pruebas_semanales(numero_semana);
CREATE INDEX IF NOT EXISTS idx_pruebas_carrera ON public.pruebas_semanales(carrera);

-- 📝 7.1 TABLA DE ENTREGAS DE PRUEBAS SEMANALES POR ALUMNOS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.entregas_pruebas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.pruebas_semanales(id) ON DELETE CASCADE,
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    numero_semana INTEGER NOT NULL,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT,
    respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'enviado', -- 'enviado' | 'calificado'
    nota_obtenida NUMERIC(6,3) DEFAULT NULL,
    comentarios TEXT DEFAULT '',
    calificado_por TEXT DEFAULT '',
    fecha_envio TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_entrega_seccion_semana_cuenta UNIQUE (seccion_id, numero_semana, numero_cuenta)
);

ALTER TABLE public.entregas_pruebas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en entregas_pruebas" ON public.entregas_pruebas;
CREATE POLICY "Acceso total para API en entregas_pruebas" ON public.entregas_pruebas FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_entregas_seccion ON public.entregas_pruebas(seccion_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cuenta ON public.entregas_pruebas(numero_cuenta);
CREATE INDEX IF NOT EXISTS idx_entregas_carrera ON public.entregas_pruebas(carrera);


-- ==============================================================================
-- 🎯 8. TABLA DE CONFIGURACIÓN DE PUNTAJES POR CARRERA
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.configuracion_puntajes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carrera TEXT NOT NULL UNIQUE,
    nota_total_manuales NUMERIC(6,3) DEFAULT 0.000,
    nota_total_pruebas NUMERIC(6,3) DEFAULT 0.000,
    examenes JSONB DEFAULT '{}'::jsonb, -- Ej: {"2": 25.000, "4": 25.000}
    puntaje_total NUMERIC(6,3) DEFAULT 100.000,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.configuracion_puntajes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en configuracion_puntajes" ON public.configuracion_puntajes;
CREATE POLICY "Acceso total para API en configuracion_puntajes" ON public.configuracion_puntajes FOR ALL TO public USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_config_puntajes_carrera ON public.configuracion_puntajes(carrera);


