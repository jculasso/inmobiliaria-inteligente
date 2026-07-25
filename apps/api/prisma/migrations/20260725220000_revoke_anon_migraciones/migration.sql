-- Higiene: `anon` y `authenticated` heredaban TRUNCATE/REFERENCES/TRIGGER sobre
-- `_prisma_migrations` (grants por defecto de Supabase sobre el esquema public).
-- No hay lectura ni escritura de datos ahí, y PostgREST no expone TRUNCATE, así
-- que no era explotable — pero el historial de migraciones no tiene por qué ser
-- alcanzable desde una clave que viaja en el navegador.
REVOKE ALL ON "_prisma_migrations" FROM anon, authenticated;
