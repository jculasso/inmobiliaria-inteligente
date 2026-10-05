-- Módulo Alquileres — entrega 3 (contratos).
--
-- Lo que apareció al relevar Gexion el 5/10/2026 y no estaba en la primera
-- migración. Solo agrega columnas con default a una tabla que todavía está
-- vacía en producción: la API anterior no las conoce y no le molestan.

-- Al propietario se le paga otro día que el que vence el inquilino (10 y 5
-- en Vacker). Regla 37 de la spec.
ALTER TABLE "alq_contrato" ADD COLUMN "dia_pago_propietario" INTEGER NOT NULL DEFAULT 10;

-- El vencimiento del inquilino por defecto es el 5, como en Vacker.
ALTER TABLE "alq_contrato" ALTER COLUMN "dia_vencimiento" SET DEFAULT 5;
