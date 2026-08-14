-- Cada inmobiliaria tasa con su criterio: cuánto pesa un metro semicubierto y
-- uno descubierto. Hasta hoy estaba escrito en el código, con el criterio de
-- Vacker (semicubierta entera, descubierta al 30%).
--
-- ADITIVA Y SIN TOCAR UNA FILA. Los valores por defecto son exactamente los que
-- se usaron para calcular todo lo que ya existe, así que las tasaciones
-- cargadas quedan con el criterio con el que se calcularon y ningún número se
-- mueve. Eso es lo que hace que un informe ya entregado siga siendo válido.
--
-- Decimal(4,3) y no (3,2): admite 0,125 si alguna inmobiliaria usa un octavo, y
-- el máximo sigue siendo 1,000.
ALTER TABLE "tasacion"
  ADD COLUMN "coef_semicubierta" DECIMAL(4,3) NOT NULL DEFAULT 1,
  ADD COLUMN "coef_descubierta"  DECIMAL(4,3) NOT NULL DEFAULT 0.3;

-- La configuración de la inmobiliaria vive en `tenant.config`, que es JSON: no
-- necesita columna. Las que no tengan los campos leen el valor por defecto del
-- esquema de Zod, que es el mismo criterio de Vacker.
