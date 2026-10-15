-- Feriados nacionales (regla 100 de docs/specs/alquileres-fase-1.md; Florencia,
-- Vacker, 15/10/2026): un vencimiento que cae en feriado se corre al siguiente
-- día hábil, como uno que cae en fin de semana.
--
-- Tabla NUEVA y GLOBAL, como `indice_valor`: los feriados nacionales son los
-- mismos para todas las inmobiliarias, así que no lleva tenant_id. RLS con una
-- sola policy de LECTURA: la API, que entra como `authenticated` dentro de
-- withTenant, la lee para calcular vencimientos pero no la puede escribir. La
-- escribe solo la tarea diaria (`/tareas/indices`), con el rol dueño de la
-- tabla. `rls-habilitada.e2e-spec.ts` la acepta en GLOBALES_SOLO_LECTURA.
--
-- No toca ninguna fila existente: crea la tabla y siembra 2026 y 2027 como
-- los publicaba https://api.argentinadatos.com/v1/feriados/{año} el
-- 15/10/2026 (incluye los puentes turísticos: ese día los bancos no abren).
-- Los trasladables de 2027 todavía no tienen fecha definitiva; la tarea
-- diaria los pone al día cuando se publiquen.

CREATE TABLE "feriado" (
    "fecha" DATE NOT NULL,
    "nombre" TEXT NOT NULL,
    -- inamovible | trasladable | puente: como lo publica la fuente.
    "tipo" TEXT NOT NULL,
    "fuente" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feriado_pkey" PRIMARY KEY ("fecha")
);

REVOKE ALL ON "feriado" FROM anon, authenticated;
GRANT SELECT ON "feriado" TO authenticated;
ALTER TABLE "feriado" ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura ON "feriado" FOR SELECT TO authenticated USING (true);

INSERT INTO "feriado" ("fecha", "nombre", "tipo", "fuente") VALUES
  ('2026-01-01', 'Año nuevo', 'inamovible', 'argentinadatos.com'),
  ('2026-02-16', 'Carnaval', 'inamovible', 'argentinadatos.com'),
  ('2026-02-17', 'Carnaval', 'inamovible', 'argentinadatos.com'),
  ('2026-03-23', 'Puente turístico no laborable', 'puente', 'argentinadatos.com'),
  ('2026-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', 'argentinadatos.com'),
  ('2026-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', 'argentinadatos.com'),
  ('2026-04-03', 'Viernes Santo', 'inamovible', 'argentinadatos.com'),
  ('2026-05-01', 'Día del Trabajador', 'inamovible', 'argentinadatos.com'),
  ('2026-05-25', 'Día de la Revolución de Mayo', 'inamovible', 'argentinadatos.com'),
  ('2026-06-15', 'Paso a la Inmortalidad del General Martín Güemes (17/6)', 'trasladable', 'argentinadatos.com'),
  ('2026-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', 'argentinadatos.com'),
  ('2026-07-09', 'Día de la Independencia', 'inamovible', 'argentinadatos.com'),
  ('2026-07-10', 'Puente turístico no laborable', 'puente', 'argentinadatos.com'),
  ('2026-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'trasladable', 'argentinadatos.com'),
  ('2026-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', 'argentinadatos.com'),
  ('2026-11-09', 'Visita del papa León XIV', 'inamovible', 'argentinadatos.com'),
  ('2026-11-23', 'Día de la Soberanía Nacional (20/11)', 'trasladable', 'argentinadatos.com'),
  ('2026-12-07', 'Puente turístico no laborable', 'puente', 'argentinadatos.com'),
  ('2026-12-08', 'Día de la Inmaculada Concepción de María', 'inamovible', 'argentinadatos.com'),
  ('2026-12-25', 'Navidad', 'inamovible', 'argentinadatos.com'),
  ('2027-01-01', 'Año nuevo', 'inamovible', 'argentinadatos.com'),
  ('2027-02-08', 'Carnaval', 'inamovible', 'argentinadatos.com'),
  ('2027-02-09', 'Carnaval', 'inamovible', 'argentinadatos.com'),
  ('2027-03-24', 'Día Nacional de la Memoria por la Verdad y la Justicia', 'inamovible', 'argentinadatos.com'),
  ('2027-03-26', 'Viernes Santo', 'inamovible', 'argentinadatos.com'),
  ('2027-04-02', 'Día del Veterano y de los Caídos en la Guerra de Malvinas', 'inamovible', 'argentinadatos.com'),
  ('2027-05-01', 'Día del Trabajador', 'inamovible', 'argentinadatos.com'),
  ('2027-05-25', 'Día de la Revolución de Mayo', 'inamovible', 'argentinadatos.com'),
  ('2027-06-17', 'Paso a la Inmortalidad del General Martín Güemes', 'trasladable', 'argentinadatos.com'),
  ('2027-06-20', 'Paso a la Inmortalidad del General Manuel Belgrano', 'inamovible', 'argentinadatos.com'),
  ('2027-07-09', 'Día de la Independencia', 'inamovible', 'argentinadatos.com'),
  ('2027-08-17', 'Paso a la Inmortalidad del Gral. José de San Martín', 'trasladable', 'argentinadatos.com'),
  ('2027-10-12', 'Día del Respeto a la Diversidad Cultural', 'trasladable', 'argentinadatos.com'),
  ('2027-11-20', 'Día de la Soberanía Nacional', 'trasladable', 'argentinadatos.com'),
  ('2027-12-08', 'Día de la Inmaculada Concepción de María', 'inamovible', 'argentinadatos.com'),
  ('2027-12-25', 'Navidad', 'inamovible', 'argentinadatos.com')
ON CONFLICT ("fecha") DO NOTHING;
