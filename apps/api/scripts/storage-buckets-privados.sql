-- Paso productivo (una sola vez): pasar a PRIVADOS los buckets con datos
-- confidenciales del Tasador. Ejecutar contra la base con la conexión directa
-- (DIRECT_URL, rol postgres) desde el SQL editor de Supabase o psql.
--
-- Contexto: los informes de tasación (PDF con datos del cliente y valores) y
-- las fotos de propiedades no deben ser accesibles por URL pública. El código
-- ya sube a estos buckets como privados y sirve el contenido con URLs firmadas
-- de vida corta; este script cierra el acceso público de los buckets que hoy
-- existen como públicos.
--
-- Compatibilidad: el backend extrae la key tanto de una URL pública legacy como
-- de una key nueva (SupabaseStorageService.keyDe), así que las fotos ya subidas
-- siguen mostrándose (se firman al vuelo) sin necesidad de migrar filas.
--
-- Los buckets `usuarios-avatares` y los logos de tenant se dejan PÚBLICOS a
-- propósito (baja sensibilidad, se renderizan inline en toda la app y en la Home).

update storage.buckets
set public = false
where id in ('informes-tasador', 'tasador-fotos');

-- Verificación:
-- select id, public from storage.buckets order by id;
