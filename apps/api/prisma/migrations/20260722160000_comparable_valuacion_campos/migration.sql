-- Campos nuevos del comparable para la valuación ponderada (tipo, superficies
-- desglosadas, fuente/tipo de precio, fecha de referencia y distancia).
-- Aditivo: columnas nullable o con default → las filas existentes quedan válidas.
-- AlterTable
ALTER TABLE "tasacion_comparable"
  ADD COLUMN     "tipo_comp" TEXT NOT NULL DEFAULT 'Departamento',
  ADD COLUMN     "sup_cubierta" DECIMAL(10,2),
  ADD COLUMN     "sup_semi" DECIMAL(10,2),
  ADD COLUMN     "sup_descubierta" DECIMAL(10,2),
  ADD COLUMN     "sup_terreno" DECIMAL(10,2),
  ADD COLUMN     "fuente" TEXT NOT NULL DEFAULT 'Publicación',
  ADD COLUMN     "tipo_precio" TEXT NOT NULL DEFAULT 'Publicado',
  ADD COLUMN     "fecha_referencia" DATE,
  ADD COLUMN     "distancia_km" DECIMAL(8,2);
