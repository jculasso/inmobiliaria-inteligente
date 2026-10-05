-- Módulo Alquileres — entrega 4 (índices).
--
-- Los valores del ICL (BCRA) y del IPC (INDEC) con los que se indexan los
-- contratos. Solo agrega una tabla nueva y vacía.
--
-- Es la ÚNICA tabla del módulo sin tenant_id, a propósito: son datos públicos
-- e iguales para todas las inmobiliarias. Cargarlos por tenant multiplicaría
-- la descarga y permitiría que dos inmobiliarias indexen con valores
-- distintos.
--
-- Lleva RLS igual, con una sola policy de LECTURA: la API, que entra como
-- `authenticated` dentro de withTenant, puede leerla, pero no escribirla. La
-- escribe solo el importador diario, con el rol dueño de la tabla.
-- `rls-habilitada.e2e-spec.ts` la acepta como excepción explícita.

-- CreateTable
CREATE TABLE "indice_valor" (
    "indice" TEXT NOT NULL,
    "fecha" DATE NOT NULL,
    "valor" DECIMAL(18,6) NOT NULL,
    "fuente" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indice_valor_pkey" PRIMARY KEY ("indice","fecha")
);

-- Un valor por índice y fecha: el ICL por día, el IPC por mes (su día 1).
ALTER TABLE "indice_valor" ADD CONSTRAINT "indice_valor_indice_check" CHECK ("indice" IN ('ICL', 'IPC'));
ALTER TABLE "indice_valor" ADD CONSTRAINT "indice_valor_valor_check" CHECK ("valor" > 0);

REVOKE ALL ON "indice_valor" FROM anon, authenticated;
GRANT SELECT ON "indice_valor" TO authenticated;
ALTER TABLE "indice_valor" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura ON "indice_valor" FOR SELECT TO authenticated USING (true);
