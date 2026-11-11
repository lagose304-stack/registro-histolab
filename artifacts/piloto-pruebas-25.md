# Piloto local de pruebas: 25 estudiantes

**Resultado: aprobado en almacenamiento local aislado.**

Se procesaron 441 solicitudes HTTP con 25 sesiones autenticadas ficticias. Hubo 7 rechazos esperados por controles de acceso y ningún error inesperado del servidor.

Se utilizaron las rutas, autenticación, controladores, calificación y persistencia local de la aplicación. Las consultas de identidad y programación se alimentaron de fixtures; los archivos se guardaron en un directorio temporal nuevo. No se usaron cuentas ni datos reales.

## Comprobaciones

- sesiones firmadas y rechazo de acceso anónimo, otra sección, otro alumno y control docente por alumno.
- creación y publicación de una prueba con seis tipos; 25 catálogos sin claves de corrección.
- falta injustificada bloqueada; entrega anticipada rechazada; 25 participantes conectados al lobby.
- seis preguntas con 25 respuestas por ronda, vencimiento real del cronómetro, avances docentes, privacidad y cinco reingresos sin pérdida.
- 25 entregas mixtas, automáticas correctas, pendientes manuales y 50 reintentos sin duplicados ni cambios de respuestas.
- revisión manual incompleta conserva cinco pendientes y no publica una nota definitiva.
- 25 revisiones completas con notas independientes exactas a tres decimales; bonus y tope oficial de 5 respetados.
- 25 comprobantes y 25 fichas académicas coinciden, sin cruces entre estudiantes.
- resumen docente de 25 resultados sin error y sin exponer respuestas en la consulta de premios.
- reinicio de la aplicación: 25 entregas y sus notas permanecen guardadas en archivos temporales reales.

## Notas al terminar y reiniciar

La nota real incluye el bonus; la oficial tiene un máximo de 5.000 puntos. Las notas esperadas se calcularon antes de enviar las respuestas, con valores en milésimas independientes del calificador de la aplicación.

| Estudiante ficticio | Esperada | Oficial guardada | Real con bonus | Coincide |
| --- | ---: | ---: | ---: | --- |
| PILOTO01 | 5.000 | 5.000 | 6.000 | Sí |
| PILOTO02 | 0.000 | 0.000 | 0.000 | Sí |
| PILOTO03 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO04 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO05 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO06 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO07 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO08 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO09 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO10 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO11 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO12 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO13 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO14 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO15 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO16 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO17 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO18 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO19 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO20 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO21 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO22 | 2.834 | 2.834 | 2.834 | Sí |
| PILOTO23 | 4.833 | 4.833 | 4.833 | Sí |
| PILOTO24 | 4.333 | 4.333 | 4.333 | Sí |
| PILOTO25 | 2.834 | 2.834 | 2.834 | Sí |

## Alcance

- No valida Supabase, Cloudflare, Google Auth ni redes/dispositivos reales.
- No prueba reposiciones individuales, indisponibles en almacenamiento local.
- No son 25 navegadores ni una prueba de carga de producción; son 25 sesiones HTTP concurrentes con autenticación y controladores reales.

## Repetir el piloto

Desde la raíz del repositorio:

```
node server/scripts/pilot_quiz_25.mjs --report artifacts/piloto-pruebas-25.json
```

Cada ejecución usa datos temporales nuevos y solo conecta por HTTP a 127.0.0.1. La aplicación se reinicia dentro del piloto para comprobar que las entregas y notas se recuperan del disco.
