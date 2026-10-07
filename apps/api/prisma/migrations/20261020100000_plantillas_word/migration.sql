-- Plantillas de contrato en Word (pedido de Javier, 7/10/2026).
--
-- La inmobiliaria sube su propio contrato como .docx con marcadores {así}, y
-- desde cada contrato se descarga completo. Reemplaza al editor de texto y al
-- PDF generado desde la plantilla.
--
-- Solo columnas nuevas en una tabla que ya existe: `alq_plantilla` conserva
-- su `tenant_id`, su policy `tenant_isolation` y sus permisos (los de
-- 20261014100000_alquileres_plantillas_reclamos). Nada de eso se toca acá.
--
-- `cuerpo` pasa a ser opcional y NO se borra: las plantillas de texto que ya
-- existen quedan en la lista, avisando que hay que subir la versión en Word,
-- y se pueden borrar desde la pantalla.

ALTER TABLE "alq_plantilla" ALTER COLUMN "cuerpo" DROP NOT NULL;

ALTER TABLE "alq_plantilla"
  ADD COLUMN "archivo" TEXT,
  ADD COLUMN "nombre_archivo" TEXT,
  ADD COLUMN "tamano" INTEGER,
  ADD COLUMN "archivo_subido_el" TIMESTAMPTZ(6);

-- Una plantilla es un Word o un texto del editor anterior: nunca ninguna de
-- las dos cosas.
ALTER TABLE "alq_plantilla"
  ADD CONSTRAINT "alq_plantilla_word_o_texto"
  CHECK ("archivo" IS NOT NULL OR "cuerpo" IS NOT NULL);
