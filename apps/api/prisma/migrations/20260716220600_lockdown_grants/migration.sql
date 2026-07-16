-- =============================================================================
-- Least-privilege sobre las tablas del núcleo.
--
-- Supabase, por su default de "exponer tablas nuevas", otorga a anon/authenticated
-- privilegios amplios (REFERENCES, TRIGGER, TRUNCATE). TRUNCATE **ignora RLS**, así
-- que un rol con ese permiso podría vaciar tablas saltándose el aislamiento.
-- Acá quitamos todo a anon/authenticated y dejamos solo lo estrictamente necesario
-- para el rol de runtime (authenticated). service_role (backend admin, BYPASSRLS)
-- se deja como está.
-- =============================================================================

REVOKE ALL ON "tenant" FROM anon, authenticated;
REVOKE ALL ON "usuario" FROM anon, authenticated;
REVOKE ALL ON "usuario_rol" FROM anon, authenticated;

GRANT SELECT, UPDATE ON "tenant" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "usuario" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON "usuario_rol" TO authenticated;
