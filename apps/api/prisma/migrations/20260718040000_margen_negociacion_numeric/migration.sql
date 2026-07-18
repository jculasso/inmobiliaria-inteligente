-- AlterTable
ALTER TABLE "tasacion" ALTER COLUMN "margen_negociacion" TYPE DECIMAL(5,2) USING NULLIF("margen_negociacion", '')::DECIMAL(5,2);
