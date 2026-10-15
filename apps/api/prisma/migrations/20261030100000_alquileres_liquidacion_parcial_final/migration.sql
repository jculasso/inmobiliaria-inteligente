-- Liquidación parcial y final cuando el índice sale atrasado (spec
-- alquileres-fase-1.md, reglas 130 a 141).
--
-- Florencia (Vacker), 15/10/2026: «IPC sale atrasado, podemos hacer una
-- liquidación provisoria ya que se espera el índice […] y luego cuando sale el
-- índice se hace la liquidación definitiva y el inquilino paga el saldo».
--
-- Dos columnas en `alq_concepto`, las dos opcionales:
--   - `etapa`: 'parcial' (se generó con el importe del tramo anterior porque
--     el índice no había salido) o 'final' (la diferencia, cuando salió).
--   - `tramo_numero`: el número del tramo del contrato al que pertenecen. Es
--     el número y no el id del tramo a propósito: (contrato, número) es único
--     y no cambia, mientras que los tramos de un borrador se borran y se
--     vuelven a crear.
--
-- No toca ninguna fila existente: todo lo generado hasta hoy queda con las dos
-- columnas en NULL, que es exactamente lo que es (un mes normal). La API vieja
-- no las conoce y sigue funcionando igual. La tabla ya tiene RLS y su policy;
-- columnas nuevas no cambian eso.

ALTER TABLE "alq_concepto" ADD COLUMN "etapa" TEXT;
ALTER TABLE "alq_concepto" ADD COLUMN "tramo_numero" INTEGER;

-- Una etapa es de un tramo de un contrato, y solo puede ser una de las dos.
-- NOT VALID + VALIDATE, como en 20261017110000: el control de lo existente
-- (todo NULL) no bloquea escrituras mientras corre.
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_etapa_check"
  CHECK ("etapa" IS NULL OR ("etapa" IN ('parcial', 'final') AND "tramo_numero" IS NOT NULL AND "contrato_id" IS NOT NULL))
  NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_etapa_check";

-- Al confirmar la indexación se buscan las parciales de ese tramo: por
-- contrato y tramo, sin recorrer los conceptos de la inmobiliaria.
CREATE INDEX "alq_concepto_contrato_id_tramo_numero_idx" ON "alq_concepto"("contrato_id", "tramo_numero");
