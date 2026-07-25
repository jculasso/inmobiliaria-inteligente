-- Cambio de contraseña obligatorio en el primer ingreso.
-- Los usuarios nuevos nacen con la marca puesta (default true); los que YA
-- existen eligieron su clave hace rato, así que se los deja en false para no
-- obligarlos a cambiarla sin motivo.

ALTER TABLE "usuario"
  ADD COLUMN IF NOT EXISTS "debe_cambiar_password" BOOLEAN NOT NULL DEFAULT true;

UPDATE "usuario" SET "debe_cambiar_password" = false;
