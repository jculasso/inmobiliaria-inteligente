-- Alquileres, entrega C (Florencia, Vacker, 15/10/2026): el inventario del
-- contrato y la reserva antes del contrato. Reglas 150 a 168 de
-- docs/specs/alquileres-fase-1.md.
--
-- NO hace ningún UPDATE: las columnas nuevas de tablas que ya existen entran
-- con su valor por defecto (Postgres 11+ no reescribe la tabla) o vacías, y
-- las dos tablas nuevas arrancan sin filas. Todo lo nuevo es opcional o tiene
-- default, así que la API vieja la tolera si se aplica antes del deploy.

-- 1. El inventario del contrato (reglas 150 a 153). Un contrato cargado antes
--    queda con la lista vacía y sin observaciones. `alq_contrato` conserva su
--    `tenant_id`, su policy y sus permisos: nada de eso se toca.

ALTER TABLE "alq_contrato" ADD COLUMN "inventario" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN "inventario_obs" TEXT;

-- 2. Las plantillas son de contrato o de reserva (regla 162). Las que ya
--    existen son de contrato.

ALTER TABLE "alq_plantilla" ADD COLUMN "documento" TEXT NOT NULL DEFAULT 'contrato';

-- 3. La reserva y sus partes (reglas 154 a 158).

CREATE TABLE "alq_reserva" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "numero" INTEGER NOT NULL,
    "propiedad_id" UUID NOT NULL,
    "fecha" DATE NOT NULL,
    "vence" DATE NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'reservada',
    "sena_importe" DECIMAL(14,2),
    "sena_moneda" TEXT,
    "tipo" TEXT NOT NULL DEFAULT 'vivienda',
    "moneda" TEXT NOT NULL DEFAULT 'ARS',
    "alquiler_inicial" DECIMAL(14,2),
    "inicio" DATE,
    "duracion_meses" INTEGER,
    "ajuste" TEXT NOT NULL DEFAULT 'indexado',
    "indice" TEXT,
    "periodicidad_meses" INTEGER,
    "deposito_importe" DECIMAL(14,2),
    "deposito_moneda" TEXT,
    "obs" TEXT,
    "motivo" TEXT,
    "contrato_id" UUID,
    "creado_por_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "alq_reserva_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "alq_reserva_parte" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "reserva_id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "papel" TEXT NOT NULL,

    CONSTRAINT "alq_reserva_parte_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alq_reserva_contrato_id_key" ON "alq_reserva"("contrato_id");
CREATE INDEX "alq_reserva_tenant_id_idx" ON "alq_reserva"("tenant_id");
CREATE INDEX "alq_reserva_tenant_id_estado_idx" ON "alq_reserva"("tenant_id", "estado");
CREATE INDEX "alq_reserva_propiedad_id_idx" ON "alq_reserva"("propiedad_id");
CREATE UNIQUE INDEX "alq_reserva_tenant_id_numero_key" ON "alq_reserva"("tenant_id", "numero");
CREATE INDEX "alq_reserva_parte_tenant_id_idx" ON "alq_reserva_parte"("tenant_id");
CREATE INDEX "alq_reserva_parte_persona_id_idx" ON "alq_reserva_parte"("persona_id");
CREATE UNIQUE INDEX "alq_reserva_parte_reserva_id_persona_id_papel_key" ON "alq_reserva_parte"("reserva_id", "persona_id", "papel");

-- Regla 156: una propiedad tiene a lo sumo UNA reserva abierta. Lo garantiza
-- la base, no un `if` que dos pedidos simultáneos podrían pasar los dos.
-- Prisma no sabe declarar un índice parcial: vive solo acá. Los estados son
-- `ESTADOS_RESERVA_ABIERTOS` de @vacker/types.
CREATE UNIQUE INDEX "alq_reserva_propiedad_abierta_key" ON "alq_reserva" ("tenant_id", "propiedad_id")
  WHERE "estado" IN ('reservada', 'en_estudio', 'aprobada');

ALTER TABLE "alq_reserva" ADD CONSTRAINT "alq_reserva_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alq_reserva" ADD CONSTRAINT "alq_reserva_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "alq_propiedad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- Regla 160: si se borra el contrato en borrador, la reserva queda sin él (y
-- la API la devuelve a «aprobada» en la misma transacción).
ALTER TABLE "alq_reserva" ADD CONSTRAINT "alq_reserva_contrato_id_fkey" FOREIGN KEY ("contrato_id") REFERENCES "alq_contrato"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "alq_reserva_parte" ADD CONSTRAINT "alq_reserva_parte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alq_reserva_parte" ADD CONSTRAINT "alq_reserva_parte_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "alq_reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alq_reserva_parte" ADD CONSTRAINT "alq_reserva_parte_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "alq_persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 4. Las garantías del estudio (regla 157): el mismo modelo e informe que las
--    del contrato, apuntando a la reserva. Una garantía es de un contrato o
--    de una reserva, nunca de los dos ni de ninguno: al convertir se COPIAN
--    las aprobadas al contrato (regla 159), y la de la reserva queda como
--    registro del estudio. Así «Garantías» del contrato, que se guarda
--    entera (borra y vuelve a crear las del contrato), no puede tocar nunca
--    las de la reserva.
--
--    Las filas que ya existen tienen `contrato_id` y no `reserva_id`: cumplen
--    el CHECK. NOT VALID + VALIDATE: el control de lo existente no bloquea
--    escrituras mientras corre.

ALTER TABLE "alq_garantia" ADD COLUMN "reserva_id" UUID,
ALTER COLUMN "contrato_id" DROP NOT NULL;

CREATE INDEX "alq_garantia_reserva_id_idx" ON "alq_garantia"("reserva_id");

ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "alq_reserva"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_de_contrato_o_reserva" CHECK (num_nonnulls("contrato_id", "reserva_id") = 1) NOT VALID;
ALTER TABLE "alq_garantia" VALIDATE CONSTRAINT "alq_garantia_de_contrato_o_reserva";

-- 5. Con la inmobiliaria adelante, como el resto de las relaciones
--    (20261017110000_claves_foraneas_por_inmobiliaria): Postgres controla las
--    claves foráneas sin RLS, y la simple aceptaría la propiedad, la persona
--    o el contrato de OTRA inmobiliaria. Se crean después de las simples:
--    al borrar un contrato, aquella deja `contrato_id` en NULL antes de que
--    esta se controle.

CREATE UNIQUE INDEX "alq_reserva_tenant_id_id_key" ON "alq_reserva" ("tenant_id", "id");

ALTER TABLE "alq_reserva" ADD CONSTRAINT "alq_reserva_propiedad_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "propiedad_id") REFERENCES "alq_propiedad" ("tenant_id", "id");
ALTER TABLE "alq_reserva" ADD CONSTRAINT "alq_reserva_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id");
ALTER TABLE "alq_reserva_parte" ADD CONSTRAINT "alq_reserva_parte_reserva_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "reserva_id") REFERENCES "alq_reserva" ("tenant_id", "id");
ALTER TABLE "alq_reserva_parte" ADD CONSTRAINT "alq_reserva_parte_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id");
ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_reserva_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "reserva_id") REFERENCES "alq_reserva" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_garantia" VALIDATE CONSTRAINT "alq_garantia_reserva_id_mismo_tenant_fkey";

-- 6. La seña en la cuenta corriente (reglas 169 a 171): el concepto de la
--    seña, el de la seña retenida que se le entrega al propietario y el
--    reintegro de lo que sobra al convertir dicen de qué reserva salen. Una
--    columna nueva, vacía en todas las filas que ya existen; `alq_concepto`
--    conserva su `tenant_id`, su policy y sus permisos.

ALTER TABLE "alq_concepto" ADD COLUMN "reserva_id" UUID;

CREATE INDEX "alq_concepto_reserva_id_idx" ON "alq_concepto"("reserva_id");

ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "alq_reserva"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_reserva_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "reserva_id") REFERENCES "alq_reserva" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_reserva_id_mismo_tenant_fkey";

-- 7. RLS: cada inmobiliaria ve solo lo suyo. Revocar antes de otorgar:
--    Supabase le da TRUNCATE a `anon` y `authenticated` en cada tabla nueva,
--    y TRUNCATE ignora RLS (CONVENCIONES_TECNICAS.md §1).

REVOKE ALL ON "alq_reserva" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_reserva" TO authenticated;
ALTER TABLE "alq_reserva" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_reserva"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);

REVOKE ALL ON "alq_reserva_parte" FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "alq_reserva_parte" TO authenticated;
ALTER TABLE "alq_reserva_parte" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "alq_reserva_parte"
  USING ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK ("tenant_id" = nullif(current_setting('app.tenant_id', true), '')::uuid);
