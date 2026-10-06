-- Módulo Alquileres — entrega 7 (liquidaciones al propietario).
--
-- Solo agrega columnas a `alq_liquidacion`, que está vacía en producción.

-- Número correlativo por inmobiliaria, como el de los recibos.
ALTER TABLE "alq_liquidacion" ADD COLUMN "numero" INTEGER NOT NULL;
CREATE UNIQUE INDEX "alq_liquidacion_tenant_id_numero_key" ON "alq_liquidacion"("tenant_id", "numero");

-- Cómo se le pagó al propietario.
ALTER TABLE "alq_liquidacion" ADD COLUMN "medio" TEXT NOT NULL DEFAULT 'transferencia';

-- El detalle tal como se liquidó: cada concepto con su importe. Los conceptos
-- apuntan a la liquidación mientras está vigente; si se anula, se sueltan para
-- poder liquidarse de nuevo, y el detalle es lo que queda para que el PDF de la
-- anulada siga diciendo lo mismo (regla 19).
ALTER TABLE "alq_liquidacion" ADD COLUMN "detalle" JSONB NOT NULL;
