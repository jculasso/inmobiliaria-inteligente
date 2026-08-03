-- SABOTAJE: tabla de negocio que nace sin RLS. La guardia tiene que verla.
CREATE TABLE "nota_suelta" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_id" UUID NOT NULL,
  "texto" TEXT NOT NULL,
  CONSTRAINT "nota_suelta_pkey" PRIMARY KEY ("id")
);
