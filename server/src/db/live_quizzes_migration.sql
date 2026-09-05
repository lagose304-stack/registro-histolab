-- ==============================================================================
-- 📡 HISTOLAB: MIGRACIÓN SQL PARA EL SISTEMA DE PRUEBAS EN VIVO SINCRONIZADAS
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu consola Supabase.
-- Este script es 100% idempotente y seguro de ejecutar (usa IF NOT EXISTS).
-- ==============================================================================

-- 1. TABLA pruebas_semanales: Campos para el tiempo individual por pregunta y control en vivo
ALTER TABLE public.pruebas_semanales 
ADD COLUMN IF NOT EXISTS tiempo_por_pregunta_segundos INTEGER DEFAULT 90;

ALTER TABLE public.pruebas_semanales 
ADD COLUMN IF NOT EXISTS control_en_vivo BOOLEAN DEFAULT true;

ALTER TABLE public.pruebas_semanales 
ADD COLUMN IF NOT EXISTS habilitada_en_vivo BOOLEAN DEFAULT false;

-- Comentarios explicativos
COMMENT ON COLUMN public.pruebas_semanales.tiempo_por_pregunta_segundos 
IS 'Duración límite en segundos asignada individualmente a cada pregunta (por defecto 90s = 1:30 min)';

COMMENT ON COLUMN public.pruebas_semanales.control_en_vivo 
IS 'Indica si la prueba utiliza el protocolo de sincronización y control de transmisión en vivo';

COMMENT ON COLUMN public.pruebas_semanales.habilitada_en_vivo 
IS 'Indica si el docente habilitó el acceso a la prueba en directo para los estudiantes';


-- ==============================================================================
-- ⚡ 2. TABLA: sesiones_pruebas_en_vivo
-- Almacena el estado en tiempo real de la transmisión y sincronización docente-alumnos
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.sesiones_pruebas_en_vivo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    seccion_id UUID NOT NULL REFERENCES public.secciones(id) ON DELETE CASCADE,
    numero_semana INTEGER NOT NULL,
    carrera TEXT NOT NULL DEFAULT 'Medicina',
    estado TEXT NOT NULL DEFAULT 'inactiva' 
        CHECK (estado IN ('inactiva', 'lobby', 'en_pregunta', 'esperando_siguiente', 'finalizada')),
    habilitada BOOLEAN NOT NULL DEFAULT false,
    pregunta_actual_idx INTEGER NOT NULL DEFAULT 0,
    duracion_segundos INTEGER NOT NULL DEFAULT 90,
    pregunta_inicio_timestamp BIGINT DEFAULT NULL,
    alumnos_conectados JSONB NOT NULL DEFAULT '{}'::jsonb,
    respuestas_globales JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_sesion_live_seccion_semana UNIQUE (seccion_id, numero_semana)
);

-- Índices de alto rendimiento para sesiones en vivo
CREATE INDEX IF NOT EXISTS idx_sesiones_live_lookup 
ON public.sesiones_pruebas_en_vivo(seccion_id, numero_semana);

CREATE INDEX IF NOT EXISTS idx_sesiones_live_estado 
ON public.sesiones_pruebas_en_vivo(estado);

-- ==============================================================================
-- 📝 3. TABLA entregas_pruebas: Auditoría de rezagados y preguntas sin responder
-- ==============================================================================
ALTER TABLE public.entregas_pruebas 
ADD COLUMN IF NOT EXISTS preguntas_omitidas JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.entregas_pruebas 
ADD COLUMN IF NOT EXISTS motivo_entrega TEXT DEFAULT 'normal';

ALTER TABLE public.entregas_pruebas 
ADD COLUMN IF NOT EXISTS duracion_total_segundos INTEGER DEFAULT 0;

COMMENT ON COLUMN public.entregas_pruebas.preguntas_omitidas 
IS 'Lista de índices de preguntas que el alumno perdió por ingresar tarde o por vencimiento de tiempo';

COMMENT ON COLUMN public.entregas_pruebas.motivo_entrega 
IS 'Motivo de finalización (normal, finalizada_por_docente, tiempo_agotado, infracciones_seguridad)';


-- ==============================================================================
-- 🛡️ 4. POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ==============================================================================
ALTER TABLE public.sesiones_pruebas_en_vivo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total para API en sesiones_pruebas_en_vivo" 
ON public.sesiones_pruebas_en_vivo;

CREATE POLICY "Acceso total para API en sesiones_pruebas_en_vivo" 
ON public.sesiones_pruebas_en_vivo 
FOR ALL 
USING (true) 
WITH CHECK (true);
