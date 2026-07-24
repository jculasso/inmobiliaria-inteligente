-- AlterTable: teléfono de contacto del agente (aparece en el header del informe).
ALTER TABLE "usuario" ADD COLUMN "telefono" TEXT;

-- AlterTable: años de antigüedad del comparable (se muestra en el informe).
ALTER TABLE "tasacion_comparable" ADD COLUMN "antiguedad" INTEGER;
