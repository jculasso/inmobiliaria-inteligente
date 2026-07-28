-- Orden numérico por número de operación.
--
-- El código es texto libre ("OP-1001", "ALQ-999"), y ordenar texto NO da orden
-- numérico: "OP-1001" queda antes que "OP-999" porque se compara carácter por
-- carácter y el '1' es menor que el '9'. Mientras todos los códigos tengan la
-- misma cantidad de dígitos no se nota; en cuanto aparece uno más corto, el
-- listado "ordenado por número de operación" sale mal y nadie entiende por qué.
--
-- Se agrega una columna GENERADA con la parte numérica del código. Al ser
-- `generated always`, la calcula Postgres en cada insert y update: no puede
-- quedar desincronizada del código y no hay nada que mantener en la aplicación.
-- Como contrapartida, la base RECHAZA cualquier intento de escribirla — que es
-- justamente lo que se quiere.
--
-- El tipo es `numeric` y no `bigint` a propósito: el código admite hasta 40
-- caracteres, así que un código con muchos dígitos desbordaría un bigint y
-- haría fallar el alta. `numeric` no tiene ese techo.

ALTER TABLE "operacion"
  ADD COLUMN "codigo_num" NUMERIC
  GENERATED ALWAYS AS (NULLIF(REGEXP_REPLACE("codigo", '\D', '', 'g'), '')::NUMERIC) STORED;

-- El listado ordena por esta columna dentro del tenant.
CREATE INDEX "operacion_tenant_codigo_num_idx" ON "operacion" ("tenant_id", "codigo_num");

-- La otra columna clickeable del listado. Sin índice, ordenar por fecha de
-- firma obliga a un sort completo de las operaciones del tenant.
CREATE INDEX "operacion_tenant_fecha_firma_idx" ON "operacion" ("tenant_id", "fecha_firma");
