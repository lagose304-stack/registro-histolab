-- ==============================================================================
-- 🔬 HISTOLAB - MIGRACIÓN: SESIÓN ÚNICA CONCURRENTE PARA ESTUDIANTES
-- Agrega columna 'current_session_token' en todas las tablas de carreras
-- ==============================================================================

-- 1. Medicina
ALTER TABLE IF EXISTS public.estudiantes_medicina 
ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;

-- 2. Enfermería
ALTER TABLE IF EXISTS public.estudiantes_enfermeria 
ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;

-- 3. Odontología
ALTER TABLE IF EXISTS public.estudiantes_odontologia 
ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;

-- 4. Microbiología
ALTER TABLE IF EXISTS public.estudiantes_microbiologia 
ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;

-- 5. Nutrición
ALTER TABLE IF EXISTS public.estudiantes_nutricion 
ADD COLUMN IF NOT EXISTS current_session_token TEXT DEFAULT NULL;

-- Índices para optimizar verificación de tokens de sesión
CREATE INDEX IF NOT EXISTS idx_est_med_session ON public.estudiantes_medicina(current_session_token);
CREATE INDEX IF NOT EXISTS idx_est_enf_session ON public.estudiantes_enfermeria(current_session_token);
CREATE INDEX IF NOT EXISTS idx_est_odo_session ON public.estudiantes_odontologia(current_session_token);
CREATE INDEX IF NOT EXISTS idx_est_mic_session ON public.estudiantes_microbiologia(current_session_token);
CREATE INDEX IF NOT EXISTS idx_est_nut_session ON public.estudiantes_nutricion(current_session_token);
