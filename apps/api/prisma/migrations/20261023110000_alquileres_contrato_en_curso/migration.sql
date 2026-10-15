-- Contratos tomados en curso y sellado por MiPyme (reglas 103 y 104 de
-- docs/specs/alquileres-fase-1.md; Florencia, Vacker, 15/10/2026).
--
-- Dos columnas nuevas en una tabla que ya existe. `alq_contrato` conserva su
-- `tenant_id`, su policy `tenant_isolation` y sus permisos (los de
-- 20261006100000_alquileres_contratos): nada de eso se toca acá.
--
-- NO hay UPDATE: ninguna fila existente cambia de contenido.
-- - `administrado_desde` nace NULL en todos los contratos, que quiere decir
--   «se administra desde el inicio»: exactamente lo que hacían hasta hoy.
-- - `inquilino_mipyme` nace en false: un default constante, así que Postgres
--   no reescribe la tabla (metadato, no un UPDATE de cada fila).
--
-- La API vieja tolera las dos: no las lee ni las escribe, y al crear un
-- contrato la base completa los defaults.

-- Desde cuándo administra la inmobiliaria un contrato que ya estaba en curso
-- (regla 104). Antes de esa fecha no se genera nada: ni alquiler ni deuda.
ALTER TABLE "alq_contrato" ADD COLUMN "administrado_desde" DATE;

-- El inquilino tiene certificado MiPyme: en un contrato comercial baja la
-- alícuota del sellado (regla 103).
ALTER TABLE "alq_contrato" ADD COLUMN "inquilino_mipyme" BOOLEAN NOT NULL DEFAULT false;
