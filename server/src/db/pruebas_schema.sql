-- ==============================================================================
-- 🔬 HISTOLAB - SISTEMA DE PRUEBAS SEMANALES DIGITALES (MIGRACIÓN SUPABASE)
-- ==============================================================================
-- Este script actualiza o crea las tablas adaptándolas a la estructura completa.
-- Si la tabla pruebas_semanales ya existía previamente sin la columna 'carrera',
-- este script agrega todas las columnas faltantes de manera segura.
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 📋 1. TABLA: pruebas_semanales (Crear si no existe y asegurar columnas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.pruebas_semanales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    numero_semana INTEGER NOT NULL,
    titulo TEXT DEFAULT '',
    descripcion TEXT DEFAULT '',
    instrucciones TEXT DEFAULT '',
    tiempo_limite_minutos INTEGER DEFAULT 15,
    puntaje_total NUMERIC(6,3) DEFAULT 5.000,
    publicada BOOLEAN DEFAULT false,
    estado TEXT NOT NULL DEFAULT 'borrador',
    preguntas JSONB NOT NULL DEFAULT '[]'::jsonb,
    instructor_id UUID REFERENCES public.instructores(id) ON DELETE SET NULL,
    instructor_nombre TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_prueba_seccion_semana UNIQUE (seccion_id, numero_semana)
);

-- Si la tabla ya existía de antes con columnas antiguas, agregar las nuevas columnas:
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS carrera TEXT NOT NULL DEFAULT 'Medicina';
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS titulo TEXT DEFAULT '';
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS descripcion TEXT DEFAULT '';
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS instrucciones TEXT DEFAULT '';
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS tiempo_limite_minutos INTEGER DEFAULT 15;
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS puntaje_total NUMERIC(6,3) DEFAULT 5.000;
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS publicada BOOLEAN DEFAULT false;
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'borrador';
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS preguntas JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.pruebas_semanales ADD COLUMN IF NOT EXISTS instructor_nombre TEXT DEFAULT '';

-- Índices de pruebas_semanales
CREATE INDEX IF NOT EXISTS idx_pruebas_seccion ON public.pruebas_semanales(seccion_id);
CREATE INDEX IF NOT EXISTS idx_pruebas_semana ON public.pruebas_semanales(numero_semana);
CREATE INDEX IF NOT EXISTS idx_pruebas_carrera ON public.pruebas_semanales(carrera);
CREATE INDEX IF NOT EXISTS idx_pruebas_estado ON public.pruebas_semanales(estado);

-- ==============================================================================
-- 📝 2. TABLA: entregas_pruebas (Crear si no existe y asegurar columnas)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.entregas_pruebas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES public.pruebas_semanales(id) ON DELETE CASCADE,
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    numero_semana INTEGER NOT NULL,
    numero_cuenta TEXT NOT NULL,
    nombre_completo TEXT DEFAULT '',
    respuestas JSONB NOT NULL DEFAULT '{}'::jsonb,
    estado TEXT NOT NULL DEFAULT 'enviado',
    nota_obtenida NUMERIC(6,3) DEFAULT NULL,
    comentarios TEXT DEFAULT '',
    calificado_por TEXT DEFAULT '',
    fecha_envio TIMESTAMPTZ DEFAULT NOW(),
    auditoria JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_entrega_seccion_semana_cuenta UNIQUE (seccion_id, numero_semana, numero_cuenta)
);

-- Si la tabla entregas_pruebas ya existía, asegurar sus columnas:
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS carrera TEXT NOT NULL DEFAULT 'Medicina';
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.pruebas_semanales(id) ON DELETE CASCADE;
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS nombre_completo TEXT DEFAULT '';
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS respuestas JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'enviado';
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS nota_obtenida NUMERIC(6,3) DEFAULT NULL;
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS comentarios TEXT DEFAULT '';
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS calificado_por TEXT DEFAULT '';
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS fecha_envio TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.entregas_pruebas ADD COLUMN IF NOT EXISTS auditoria JSONB DEFAULT '{}'::jsonb;

-- Índices de entregas_pruebas
CREATE INDEX IF NOT EXISTS idx_entregas_seccion ON public.entregas_pruebas(seccion_id);
CREATE INDEX IF NOT EXISTS idx_entregas_cuenta ON public.entregas_pruebas(numero_cuenta);
CREATE INDEX IF NOT EXISTS idx_entregas_semana ON public.entregas_pruebas(numero_semana);
CREATE INDEX IF NOT EXISTS idx_entregas_carrera ON public.entregas_pruebas(carrera);
CREATE INDEX IF NOT EXISTS idx_entregas_estado ON public.entregas_pruebas(estado);

-- ==============================================================================
-- 🛡️ 3. POLÍTICAS RLS DE SEGURIDAD
-- ==============================================================================
ALTER TABLE public.pruebas_semanales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en pruebas_semanales" ON public.pruebas_semanales;
CREATE POLICY "Acceso total para API en pruebas_semanales" 
    ON public.pruebas_semanales 
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

ALTER TABLE public.entregas_pruebas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Acceso total para API en entregas_pruebas" ON public.entregas_pruebas;
CREATE POLICY "Acceso total para API en entregas_pruebas" 
    ON public.entregas_pruebas 
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

-- ==============================================================================
-- 🔄 4. TRIGGER PARA AUTO-ACTUALIZAR updated_at
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS trg_update_pruebas_semanales_updated_at ON public.pruebas_semanales;
CREATE TRIGGER trg_update_pruebas_semanales_updated_at
    BEFORE UPDATE ON public.pruebas_semanales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_update_entregas_pruebas_updated_at ON public.entregas_pruebas;
CREATE TRIGGER trg_update_entregas_pruebas_updated_at
    BEFORE UPDATE ON public.entregas_pruebas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
