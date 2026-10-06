-- Claves foráneas por inmobiliaria (auditoría de seguridad del 6/10/2026).
--
-- Postgres controla las claves foráneas como dueño de la tabla, SIN RLS: la
-- base aceptaba, por ejemplo, un concepto de una inmobiliaria apuntando al
-- contrato de OTRA. Hoy no pasa porque el código busca cada id con RLS antes
-- de usarlo, pero nada lo garantizaba.
--
-- Acá cada relación entre tablas de negocio se repite con la inmobiliaria
-- adelante: (tenant_id, x_id) → (tenant_id, id). Las claves simples de
-- Prisma quedan como están —con su ON DELETE—; estas, creadas después, se
-- controlan después de aquellas y solo verifican que no se crucen
-- inmobiliarias. Prisma no las conoce: viven solo en esta migración.

-- Cada tabla referida necesita (tenant_id, id) único.

CREATE UNIQUE INDEX IF NOT EXISTS "alq_cobro_tenant_id_id_key" ON "alq_cobro" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_concepto_tenant_id_id_key" ON "alq_concepto" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_contrato_tenant_id_id_key" ON "alq_contrato" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_cuenta_servicio_tenant_id_id_key" ON "alq_cuenta_servicio" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_documento_tenant_id_id_key" ON "alq_documento" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_liquidacion_tenant_id_id_key" ON "alq_liquidacion" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_persona_tenant_id_id_key" ON "alq_persona" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_poliza_tenant_id_id_key" ON "alq_poliza" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_propiedad_tenant_id_id_key" ON "alq_propiedad" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_proveedor_tenant_id_id_key" ON "alq_proveedor" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_reclamo_tenant_id_id_key" ON "alq_reclamo" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "alq_servicio_tenant_id_id_key" ON "alq_servicio" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "operacion_tenant_id_id_key" ON "operacion" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "protocolo_tenant_id_id_key" ON "protocolo" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "tasacion_tenant_id_id_key" ON "tasacion" ("tenant_id", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "usuario_tenant_id_id_key" ON "usuario" ("tenant_id", "id");

-- Las relaciones, con la inmobiliaria adelante. NOT VALID + VALIDATE: el
-- control de lo existente no bloquea escrituras mientras corre.
ALTER TABLE "alq_boleta" ADD CONSTRAINT "alq_boleta_cuenta_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "cuenta_id") REFERENCES "alq_cuenta_servicio" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_boleta" VALIDATE CONSTRAINT "alq_boleta_cuenta_id_mismo_tenant_fkey";
ALTER TABLE "alq_boleta" ADD CONSTRAINT "alq_boleta_poliza_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "poliza_id") REFERENCES "alq_poliza" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_boleta" VALIDATE CONSTRAINT "alq_boleta_poliza_id_mismo_tenant_fkey";
ALTER TABLE "alq_cobro" ADD CONSTRAINT "alq_cobro_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_cobro" VALIDATE CONSTRAINT "alq_cobro_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_comprobante" ADD CONSTRAINT "alq_comprobante_proveedor_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "proveedor_id") REFERENCES "alq_proveedor" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_comprobante" VALIDATE CONSTRAINT "alq_comprobante_proveedor_id_mismo_tenant_fkey";
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_cobro_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "cobro_id") REFERENCES "alq_cobro" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_cobro_id_mismo_tenant_fkey";
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_contrato_id_mismo_tenant_fkey";
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_liquidacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "liquidacion_id") REFERENCES "alq_liquidacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_liquidacion_id_mismo_tenant_fkey";
ALTER TABLE "alq_concepto" ADD CONSTRAINT "alq_concepto_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_concepto" VALIDATE CONSTRAINT "alq_concepto_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_contacto" ADD CONSTRAINT "alq_contacto_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_contacto" VALIDATE CONSTRAINT "alq_contacto_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_contrato" ADD CONSTRAINT "alq_contrato_propiedad_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "propiedad_id") REFERENCES "alq_propiedad" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_contrato" VALIDATE CONSTRAINT "alq_contrato_propiedad_id_mismo_tenant_fkey";
ALTER TABLE "alq_contrato_parte" ADD CONSTRAINT "alq_contrato_parte_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_contrato_parte" VALIDATE CONSTRAINT "alq_contrato_parte_contrato_id_mismo_tenant_fkey";
ALTER TABLE "alq_contrato_parte" ADD CONSTRAINT "alq_contrato_parte_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_contrato_parte" VALIDATE CONSTRAINT "alq_contrato_parte_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_cuenta_bancaria" ADD CONSTRAINT "alq_cuenta_bancaria_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_cuenta_bancaria" VALIDATE CONSTRAINT "alq_cuenta_bancaria_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_cuenta_servicio" ADD CONSTRAINT "alq_cuenta_servicio_propiedad_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "propiedad_id") REFERENCES "alq_propiedad" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_cuenta_servicio" VALIDATE CONSTRAINT "alq_cuenta_servicio_propiedad_id_mismo_tenant_fkey";
ALTER TABLE "alq_cuenta_servicio" ADD CONSTRAINT "alq_cuenta_servicio_servicio_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "servicio_id") REFERENCES "alq_servicio" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_cuenta_servicio" VALIDATE CONSTRAINT "alq_cuenta_servicio_servicio_id_mismo_tenant_fkey";
ALTER TABLE "alq_documento" ADD CONSTRAINT "alq_documento_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_documento" VALIDATE CONSTRAINT "alq_documento_contrato_id_mismo_tenant_fkey";
ALTER TABLE "alq_firma_evento" ADD CONSTRAINT "alq_firma_evento_documento_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "documento_id") REFERENCES "alq_documento" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_firma_evento" VALIDATE CONSTRAINT "alq_firma_evento_documento_id_mismo_tenant_fkey";
ALTER TABLE "alq_firmante" ADD CONSTRAINT "alq_firmante_documento_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "documento_id") REFERENCES "alq_documento" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_firmante" VALIDATE CONSTRAINT "alq_firmante_documento_id_mismo_tenant_fkey";
ALTER TABLE "alq_firmante" ADD CONSTRAINT "alq_firmante_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_firmante" VALIDATE CONSTRAINT "alq_firmante_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_garantia" ADD CONSTRAINT "alq_garantia_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_garantia" VALIDATE CONSTRAINT "alq_garantia_contrato_id_mismo_tenant_fkey";
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_cobro_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "cobro_id") REFERENCES "alq_cobro" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_imputacion" VALIDATE CONSTRAINT "alq_imputacion_cobro_id_mismo_tenant_fkey";
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_concepto_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "concepto_id") REFERENCES "alq_concepto" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_imputacion" VALIDATE CONSTRAINT "alq_imputacion_concepto_id_mismo_tenant_fkey";
ALTER TABLE "alq_imputacion" ADD CONSTRAINT "alq_imputacion_registrada_en_cobro_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "registrada_en_cobro_id") REFERENCES "alq_cobro" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_imputacion" VALIDATE CONSTRAINT "alq_imputacion_registrada_en_cobro_id_mismo_tenant_fkey";
ALTER TABLE "alq_liquidacion" ADD CONSTRAINT "alq_liquidacion_persona_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "persona_id") REFERENCES "alq_persona" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_liquidacion" VALIDATE CONSTRAINT "alq_liquidacion_persona_id_mismo_tenant_fkey";
ALTER TABLE "alq_poliza" ADD CONSTRAINT "alq_poliza_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_poliza" VALIDATE CONSTRAINT "alq_poliza_contrato_id_mismo_tenant_fkey";
ALTER TABLE "alq_reclamo_nota" ADD CONSTRAINT "alq_reclamo_nota_reclamo_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "reclamo_id") REFERENCES "alq_reclamo" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_reclamo_nota" VALIDATE CONSTRAINT "alq_reclamo_nota_reclamo_id_mismo_tenant_fkey";
ALTER TABLE "alq_tramo" ADD CONSTRAINT "alq_tramo_contrato_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "contrato_id") REFERENCES "alq_contrato" ("tenant_id", "id") NOT VALID;
ALTER TABLE "alq_tramo" VALIDATE CONSTRAINT "alq_tramo_contrato_id_mismo_tenant_fkey";
ALTER TABLE "google_cuenta" ADD CONSTRAINT "google_cuenta_usuario_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "usuario_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "google_cuenta" VALIDATE CONSTRAINT "google_cuenta_usuario_id_mismo_tenant_fkey";
ALTER TABLE "informe_generado" ADD CONSTRAINT "informe_generado_tasacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "tasacion_id") REFERENCES "tasacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "informe_generado" VALIDATE CONSTRAINT "informe_generado_tasacion_id_mismo_tenant_fkey";
ALTER TABLE "objetivo" ADD CONSTRAINT "objetivo_usuario_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "usuario_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "objetivo" VALIDATE CONSTRAINT "objetivo_usuario_id_mismo_tenant_fkey";
ALTER TABLE "operacion_punta" ADD CONSTRAINT "operacion_punta_operacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "operacion_id") REFERENCES "operacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "operacion_punta" VALIDATE CONSTRAINT "operacion_punta_operacion_id_mismo_tenant_fkey";
ALTER TABLE "operacion_punta" ADD CONSTRAINT "operacion_punta_usuario_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "usuario_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "operacion_punta" VALIDATE CONSTRAINT "operacion_punta_usuario_id_mismo_tenant_fkey";
ALTER TABLE "propiedad" ADD CONSTRAINT "propiedad_agente_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "agente_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "propiedad" VALIDATE CONSTRAINT "propiedad_agente_id_mismo_tenant_fkey";
ALTER TABLE "protocolo" ADD CONSTRAINT "protocolo_agente_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "agente_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "protocolo" VALIDATE CONSTRAINT "protocolo_agente_id_mismo_tenant_fkey";
ALTER TABLE "protocolo" ADD CONSTRAINT "protocolo_tasacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "tasacion_id") REFERENCES "tasacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "protocolo" VALIDATE CONSTRAINT "protocolo_tasacion_id_mismo_tenant_fkey";
ALTER TABLE "protocolo_accion" ADD CONSTRAINT "protocolo_accion_protocolo_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "protocolo_id") REFERENCES "protocolo" ("tenant_id", "id") NOT VALID;
ALTER TABLE "protocolo_accion" VALIDATE CONSTRAINT "protocolo_accion_protocolo_id_mismo_tenant_fkey";
ALTER TABLE "tasacion" ADD CONSTRAINT "tasacion_agente_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "agente_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "tasacion" VALIDATE CONSTRAINT "tasacion_agente_id_mismo_tenant_fkey";
ALTER TABLE "tasacion_comparable" ADD CONSTRAINT "tasacion_comparable_tasacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "tasacion_id") REFERENCES "tasacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "tasacion_comparable" VALIDATE CONSTRAINT "tasacion_comparable_tasacion_id_mismo_tenant_fkey";
ALTER TABLE "tasacion_estado_historial" ADD CONSTRAINT "tasacion_estado_historial_tasacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "tasacion_id") REFERENCES "tasacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "tasacion_estado_historial" VALIDATE CONSTRAINT "tasacion_estado_historial_tasacion_id_mismo_tenant_fkey";
ALTER TABLE "tasacion_estado_historial" ADD CONSTRAINT "tasacion_estado_historial_usuario_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "usuario_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "tasacion_estado_historial" VALIDATE CONSTRAINT "tasacion_estado_historial_usuario_id_mismo_tenant_fkey";
ALTER TABLE "tasacion_foto" ADD CONSTRAINT "tasacion_foto_tasacion_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "tasacion_id") REFERENCES "tasacion" ("tenant_id", "id") NOT VALID;
ALTER TABLE "tasacion_foto" VALIDATE CONSTRAINT "tasacion_foto_tasacion_id_mismo_tenant_fkey";
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_lider_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "lider_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "usuario" VALIDATE CONSTRAINT "usuario_lider_id_mismo_tenant_fkey";
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_mismo_tenant_fkey" FOREIGN KEY ("tenant_id", "usuario_id") REFERENCES "usuario" ("tenant_id", "id") NOT VALID;
ALTER TABLE "usuario_rol" VALIDATE CONSTRAINT "usuario_rol_usuario_id_mismo_tenant_fkey";
