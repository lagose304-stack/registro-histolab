-- ==============================================================================
-- 🏆 HISTOLAB: MIGRACIÓN SQL PARA EL LISTADO PARALELO DE NOTAS CON BONUS
-- ==============================================================================
-- Ejecuta este script en el SQL Editor de tu consola Supabase.
-- Agrega de forma idempotente (IF NOT EXISTS) las columnas e índices necesarios
-- para respaldar el puntaje real con bonus acumulable para "Premios de la Sección".
-- ==============================================================================

-- 1. TABLA entregas_pruebas: Columnas para la nota real sin tope y nota con bonus
ALTER TABLE public.entregas_pruebas 
ADD COLUMN IF NOT EXISTS nota_real NUMERIC(6,3) DEFAULT NULL;

ALTER TABLE public.entregas_pruebas 
ADD COLUMN IF NOT EXISTS nota_con_bonus NUMERIC(6,3) DEFAULT NULL;

-- 2. TABLA pruebas_semanales: Indicador a nivel de prueba sobre disponibilidad de reactivo bonus
ALTER TABLE public.pruebas_semanales 
ADD COLUMN IF NOT EXISTS tiene_bonus BOOLEAN DEFAULT true;

ALTER TABLE public.pruebas_semanales 
ADD COLUMN IF NOT EXISTS puntaje_maximo_con_bonus NUMERIC(6,3) DEFAULT 6.000;

-- Ajustar restricción de puntaje total si existía para permitir pruebas con reactivo bonus (hasta 6.000 pts)
ALTER TABLE public.pruebas_semanales 
DROP CONSTRAINT IF EXISTS chk_prueba_puntaje_total;

ALTER TABLE public.pruebas_semanales 
ADD CONSTRAINT chk_prueba_puntaje_total 
CHECK (puntaje_total >= 0 AND puntaje_total <= 6.000);

-- 3. ÍNDICES DE RENDIMIENTO: Para consultas ultrarrápidas del podio y ranking
CREATE INDEX IF NOT EXISTS idx_entregas_nota_real 
ON public.entregas_pruebas(nota_real);

CREATE INDEX IF NOT EXISTS idx_entregas_seccion_semana 
ON public.entregas_pruebas(seccion_id, numero_semana);

CREATE INDEX IF NOT EXISTS idx_entregas_seccion_cuenta 
ON public.entregas_pruebas(seccion_id, numero_cuenta);

-- 4. DOCUMENTACIÓN DE COLUMNAS
COMMENT ON COLUMN public.entregas_pruebas.nota_obtenida IS 'Nota oficial normada con tope máximo de 5.000 pts para el Libro de Calificaciones';
COMMENT ON COLUMN public.entregas_pruebas.nota_real IS 'Nota real acumulada incluyendo reactivo bonus (hasta 6.000 pts) para el Cuadro de Honor y Premios de la Sección';
COMMENT ON COLUMN public.entregas_pruebas.nota_con_bonus IS 'Calificación real con bonus idéntica a nota_real para consultas paralelas y compatibilidad';
COMMENT ON COLUMN public.pruebas_semanales.tiene_bonus IS 'Indica si la prueba contiene reactivo(s) bonus con puntaje adicional opcional';

-- NOTA INFORMATIVA:
-- Las notas por estudiante en las tablas por carrera (estudiantes_medicina, estudiantes_odontologia, etc.)
-- se sincronizan automáticamente dentro de la columna flexible 'notas JSONB':
--   - 'prueba_X': almacena la nota oficial (<= 5.000 pts)
--   - 'prueba_X_real': almacena la nota real con bonus (> 5.000 pts)
