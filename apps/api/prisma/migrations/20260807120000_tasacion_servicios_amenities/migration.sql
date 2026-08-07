-- Tasador: seis características nuevas, la sección Servicios y los amenities
-- del edificio como lista cerrada.
--
-- NO PISA NINGÚN DATO EXISTENTE, a propósito. Todas las columnas nuevas traen
-- DEFAULT, así que las tasaciones ya cargadas quedan con el valor neutro sin
-- necesidad de reescribirlas. Hay un solo UPDATE al final y escribe únicamente
-- en `tiene_amenities`, una columna creada en esta misma migración: ninguna
-- columna preexistente se modifica. La base productiva todavía no tiene copias
-- de seguridad automáticas (ver §20.6 del documento de arquitectura), y una
-- migración que reescribe datos viejos no se hace sin red.
--
-- Sobre `amenities`, que YA EXISTÍA: la pantalla vieja no guardaba nombres de
-- amenities ahí. Guardaba el centinela `['Sí']` del selector sí/no — el detalle
-- real lo escribía la gente en `detalle_amenities`, que acá no se toca y se
-- sigue mostrando. Por eso el centinela se retira: su significado queda
-- guardado en `tiene_amenities`, no se pierde nada, y si quedara sería un chip
-- "Sí" colgado en la lista nueva. Cualquier otro valor que hubiera se conserva.

-- Características de la unidad
ALTER TABLE "tasacion" ADD COLUMN "altillo"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasacion" ADD COLUMN "baulera"    BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasacion" ADD COLUMN "biblioteca" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasacion" ADD COLUMN "escritorio" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasacion" ADD COLUMN "jardin"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasacion" ADD COLUMN "vestidor"   BOOLEAN NOT NULL DEFAULT false;

-- Servicios del inmueble (lista cerrada en packages/types/src/tasador.ts)
ALTER TABLE "tasacion" ADD COLUMN "servicios" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- El "¿tiene amenities?" del formulario, aparte de la lista, para poder
-- distinguir "dijo que no" de "no lo completó".
ALTER TABLE "tasacion" ADD COLUMN "tiene_amenities" BOOLEAN NOT NULL DEFAULT false;

-- Las tasaciones que ya tenían algo cargado en amenities respondieron "sí" de
-- hecho, aunque el campo no existiera. Sin esto, al abrirlas para editar la
-- pantalla mostraría "No" y escondería lo que ya estaba escrito.
UPDATE "tasacion" SET "tiene_amenities" = true WHERE cardinality("amenities") > 0;

-- Retirar el centinela, ya traducido a `tiene_amenities` en la línea de arriba.
-- `array_remove` no falla si no está, así que las filas sin él quedan igual.
UPDATE "tasacion"
   SET "amenities" = array_remove("amenities", 'Sí')
 WHERE 'Sí' = ANY("amenities");
