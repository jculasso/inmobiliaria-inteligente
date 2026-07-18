-- AlterTable: agrega auth_user_id nullable primero (sin constraint todavía).
ALTER TABLE "usuario" ADD COLUMN "auth_user_id" UUID;

-- Backfill: todo usuario existente ya usaba su propia PK como id de Supabase
-- Auth (los creados desde /admin) o directamente no tiene cuenta de Auth (los
-- creados desde el Tablero, cuyo `id` es un uuid random que ningún JWT real
-- va a presentar nunca). En ambos casos, copiar `id` preserva el comportamiento
-- actual exacto: quien podía loguearse sigue pudiendo, quien no, sigue sin poder.
UPDATE "usuario" SET "auth_user_id" = "id";

-- CreateIndex: ahora sí, con los datos ya poblados.
CREATE UNIQUE INDEX "usuario_auth_user_id_key" ON "usuario"("auth_user_id");
