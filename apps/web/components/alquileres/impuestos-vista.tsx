'use client';

import { useState, type ReactNode } from 'react';
import { VISTAS_IMPUESTOS } from './impuestos-vistas';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agruparPorUrgencia, mesLargo } from '@vacker/domain';
import {
  CATALOGO_SUGERIDO,
  COMBINACIONES_QUIEN_PAGA,
  CuentaServicioInputSchema,
  NOMBRE_CLASE_SERVICIO,
  NOMBRE_QUIEN_PAGA,
  ServicioInputSchema,
  consecuenciaDeBoleta,
  recuperoDeBoleta,
  textoCuota,
  type AdelantadoBoletasDto,
  type BoletaDto,
  type ClaseServicio,
  type CuentaServicioDto,
  type MedioCobro,
  type MonedaAlquiler,
  type ParteDeudora,
  type PlanillaBoletasDto,
  type PropiedadAlquilerDto,
  type QuienPaga,
  type ServicioDto,
} from '@vacker/types';
import { Button, KpiCard, Modal } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import {
  anularBoleta,
  borrarCuentaServicio,
  borrarServicio,
  cargarServiciosSugeridos,
  guardarCuentaServicio,
  guardarServicio,
  pagarBoleta,
} from '../../lib/alquileres-api';
import { cantidad, fmtDiaCorto, fmtFecha, fmtMoneda, hoyIso } from '../../lib/format';
import { Campo, inputClass } from '../form-ui';
import { CamposTarjeta, CampoTarjeta, ListaTarjetas, Tarjeta } from '../tabla-movil';
import { ConfirmarBorradoModal, DatoBorrado } from '../confirmar-borrado-modal';
import { AnularModal } from './anular-modal';
import { PlanillaBoletas } from './boletas-planilla';
import { MEDIOS_COBRO, NOMBRE_MEDIO } from './medios';
import {
  AccionesFila,
  Bloque,
  CabezaTarjeta,
  CLASE_FOCO,
  CLASE_TD_ACCIONES,
  CLASE_TH,
  CLASE_TH_ACCIONES,
  EncabezadoPagina,
  Insignia,
  NavegadorMes,
  Segmentado,
  Vacio,
  VacioBloque,
} from './piezas';
import { primerMensaje } from '../../lib/mensaje-zod';

export const ICONO_CLASE: Record<ClaseServicio | 'poliza', string> = {
  impuesto: '🏛️',
  servicio: '💡',
  expensa: '🏢',
  poliza: '🛡️',
};

// --- Las tres pestañas (regla 45) ----------------------------------------------------

/** Lo que pide cada pestaña: la página no lee lo de las otras dos. */
export type DatosImpuestos =
  | { ver: 'pagar'; boletas: BoletaDto[]; control: BoletaDto[]; adelantado: AdelantadoBoletasDto }
  | { ver: 'cargar'; planilla: PlanillaBoletasDto }
  | {
      ver: 'propiedades';
      cuentas: CuentaServicioDto[];
      servicios: ServicioDto[];
      propiedades: PropiedadAlquilerDto[];
    };

/**
 * Impuestos y servicios (entrega 19, rediseñada el 7/10/2026). Tres trabajos
 * distintos, tres pestañas: pagar y controlar todos los días, cargar las
 * boletas una vez por mes, y configurar una vez qué tiene cada propiedad. Las
 * pólizas se manejan en la ficha del contrato; sus cuotas son boletas y
 * aparecen en «Para pagar».
 */
export function ImpuestosVista({ periodo, datos }: { periodo: string; datos: DatosImpuestos }) {
  const mes = mesLargo(`${periodo}-01`);
  return (
    <div className="flex flex-col gap-5">
      <EncabezadoPagina titulo="Impuestos y servicios">
        {/* El mes ordena la carga y las pagadas; qué tiene cada propiedad no depende del mes. */}
        {datos.ver !== 'propiedades' && (
          <NavegadorMes periodo={periodo} conservar={`&ver=${datos.ver}`} />
        )}
      </EncabezadoPagina>
      <Segmentado
        etiqueta="Qué hacer"
        opciones={VISTAS_IMPUESTOS}
        valor={datos.ver}
        hrefDe={(v) => `?periodo=${periodo}&ver=${v}`}
      />
      {datos.ver === 'pagar' && <ParaPagar periodo={periodo} {...datos} />}
      {datos.ver === 'cargar' && <PlanillaBoletas planilla={datos.planilla} mes={mes} />}
      {datos.ver === 'propiedades' && (
        <>
          <ImpuestosPorPropiedad
            cuentas={datos.cuentas}
            servicios={datos.servicios}
            propiedades={datos.propiedades}
          />
          <Catalogo servicios={datos.servicios} />
        </>
      )}
    </div>
  );
}

// --- Para pagar (reglas 47 a 50) -------------------------------------------------------

/** «$ 90.000,00», o «$ 90.000,00 · U$S 120,00» si hay dos monedas (la tarjeta las pone una por línea). */
export function sumaPorMoneda(xs: { moneda: MonedaAlquiler; importe: number }[]): string {
  const m = new Map<MonedaAlquiler, number>();
  for (const x of xs) m.set(x.moneda, (m.get(x.moneda) ?? 0) + x.importe);
  if (m.size === 0) return fmtMoneda(0, 'ARS');
  return [...m]
    .sort(([a]) => (a === 'ARS' ? -1 : 1))
    .map(([moneda, total]) => fmtMoneda(total, moneda))
    .join(' · ');
}

/** El día, con su nombre si es de este año: «lun 06/10»; si no, la fecha entera. */
function dia(iso: string, hoy: string): string {
  return iso.slice(0, 4) === hoy.slice(0, 4) ? fmtDiaCorto(iso) : fmtFecha(iso);
}

/** Qué es: «TGI · cuota 10 de 12». */
const queEs = (b: BoletaDto) => `${b.nombre}${b.cuota ? ` · ${textoCuota(b.cuota)}` : ''}`;

/** Cuándo vence, o cuándo se pagó: «venció el lun 06/10», «vence hoy, mar 07/10». */
export function cuandoVence(b: BoletaDto, hoy: string): string {
  if (b.estado === 'pagada')
    return `${b.paga === 'inmobiliaria' ? 'pagada' : 'comprobante'} el ${b.pagadaEl ? dia(b.pagadaEl, hoy) : '—'}`;
  if (b.estado === 'anulada') return `vencía el ${dia(b.vencimiento, hoy)}`;
  if (b.vencimiento < hoy) return `venció el ${dia(b.vencimiento, hoy)}`;
  if (b.vencimiento === hoy) return `vence hoy, ${dia(b.vencimiento, hoy)}`;
  return `vence el ${dia(b.vencimiento, hoy)}`;
}

/**
 * La línea de la consecuencia (regla 46) o, ya pagada, la del recupero
 * (regla 47): «Falta descontárselo al propietario: va en su próxima liquidación».
 */
export function lineaDePlata(b: BoletaDto): { texto: string; tono: 'muted' | 'exito' | 'aviso' } {
  const recupero = b.estado === 'pagada' && b.contrato ? recuperoDeBoleta(b) : null;
  if (recupero) return { texto: recupero, tono: b.cargoRecuperado ? 'exito' : 'aviso' };
  // Todavía sin pagar, pero lo que se le cargó a la parte ya se cobró o se
  // descontó: decir «se le cobra en su próximo recibo» era falso (la póliza de
  // ALT-0011 en la prueba del 7/10/2026). Falta solo el pago, o el comprobante.
  if (b.estado === 'pendiente' && b.contrato && b.cargoRecuperado) {
    const ya = recuperoDeBoleta(b);
    if (ya)
      return {
        texto: `${ya}: falta ${b.paga === 'inmobiliaria' ? 'que la inmobiliaria la pague' : 'el comprobante'}`,
        tono: 'muted',
      };
  }
  return { texto: consecuenciaDeBoleta(b.aCargoDe, b.paga, b.contrato != null), tono: 'muted' };
}
const CLASE_TONO = { muted: 'text-muted', exito: 'text-success', aviso: 'text-warning' };

/** El botón de la fila, con texto: quién paga decide qué se registra. */
const accionDe = (b: BoletaDto) =>
  b.paga === 'inmobiliaria' ? 'Registrar pago' : 'Trajo el comprobante';

function ParaPagar({
  periodo,
  boletas,
  control,
  adelantado,
}: {
  periodo: string;
  boletas: BoletaDto[];
  control: BoletaDto[];
  adelantado: AdelantadoBoletasDto;
}) {
  const router = useRouter();
  const hoy = hoyIso();
  const nombreMes = mesLargo(`${periodo}-01`).split(' ')[0];
  const [aPagar, setAPagar] = useState<BoletaDto | null>(null);
  const [aAnular, setAAnular] = useState<BoletaDto | null>(null);
  const [verAnuladas, setVerAnuladas] = useState(false);
  const g = agruparPorUrgencia([...control, ...boletas], hoy, periodo);
  const sinComprobante = g.vencidas.filter((b) => b.paga !== 'inmobiliaria');
  const adelantadas = adelantado.porMoneda.reduce((s, m) => s + m.boletas, 0);
  const listo = () => {
    setAPagar(null);
    setAAnular(null);
    router.refresh();
  };
  const grupos = [
    {
      clave: 'vencidas',
      icono: '⏰',
      titulo: 'Vencidas',
      detalle: 'de cualquier mes',
      bs: g.vencidas,
    },
    {
      clave: 'semana',
      icono: '📅',
      titulo: 'Esta semana',
      detalle: 'de hoy a 7 días',
      bs: g.semana,
    },
    { clave: 'adelante', icono: '🗓️', titulo: `Más adelante en ${nombreMes}`, bs: g.masAdelante },
    { clave: 'pagadas', icono: '✅', titulo: `Pagadas de ${nombreMes}`, bs: g.pagadas },
  ].filter((x) => x.bs.length > 0);

  return (
    <>
      {/* Regla 49: cada tarjeta, un horizonte. */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Vencidas"
          value={sumaPorMoneda(g.vencidas)}
          sub={`${cantidad(g.vencidas.length, 'boleta')}, de cualquier mes`}
          icon="⏰"
          tone={g.vencidas.length ? 'danger' : 'success'}
        />
        <KpiCard
          label="Vencen esta semana"
          value={sumaPorMoneda(g.semana)}
          sub={`${cantidad(g.semana.length, 'boleta')}, de hoy a 7 días`}
          icon="📅"
          tone={g.semana.length ? 'warning' : 'success'}
        />
        <KpiCard
          label="Adelantado sin recuperar"
          value={sumaPorMoneda(adelantado.porMoneda)}
          sub={
            adelantadas
              ? `${cantidad(adelantadas, 'boleta')} que pagó la inmobiliaria`
              : 'nada para cobrar ni descontar'
          }
          icon="💸"
          tone={adelantadas ? 'warning' : 'success'}
        />
        <KpiCard
          label="Comprobantes que faltan"
          value={String(sinComprobante.length)}
          sub="vencidas que paga el inquilino o el propietario"
          icon="📎"
          tone={sinComprobante.length ? 'warning' : 'success'}
        />
      </div>

      {grupos.length === 0 ? (
        <Vacio>
          Nada vencido ni por vencer esta semana, y nada cargado de {nombreMes}.{' '}
          <Link
            href={`?periodo=${periodo}&ver=cargar`}
            className={`rounded font-semibold text-brand-red hover:underline ${CLASE_FOCO}`}
          >
            Cargar las boletas del mes
          </Link>
        </Vacio>
      ) : (
        grupos.map((x) => (
          <GrupoBoletas
            key={x.clave}
            icono={x.icono}
            titulo={x.titulo}
            detalle={x.detalle}
            boletas={x.bs}
            hoy={hoy}
            onPagar={setAPagar}
            onAnular={setAAnular}
          />
        ))
      )}

      {g.anuladas.length > 0 && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setVerAnuladas((v) => !v)}
            aria-expanded={verAnuladas}
            className={`w-fit rounded text-sm font-semibold text-muted hover:text-ink hover:underline ${CLASE_FOCO}`}
          >
            {verAnuladas
              ? 'Ocultar las anuladas'
              : `Ver anuladas de ${nombreMes} (${g.anuladas.length})`}
          </button>
          {verAnuladas && (
            <div className="opacity-70">
              <GrupoBoletas
                icono="🚫"
                titulo={`Anuladas de ${nombreMes}`}
                boletas={g.anuladas}
                hoy={hoy}
                onPagar={setAPagar}
                onAnular={setAAnular}
              />
            </div>
          )}
        </div>
      )}

      {aPagar && (
        <PagarBoletaModal boleta={aPagar} onClose={() => setAPagar(null)} onDone={listo} />
      )}
      {aAnular && (
        <AnularModal
          titulo="Anular la boleta"
          detalle={`${queEs(aAnular)} · ${aAnular.propiedad} · ${fmtMoneda(aAnular.importe, aAnular.moneda)}. Lo que se les cargó a las partes también se anula.`}
          anular={async (motivo) => anularBoleta(await getAccessToken(), aAnular.id, motivo)}
          onClose={() => setAAnular(null)}
          onDone={listo}
        />
      )}
    </>
  );
}

/** Un grupo de «Para pagar»: tarjetas en el teléfono, tabla en la computadora. */
function GrupoBoletas({
  icono,
  titulo,
  detalle,
  boletas,
  hoy,
  onPagar,
  onAnular,
}: {
  icono: string;
  titulo: string;
  detalle?: string;
  boletas: BoletaDto[];
  hoy: string;
  onPagar: (b: BoletaDto) => void;
  onAnular: (b: BoletaDto) => void;
}) {
  const resumen = `${cantidad(boletas.length, 'boleta')} · ${sumaPorMoneda(boletas)}${detalle ? ` · ${detalle}` : ''}`;
  return (
    <Bloque icono={icono} titulo={titulo} detalle={resumen}>
      {/* Tarjetas hasta 1024 px: en una tablet la tabla no entraba y el importe
          quedaba cortado a la derecha (prueba del 7/10/2026). */}
      <ListaTarjetas etiqueta={titulo} hasta="lg">
        {boletas.map((b) => (
          <TarjetaBoleta key={b.id} b={b} hoy={hoy} onPagar={onPagar} onAnular={onAnular} />
        ))}
      </ListaTarjetas>
      <div className="hidden overflow-x-auto lg:block">
        {/* Anchos fijos: cada grupo es su propia tabla, y con anchos automáticos
            las columnas de «Vencidas» y «Esta semana» no quedaban alineadas. */}
        <table className="w-full table-fixed text-sm" aria-label={titulo}>
          <colgroup>
            <col className="w-36" />
            <col />
            <col className="w-44" />
            <col className="w-32" />
            <col className="w-56" />
          </colgroup>
          <thead>
            <tr>
              <th className={CLASE_TH}>Vence</th>
              <th className={CLASE_TH}>Qué es y qué pasa con la plata</th>
              <th className={CLASE_TH}>Propiedad</th>
              <th className={`${CLASE_TH} text-right`}>Importe</th>
              <th className={CLASE_TH_ACCIONES}>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {boletas.map((b) => (
              <FilaBoleta key={b.id} b={b} hoy={hoy} onPagar={onPagar} onAnular={onAnular} />
            ))}
          </tbody>
        </table>
      </div>
    </Bloque>
  );
}

type PropsBoleta = {
  b: BoletaDto;
  hoy: string;
  onPagar: (b: BoletaDto) => void;
  onAnular: (b: BoletaDto) => void;
};

/**
 * Una acción secundaria de una fila, con su texto a la vista (antes eran solo
 * íconos). `etiqueta` le dice al lector de pantalla de qué fila es, y empieza
 * con el mismo texto que se ve.
 */
function BotonTexto({
  etiqueta,
  onClick,
  peligro = false,
  children,
}: {
  etiqueta: string;
  onClick: () => void;
  peligro?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={etiqueta}
      className={`inline-flex items-center rounded px-2 py-1 text-xs font-semibold pointer-coarse:min-h-10 ${CLASE_FOCO} ${peligro ? 'text-muted hover:bg-danger/5 hover:text-danger' : 'text-ink hover:bg-surface'}`}
    >
      {children}
    </button>
  );
}

/** Registrar el pago o el comprobante, con texto; anular, al lado y en segundo plano. */
function Acciones({ b, onPagar, onAnular }: Omit<PropsBoleta, 'hoy'>) {
  if (b.estado === 'anulada') return <Insignia tono="neutro">Anulada</Insignia>;
  if (b.estado === 'pagada')
    return (
      <Insignia tono="exito">{b.paga === 'inmobiliaria' ? 'Pagada' : 'Con comprobante'}</Insignia>
    );
  const texto = accionDe(b);
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {/* Lo cobrado o liquidado de esta boleta no se anula desde acá: primero el recibo o la liquidación. */}
      {!b.aplicada && (
        <BotonTexto peligro etiqueta={`Anular ${b.nombre}`} onClick={() => onAnular(b)}>
          Anular
        </BotonTexto>
      )}
      <Button
        variant={b.vencimiento < hoyIso() ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => onPagar(b)}
        aria-label={`${texto} de ${b.nombre}`}
        className="pointer-coarse:min-h-10"
      >
        {texto}
      </Button>
    </div>
  );
}

function FilaBoleta({ b, hoy, onPagar, onAnular }: PropsBoleta) {
  const plata = lineaDePlata(b);
  const vencida = b.estado === 'pendiente' && b.vencimiento < hoy;
  return (
    <tr
      className="border-b border-line align-top last:border-0"
      // Quién la cargó no se repite en cada fila: queda a mano, al pasar el mouse.
      title={b.registradoPor ? `Cargó ${b.registradoPor}` : undefined}
    >
      <td
        className={`whitespace-nowrap px-3 py-2 tabular-nums ${vencida ? 'font-semibold text-danger' : 'text-muted'}`}
      >
        {cuandoVence(b, hoy)}
      </td>
      <td className="px-3 py-2">
        <span className="font-semibold text-ink">
          <span aria-hidden>{ICONO_CLASE[b.clase]} </span>
          {queEs(b)}
        </span>
        {b.numeroCuenta && <span className="text-xs text-muted"> · N° {b.numeroCuenta}</span>}
        <span className={`block text-xs ${CLASE_TONO[plata.tono]}`}>{plata.texto}</span>
      </td>
      <td className="px-3 py-2 text-muted">
        {b.propiedad}
        {b.contrato && (
          <Link
            href={`/alquileres/contratos/${b.contrato.id}`}
            className={`block w-fit rounded text-xs font-semibold text-ink hover:text-brand-red ${CLASE_FOCO}`}
          >
            {b.contrato.codigo}
          </Link>
        )}
      </td>
      <td
        className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${b.estado === 'anulada' ? 'text-muted line-through' : 'text-ink'}`}
      >
        {fmtMoneda(b.importe, b.moneda)}
      </td>
      <td className={`${CLASE_TD_ACCIONES} whitespace-nowrap`}>
        <Acciones b={b} onPagar={onPagar} onAnular={onAnular} />
      </td>
    </tr>
  );
}

function TarjetaBoleta({ b, hoy, onPagar, onAnular }: PropsBoleta) {
  const plata = lineaDePlata(b);
  const vencida = b.estado === 'pendiente' && b.vencimiento < hoy;
  return (
    <Tarjeta titulo={b.registradoPor ? `Cargó ${b.registradoPor}` : undefined}>
      <CabezaTarjeta
        titulo={`${ICONO_CLASE[b.clase]} ${queEs(b)}`}
        detalle={`${b.propiedad}${b.contrato ? ` · ${b.contrato.codigo}` : ''}${b.numeroCuenta ? ` · N° ${b.numeroCuenta}` : ''}`}
      />
      <p className={`mt-1 text-xs ${CLASE_TONO[plata.tono]}`}>{plata.texto}</p>
      <CamposTarjeta>
        <CampoTarjeta etiqueta="Importe">
          <span className={b.estado === 'anulada' ? 'text-muted line-through' : ''}>
            {fmtMoneda(b.importe, b.moneda)}
          </span>
        </CampoTarjeta>
        <CampoTarjeta etiqueta={b.estado === 'pagada' ? 'Pagada' : 'Vence'}>
          <span className={vencida ? 'font-semibold text-danger' : ''}>{cuandoVence(b, hoy)}</span>
        </CampoTarjeta>
      </CamposTarjeta>
      <div className="mt-2 border-t border-line pt-2">
        <Acciones b={b} onPagar={onPagar} onAnular={onAnular} />
      </div>
    </Tarjeta>
  );
}

function PagarBoletaModal({
  boleta: b,
  onClose,
  onDone,
}: {
  boleta: BoletaDto;
  onClose: () => void;
  onDone: () => void;
}) {
  const [fecha, setFecha] = useState(hoyIso());
  const [medio, setMedio] = useState<MedioCobro>('transferencia');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inmo = b.paga === 'inmobiliaria';
  return (
    <Modal
      title={
        inmo
          ? `Registrar el pago de ${queEs(b)}`
          : `${NOMBRE_QUIEN_PAGA[b.paga]} trajo el comprobante de ${queEs(b)}`
      }
      subtitle={`${b.propiedad} · ${fmtMoneda(b.importe, b.moneda)}. ${consecuenciaDeBoleta(b.aCargoDe, b.paga, b.contrato != null)}.`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label={inmo ? 'Fecha del pago' : 'Fecha del comprobante'}>
            <input
              type="date"
              className={inputClass}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </Campo>
          {/* Si la pagó una parte, solo se registra que trajo el comprobante: el medio no es nuestro. */}
          {inmo && (
            <Campo label="Medio">
              <select
                className={inputClass}
                value={medio}
                onChange={(e) => setMedio(e.target.value as MedioCobro)}
              >
                {MEDIOS_COBRO.map((v) => (
                  <option key={v} value={v}>
                    {NOMBRE_MEDIO[v]}
                  </option>
                ))}
              </select>
            </Campo>
          )}
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await pagarBoleta(await getAccessToken(), b.id, fecha, medio);
                onDone();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'No se pudo registrar.');
                setEnviando(false);
              }
            }}
          >
            {enviando ? 'Registrando…' : inmo ? 'Registrar el pago' : 'Registrar el comprobante'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// --- Qué tiene cada propiedad (regla 53) ---------------------------------------------

const nombrePropiedad = (p: PropiedadAlquilerDto) =>
  [p.direccion, p.unidad].filter(Boolean).join(' ');

/**
 * Qué impuestos y servicios tiene cada propiedad, con su número de cuenta y
 * qué pasa con la plata. Las propiedades sin ninguno también aparecen: si no,
 * no había forma de ver a cuáles les faltaba.
 */
function ImpuestosPorPropiedad({
  cuentas,
  servicios,
  propiedades,
}: {
  cuentas: CuentaServicioDto[];
  servicios: ServicioDto[];
  propiedades: PropiedadAlquilerDto[];
}) {
  const router = useRouter();
  const [editar, setEditar] = useState<
    CuentaServicioDto | { nueva: true; propiedadId: string } | null
  >(null);
  const [aBorrar, setABorrar] = useState<CuentaServicioDto | null>(null);
  const grupos = new Map<
    string,
    { direccion: string; contrato: string | null; cuentas: CuentaServicioDto[] }
  >();
  for (const c of cuentas) {
    const g = grupos.get(c.propiedad.id) ?? {
      direccion: c.propiedad.direccion,
      contrato: c.contrato?.codigo ?? null,
      cuentas: [],
    };
    g.cuentas.push(c);
    grupos.set(c.propiedad.id, g);
  }
  for (const p of propiedades)
    if (!grupos.has(p.id))
      grupos.set(p.id, { direccion: nombrePropiedad(p), contrato: null, cuentas: [] });
  const filas = [...grupos].sort(([, a], [, b]) => a.direccion.localeCompare(b.direccion, 'es'));
  const sinNada = filas.filter(([, g]) => g.cuentas.length === 0).length;
  const asignar = (propiedadId = '') => setEditar({ nueva: true, propiedadId });

  return (
    <Bloque
      icono="🏠"
      titulo="Qué tiene cada propiedad"
      detalle={`${cantidad(filas.length, 'propiedad', 'propiedades')}${sinNada ? ` · ${sinNada} sin ninguno` : ''}`}
      acciones={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => asignar()}
          disabled={servicios.length === 0}
        >
          ＋ Asignar un impuesto
        </Button>
      }
    >
      {servicios.length === 0 && (
        <VacioBloque>
          Para asignar impuestos y servicios, primero armá el catálogo de la inmobiliaria, abajo.
        </VacioBloque>
      )}
      {filas.length === 0 ? (
        <VacioBloque>Todavía no hay propiedades cargadas.</VacioBloque>
      ) : (
        <ul className="divide-y divide-line text-sm">
          {filas.map(([id, g]) => (
            <li key={id} className="px-4 py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">
                  {g.direccion}
                  {g.contrato && <span className="font-normal text-muted"> · {g.contrato}</span>}
                </p>
                {servicios.length > 0 && (
                  <BotonTexto
                    etiqueta={`Asignar un impuesto a ${g.direccion}`}
                    onClick={() => asignar(id)}
                  >
                    ＋ Asignar
                  </BotonTexto>
                )}
              </div>
              {g.cuentas.length === 0 ? (
                <p className="text-xs text-warning">Sin impuestos ni servicios asignados.</p>
              ) : (
                <ul className="mt-1 flex flex-col gap-1">
                  {g.cuentas.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 text-ink">
                        <span aria-hidden>{ICONO_CLASE[c.servicio.clase]} </span>
                        {c.servicio.nombre}
                        {c.numeroCuenta && (
                          <span className="text-xs text-muted"> · N° {c.numeroCuenta}</span>
                        )}
                        <span className="block text-xs text-muted">
                          {consecuenciaDeBoleta(c.aCargoDe, c.paga)}
                        </span>
                      </span>
                      <span className="flex items-center gap-1">
                        <BotonTexto
                          etiqueta={`Editar ${c.servicio.nombre} de ${c.propiedad.direccion}`}
                          onClick={() => setEditar(c)}
                        >
                          Editar
                        </BotonTexto>
                        <BotonTexto
                          peligro
                          etiqueta={`Quitar ${c.servicio.nombre} de ${c.propiedad.direccion}`}
                          onClick={() => setABorrar(c)}
                        >
                          Quitar
                        </BotonTexto>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {editar && (
        <CuentaModal
          cuenta={'nueva' in editar ? null : editar}
          propiedadInicial={'nueva' in editar ? editar.propiedadId : ''}
          servicios={servicios}
          propiedades={propiedades}
          onClose={() => setEditar(null)}
          onDone={() => {
            setEditar(null);
            router.refresh();
          }}
        />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Quitar ${aBorrar.servicio.nombre} de esta propiedad`}
          verbo={{ boton: 'Sí, quitar', enCurso: 'Quitando…' }}
          descripcion="Se quita solo si nunca tuvo boletas."
          detalle={<DatoBorrado etiqueta="Propiedad">{aBorrar.propiedad.direccion}</DatoBorrado>}
          onConfirm={async () => {
            await borrarCuentaServicio(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </Bloque>
  );
}

const claveQuienPaga = (aCargoDe: ParteDeudora, paga: QuienPaga) => `${aCargoDe}|${paga}`;

export function CuentaModal({
  cuenta: c,
  propiedadInicial = '',
  servicios,
  propiedades,
  onClose,
  onDone,
}: {
  cuenta: CuentaServicioDto | null;
  propiedadInicial?: string;
  servicios: ServicioDto[];
  propiedades: PropiedadAlquilerDto[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [propiedadId, setPropiedadId] = useState(c?.propiedad.id ?? propiedadInicial);
  const [servicioId, setServicioId] = useState(c?.servicio.id ?? servicios[0]?.id ?? '');
  const [numeroCuenta, setNumero] = useState(c?.numeroCuenta ?? '');
  // Un solo campo con la consecuencia (regla 46), en vez de «La debe» y «La paga» por separado.
  const [quien, setQuien] = useState(
    claveQuienPaga(c?.aCargoDe ?? 'inquilino', c?.paga ?? 'inquilino'),
  );
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function guardar() {
    const [aCargoDe, paga] = quien.split('|') as [ParteDeudora, QuienPaga];
    const dto = { propiedadId, servicioId, numeroCuenta, aCargoDe, paga };
    const r = CuentaServicioInputSchema.safeParse(dto);
    if (!r.success) {
      setError(primerMensaje(r.error, 'Revisá los datos.'));
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await guardarCuentaServicio(await getAccessToken(), c?.id ?? null, dto);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }

  return (
    <Modal
      title={
        c
          ? `Editar ${c.servicio.nombre} de ${c.propiedad.direccion}`
          : 'Asignar un impuesto o servicio'
      }
      onClose={onClose}
    >
      <div className="flex flex-col gap-3">
        <Campo label="Propiedad" requerido>
          <select
            className={inputClass}
            value={propiedadId}
            onChange={(e) => setPropiedadId(e.target.value)}
          >
            <option value="">Elegí la propiedad…</option>
            {propiedades.map((p) => (
              <option key={p.id} value={p.id}>
                {nombrePropiedad(p)}
              </option>
            ))}
          </select>
        </Campo>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Impuesto o servicio" requerido>
            <select
              className={inputClass}
              value={servicioId}
              onChange={(e) => setServicioId(e.target.value)}
            >
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Número de cuenta (el de la boleta)">
            <input
              className={inputClass}
              value={numeroCuenta}
              onChange={(e) => setNumero(e.target.value)}
            />
          </Campo>
        </div>
        <Campo label="Quién la paga y a quién se le carga">
          <select className={inputClass} value={quien} onChange={(e) => setQuien(e.target.value)}>
            {COMBINACIONES_QUIEN_PAGA.map(({ aCargoDe, paga }) => (
              <option key={claveQuienPaga(aCargoDe, paga)} value={claveQuienPaga(aCargoDe, paga)}>
                {consecuenciaDeBoleta(aCargoDe, paga)}
              </option>
            ))}
          </select>
        </Campo>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/** El catálogo de la inmobiliaria: API, TGI, EPE, gas, agua, expensas… Se arma una vez. */
function Catalogo({ servicios }: { servicios: ServicioDto[] }) {
  const router = useRouter();
  const [editar, setEditar] = useState<ServicioDto | 'nuevo' | null>(null);
  const [aBorrar, setABorrar] = useState<ServicioDto | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  return (
    <Bloque
      icono="📚"
      titulo="Catálogo de la inmobiliaria"
      detalle={cantidad(servicios.length, 'impuesto o servicio', 'impuestos y servicios')}
      acciones={
        <Button variant="secondary" size="sm" onClick={() => setEditar('nuevo')}>
          ＋ Nuevo
        </Button>
      }
    >
      {servicios.length === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-muted">
          <span>
            Vacío. Los habituales son{' '}
            {CATALOGO_SUGERIDO.map((s) => s.nombre.split(' (')[0]).join(', ')}.
          </span>
          <Button
            variant="primary"
            size="sm"
            disabled={sugiriendo}
            onClick={async () => {
              setSugiriendo(true);
              try {
                await cargarServiciosSugeridos(await getAccessToken());
                router.refresh();
              } finally {
                setSugiriendo(false);
              }
            }}
          >
            {sugiriendo ? 'Cargando…' : 'Cargar los habituales'}
          </Button>
        </div>
      ) : (
        <ul className="divide-y divide-line text-xs">
          {servicios.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5"
            >
              <span className="text-ink">
                <span aria-hidden>{ICONO_CLASE[s.clase]} </span>
                {s.nombre}
                <span className="text-muted">
                  {' '}
                  · {NOMBRE_CLASE_SERVICIO[s.clase].toLowerCase()} ·{' '}
                  {cantidad(s.cuentas, 'propiedad', 'propiedades')}
                </span>
              </span>
              <AccionesFila
                nombre={s.nombre}
                onEditar={() => setEditar(s)}
                onBorrar={() => setABorrar(s)}
              />
            </li>
          ))}
        </ul>
      )}
      {editar && (
        <ServicioModal
          servicio={editar === 'nuevo' ? null : editar}
          onClose={() => setEditar(null)}
          onDone={() => {
            setEditar(null);
            router.refresh();
          }}
        />
      )}
      {aBorrar && (
        <ConfirmarBorradoModal
          titulo={`Borrar ${aBorrar.nombre}`}
          descripcion="Se borra solo si ninguna propiedad lo tiene."
          detalle={
            <DatoBorrado etiqueta="Tipo">{NOMBRE_CLASE_SERVICIO[aBorrar.clase]}</DatoBorrado>
          }
          onConfirm={async () => {
            await borrarServicio(await getAccessToken(), aBorrar.id);
            router.refresh();
          }}
          onClose={() => setABorrar(null)}
        />
      )}
    </Bloque>
  );
}

function ServicioModal({
  servicio: s,
  onClose,
  onDone,
}: {
  servicio: ServicioDto | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [nombre, setNombre] = useState(s?.nombre ?? '');
  const [clase, setClase] = useState<ClaseServicio>(s?.clase ?? 'impuesto');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  async function guardar() {
    const r = ServicioInputSchema.safeParse({ nombre, clase });
    if (!r.success) {
      setError(primerMensaje(r.error, 'Revisá los datos.'));
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await guardarServicio(await getAccessToken(), s?.id ?? null, r.data);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
      setEnviando(false);
    }
  }
  return (
    <Modal title={s ? `Editar ${s.nombre}` : 'Nuevo impuesto o servicio'} onClose={onClose}>
      <div className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Campo label="Nombre" requerido>
            <input
              className={inputClass}
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              autoFocus
            />
          </Campo>
          <Campo label="Tipo">
            <select
              className={inputClass}
              value={clase}
              onChange={(e) => setClase(e.target.value as ClaseServicio)}
            >
              {Object.entries(NOMBRE_CLASE_SERVICIO).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Campo>
        </div>
        {error && (
          <p role="alert" className="text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={enviando}>
            {enviando ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
