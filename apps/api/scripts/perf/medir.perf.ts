import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { levantarApi, urlLocal, type Api, type Respuesta } from './harness';

/**
 * Mide la API de Alquileres sobre la cartera que deja `sembrar.perf.ts`:
 * p50/p95 de ~20 corridas, consultas a la base por pedido (cada una es un viaje
 * de red: en producción ~150 ms entre Oregon y São Paulo) y tamaño de la
 * respuesta. Corre lo mismo contra la inmobiliaria chica para ver si las
 * consultas crecen con las filas (N+1).
 *
 * `PERF_SALIDA`: archivo JSON con los resultados (opcional).
 */

const VUELTAS = Number(process.env.PERF_VUELTAS ?? 20);
const RTT_MS = 150;
/**
 * Con `PERF_RTT_MS` la latencia ya está en la medición (el proxy de
 * `proxy-latencia.ts`): no se suma otra vez. Sin proxy, la estimación es la
 * medición local más un viaje por consulta, que se queda corta con el motor de
 * Prisma y `pgbouncer=true` (ahí cada consulta son dos viajes, más un
 * `DEALLOCATE ALL` por transacción).
 */
const CON_PROXY = Number(process.env.PERF_RTT_MS ?? 0) > 0;

interface Medida {
  nombre: string;
  status: number;
  p50: number;
  p95: number;
  /** CPU de la API (mediana), ms: en Render free (0,1 CPU) pesa varias veces más. */
  cpu: number;
  consultas: number;
  consultasMax: number;
  bytes: number;
  gzip: number;
  prodEstimada: number;
  consultasChica?: number;
  sqlEjemplo?: string[];
}

const pct = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]!;
};
const mediana = (xs: number[]) => pct(xs, 50);

async function medir(
  api: Api,
  nombre: string,
  pedido: () => Promise<Respuesta>,
  antes?: () => Promise<void>,
  vueltas = VUELTAS,
): Promise<Medida> {
  // Dos de calentamiento: el plan de Postgres, el JIT de Node, el principal.
  for (let i = 0; i < 2; i++) {
    if (antes) await antes();
    await pedido();
  }
  const ms: number[] = [];
  const qs: number[] = [];
  const cpus: number[] = [];
  let ultima!: Respuesta;
  for (let i = 0; i < vueltas; i++) {
    if (antes) await antes();
    ultima = await pedido();
    ms.push(ultima.ms);
    qs.push(ultima.consultas);
    cpus.push(ultima.cpu);
  }
  const consultas = mediana(qs);
  const p50 = mediana(ms);
  const m: Medida = {
    nombre,
    status: ultima.status,
    p50: Math.round(p50),
    p95: Math.round(pct(ms, 95)),
    cpu: Math.round(mediana(cpus)),
    consultas,
    consultasMax: Math.max(...qs),
    bytes: ultima.bytes,
    gzip: ultima.gzip,
    prodEstimada: Math.round(CON_PROXY ? p50 : p50 + consultas * RTT_MS),
    sqlEjemplo: ultima.sql.map((s) => s.replace(/\s+/g, ' ').slice(0, 160)),
  };
  // `PERF_VOLCAR`: una carpeta donde dejar la última respuesta de cada pedido
  // (para comparar tamaños y contenidos entre dos versiones).
  if (process.env.PERF_VOLCAR && ultima.json !== null)
    writeFileSync(
      `${process.env.PERF_VOLCAR}/${nombre.replace(/[^a-z0-9]+/gi, '_')}.json`,
      JSON.stringify(ultima.json),
    );
  if (ultima.status >= 300)
    console.warn(nombre, ultima.status, JSON.stringify(ultima.json).slice(0, 300));
  console.log(
    `${nombre.padEnd(58)} ${String(m.status).padEnd(4)} p50 ${String(m.p50).padStart(6)} p95 ${String(m.p95).padStart(6)} cpu ${String(m.cpu).padStart(5)}  q ${String(consultas).padStart(3)}  prod≈${String(m.prodEstimada).padStart(6)} ms  ${(m.bytes / 1024).toFixed(1)} KB (gz ${(m.gzip / 1024).toFixed(1)})`,
  );
  return m;
}

it('mide la API de Alquileres con la cartera de Vacker de prueba', async () => {
  const db = new PrismaClient({ datasourceUrl: urlLocal() });
  const tenants = await db.tenant.findMany({
    where: { slug: { in: ['vacker-de-prueba', 'otra-de-prueba'] } },
    include: { usuarios: true },
  });
  const grande = tenants.find((t) => t.slug === 'vacker-de-prueba')!;
  const chica = tenants.find((t) => t.slug === 'otra-de-prueba')!;
  let token = grande.usuarios[0]!.authUserId!;
  const api = await levantarApi(() => token);

  /** Los ids con más historia de cada inmobiliaria. */
  async function ids(tenantId: string) {
    const q = <T>(sql: string) => db.$queryRawUnsafe<T[]>(sql);
    const [inq] = await q<{ persona_id: string }>(
      `SELECT persona_id FROM alq_concepto WHERE tenant_id = '${tenantId}' AND sentido = 'a_cobrar' AND tipo = 'alquiler'
       GROUP BY persona_id ORDER BY count(*) DESC, persona_id LIMIT 1`,
    );
    const [moroso] = await q<{ persona_id: string }>(
      `SELECT k.persona_id FROM alq_concepto k
        WHERE k.tenant_id = '${tenantId}' AND k.sentido = 'a_cobrar' AND k.anulado_en IS NULL
          AND k.importe > coalesce((SELECT sum(i.importe) FROM alq_imputacion i JOIN alq_cobro c ON c.id = i.cobro_id
                                     WHERE i.concepto_id = k.id AND c.anulado_en IS NULL), 0)
        GROUP BY k.persona_id ORDER BY count(*) DESC, k.persona_id LIMIT 1`,
    );
    const [duenio] = await q<{ persona_id: string }>(
      `SELECT persona_id FROM alq_contrato_parte WHERE tenant_id = '${tenantId}' AND papel = 'propietario'
       GROUP BY persona_id ORDER BY count(*) DESC, persona_id LIMIT 1`,
    );
    const [contrato] = await q<{ id: string }>(
      `SELECT contrato_id AS id FROM alq_contrato_parte p JOIN alq_contrato c ON c.id = p.contrato_id
        WHERE p.tenant_id = '${tenantId}' AND p.persona_id = '${duenio!.persona_id}' AND c.estado = 'vigente' LIMIT 1`,
    );
    const [cobro] = await q<{ id: string }>(
      `SELECT c.id FROM alq_cobro c WHERE c.tenant_id = '${tenantId}' AND c.anulado_en IS NULL
        ORDER BY (SELECT count(*) FROM alq_imputacion i WHERE i.registrada_en_cobro_id = c.id) DESC, c.fecha DESC LIMIT 1`,
    );
    const [liq] = await q<{ id: string }>(
      `SELECT id FROM alq_liquidacion WHERE tenant_id = '${tenantId}' AND anulado_en IS NULL
        ORDER BY jsonb_array_length(CASE WHEN jsonb_typeof(detalle) = 'array' THEN detalle ELSE '[]'::jsonb END) DESC, fecha DESC LIMIT 1`,
    );
    const [plantilla] = await q<{ id: string }>(
      `SELECT id FROM alq_plantilla WHERE tenant_id = '${tenantId}' LIMIT 1`,
    );
    return {
      inquilino: inq!.persona_id,
      moroso: moroso?.persona_id ?? inq!.persona_id,
      duenio: duenio!.persona_id,
      contrato: contrato?.id,
      cobro: cobro!.id,
      liquidacion: liq!.id,
      plantilla: plantilla?.id,
    };
  }

  const HOY = '2026-10-15';
  const ANIO = 'desde=2025-11&hasta=2026-10';
  function casos(x: Awaited<ReturnType<typeof ids>>) {
    const g = (ruta: string) => () => api.pedir('GET', ruta);
    const p =
      (ruta: string, cuerpo: unknown = {}) =>
      () =>
        api.pedir('POST', ruta, cuerpo);
    const lista: [string, () => Promise<Respuesta>][] = [
      ['GET tablero/completo', g('/alquileres/tablero/completo')],
      // Lo que pide la web desde la regla 175: cada fila una vez.
      ['GET tablero/completo?formato=compacto', g('/alquileres/tablero/completo?formato=compacto')],
      ['GET tablero/completo?anio=2025', g('/alquileres/tablero/completo?anio=2025')],
      ['GET tablero (un corte)', g('/alquileres/tablero')],
      [
        'GET tablero/detalle vigentes (año)',
        g(`/alquileres/tablero/detalle?indicador=vigentes&${ANIO}`),
      ],
      [
        'GET tablero/detalle importeCobrado (año)',
        g(`/alquileres/tablero/detalle?indicador=importeCobrado&${ANIO}`),
      ],
      [
        'GET tablero/detalle importeEmitido (año)',
        g(`/alquileres/tablero/detalle?indicador=importeEmitido&${ANIO}`),
      ],
      [
        'GET tablero/detalle ingresos (año)',
        g(`/alquileres/tablero/detalle?indicador=ingresos&${ANIO}`),
      ],
      ['GET tablero/detalle mora (año)', g(`/alquileres/tablero/detalle?indicador=mora&${ANIO}`)],
      [
        'GET cobros/preparar (inquilino con historia)',
        g(`/alquileres/cobros/preparar?personaId=${x.inquilino}&moneda=ARS&fecha=${HOY}`),
      ],
      [
        'GET cobros/preparar (inquilino moroso)',
        g(`/alquileres/cobros/preparar?personaId=${x.moroso}&moneda=ARS&fecha=${HOY}`),
      ],
      [
        'GET liquidaciones/preparar (dueño con más contratos)',
        g(`/alquileres/liquidaciones/preparar?personaId=${x.duenio}&moneda=ARS&fecha=${HOY}`),
      ],
      ['GET liquidaciones/pendientes', g('/alquileres/liquidaciones/pendientes')],
      ['GET informes/propietarios (año)', g(`/alquileres/informes/propietarios?${ANIO}`)],
      [
        'GET informes/propietarios/:id (año)',
        g(`/alquileres/informes/propietarios/${x.duenio}?${ANIO}`),
      ],
      [
        'POST informes/propietarios/:id/pdf (año)',
        p(`/alquileres/informes/propietarios/${x.duenio}/pdf?${ANIO}`),
      ],
      [
        'GET personas/:id/cuenta (inquilino 2 años)',
        g(`/alquileres/personas/${x.inquilino}/cuenta`),
      ],
      ['GET personas/:id/cuenta (propietario)', g(`/alquileres/personas/${x.duenio}/cuenta`)],
      ['GET contratos', g('/alquileres/contratos')],
      ['GET contratos/:id/completo', g(`/alquileres/contratos/${x.contrato}/completo`)],
      ['GET conceptos?periodo=2026-10', g('/alquileres/conceptos?periodo=2026-10')],
      ['GET indexaciones (A indexar)', g('/alquileres/indexaciones')],
      ['GET reservas', g('/alquileres/reservas?estado=todas')],
      ['GET personas', g('/alquileres/personas')],
      ['GET cobros (últimos)', g('/alquileres/cobros')],
      ['GET liquidaciones', g('/alquileres/liquidaciones')],
      ['GET boletas/planilla 2026-10', g('/alquileres/boletas/planilla?periodo=2026-10')],
      ['GET boletas?ver=control', g('/alquileres/boletas?ver=control')],
      ['GET reclamos', g('/alquileres/reclamos')],
      ['GET alquileres/resumen', g('/alquileres/resumen')],
      ['POST cobros/:id/recibo (PDF)', p(`/alquileres/cobros/${x.cobro}/recibo`)],
      ['POST liquidaciones/:id/pdf', p(`/alquileres/liquidaciones/${x.liquidacion}/pdf`)],
      [
        'POST conceptos/generar 2026-10 (ya generado)',
        p('/alquileres/conceptos/generar', { periodo: '2026-10' }),
      ],
    ];
    if (x.plantilla && x.contrato)
      lista.push([
        'POST contratos/:id/generar-desde-plantilla (Word)',
        p(`/alquileres/contratos/${x.contrato}/generar-desde-plantilla`, {
          plantillaId: x.plantilla,
        }),
      ]);
    return lista;
  }

  const resultados: Medida[] = [];
  try {
    const xg = await ids(grande.id);
    // El Storage del arnés vive en memoria: el Word de la plantilla se vuelve
    // a subir en cada corrida (el ejemplo de la propia API).
    if (xg.plantilla) {
      const docx = await (
        await fetch(
          `http://127.0.0.1:${(api.app.getHttpServer().address() as { port: number }).port}/alquileres/plantillas/ejemplo`,
          {
            headers: { authorization: `Bearer ${token}` },
          },
        )
      ).arrayBuffer();
      const r = await api.subir(
        `/alquileres/plantillas/${xg.plantilla}/archivo`,
        {},
        Buffer.from(docx),
        'contrato.docx',
        'PUT',
      );
      if (r.status >= 300) console.warn('plantilla', JSON.stringify(r.json).slice(0, 300));
    }
    // `PERF_SOLO`: una expresión regular para medir solo algunos pedidos.
    const solo = process.env.PERF_SOLO ? new RegExp(process.env.PERF_SOLO) : null;
    for (const [nombre, pedido] of casos(xg)) {
      if (solo && !solo.test(nombre)) continue;
      console.log(`… ${nombre}`);
      resultados.push(await medir(api, nombre, pedido));
    }

    // Generar un mes nuevo para los 120 contratos: cada vuelta borra lo que
    // generó la anterior, para medir siempre la primera generación.
    const borrarNoviembre = async () => {
      await db.alqEvento.deleteMany({
        where: {
          tenantId: grande.id,
          accion: 'generacion',
          resumen: { contains: 'noviembre de 2026' },
        },
      });
      await db.alqConcepto.deleteMany({ where: { tenantId: grande.id, periodo: '2026-11' } });
    };
    const GENERAR = 'POST conceptos/generar 2026-11 (primera vez, 120 contratos)';
    if (!solo || solo.test(GENERAR)) {
      resultados.push(
        await medir(
          api,
          GENERAR,
          () => api.pedir('POST', '/alquileres/conceptos/generar', { periodo: '2026-11' }),
          borrarNoviembre,
        ),
      );
      await borrarNoviembre();
    }
    if (solo) return;

    // La misma batería contra la inmobiliaria chica: si las consultas cambian,
    // crecen con las filas.
    token = chica.usuarios[0]!.authUserId!;
    const xc = await ids(chica.id);
    const chicas = new Map<string, number>();
    for (const [nombre, pedido] of casos(xc)) {
      await pedido();
      const r = await pedido();
      chicas.set(nombre, r.consultas);
    }
    for (const m of resultados) m.consultasChica = chicas.get(m.nombre);
    console.log('\nConsultas: grande vs chica');
    for (const m of resultados)
      if (m.consultasChica !== undefined && m.consultasChica !== m.consultas)
        console.log(`  ${m.nombre}: ${m.consultas} vs ${m.consultasChica}`);
  } finally {
    if (process.env.PERF_SALIDA)
      writeFileSync(process.env.PERF_SALIDA, JSON.stringify(resultados, null, 2));
    await api.cerrar();
    await db.$disconnect();
  }
});
