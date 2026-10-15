import { Prisma } from '@prisma/client';
import { NOMBRE_TIPO_CONTRATO, NOMBRE_TIPO_GARANTIA, type TipoGarantia } from '@vacker/types';
import { fechaCorta, importeEnLetras, sumarDiasIso, sumarMesesIso } from '@vacker/domain';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { plata } from './historial';
import { nroRecibo } from './numeracion';
import { CONCEPTOS_DE_LA_SENA, senaDto } from './sena';

/**
 * Lo que se lee de una reserva para completar su plantilla (reglas 162 y
 * 163): una sola consulta, con la propiedad, las partes y las garantías
 * adentro.
 */
export const SELECT_RESERVA_PLANTILLA = {
  numero: true,
  fecha: true,
  vence: true,
  obs: true,
  senaImporte: true,
  senaMoneda: true,
  // La seña cobrada y su recibo (regla 169).
  conceptos: CONCEPTOS_DE_LA_SENA,
  tipo: true,
  moneda: true,
  alquilerInicial: true,
  inicio: true,
  duracionMeses: true,
  ajuste: true,
  indice: true,
  periodicidadMeses: true,
  depositoImporte: true,
  depositoMoneda: true,
  propiedad: { select: { direccion: true, unidad: true, ciudad: true } },
  partes: {
    select: {
      papel: true,
      personaId: true,
      persona: {
        select: {
          nombre: true,
          documento: true,
          cuit: true,
          domicilio: true,
          localidad: true,
          telefono: true,
          email: true,
        },
      },
    },
    orderBy: { persona: { nombre: 'asc' } },
  },
  garantias: {
    select: { tipo: true, garante: true, personaId: true, detalle: true, estado: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.AlqReservaSelect;

export type ReservaParaPlantilla = Prisma.AlqReservaGetPayload<{
  select: typeof SELECT_RESERVA_PLANTILLA;
}>;

const NOMBRE_INDICE: Record<string, string> = {
  ICL: 'el Índice para Contratos de Locación (ICL) del BCRA',
  IPC: 'el Índice de Precios al Consumidor (IPC) del INDEC',
  CCP: 'el índice Casa Propia',
};

/** Una condición propuesta que no se cargó: en el formulario se ve que falta definirla. */
const A_DEFINIR = '[a definir]';

/** «20.123.456» o «20-12345678-6», como en el contrato. */
const documento = (d: string | null) =>
  !d
    ? null
    : d.length === 11
      ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
      : d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const separador = (i: number, total: number) =>
  i === total - 1 ? '' : i === total - 2 ? ' y ' : ', ';

/**
 * Los datos con que se completa una plantilla de reserva. Las claves son los
 * nombres de `MARCADORES_RESERVA` (`@vacker/types`), y un test comprueba que
 * estén todos y que no sobre ninguno, como `datosDePlantilla` con el
 * contrato.
 *
 * Lo opcional que falta queda vacío (observaciones, la seña sin recibir); una
 * condición propuesta sin cargar dice «[a definir]» (regla 163).
 */
export function datosDeReserva(
  r: ReservaParaPlantilla,
  inmobiliaria: string,
  hoy: string,
): Record<string, unknown> {
  const moneda = r.moneda as 'ARS' | 'USD';
  const personas = (papel: string) => {
    const delPapel = r.partes.filter((p) => p.papel === papel);
    return delPapel.map((p, i) => {
      const doc = documento(p.persona.documento) ?? documento(p.persona.cuit) ?? '';
      const domicilio = [p.persona.domicilio, p.persona.localidad].filter(Boolean).join(', ');
      return {
        nombre: p.persona.nombre,
        documento: doc,
        domicilio,
        texto: [
          p.persona.nombre,
          doc && `DNI/CUIT ${doc}`,
          domicilio && `con domicilio en ${domicilio}`,
        ]
          .filter(Boolean)
          .join(', '),
        separador: separador(i, delPapel.length),
      };
    });
  };
  const todos = (lista: { texto: string }[]) => lista.map((p) => p.texto).join('; ');
  const interesados = personas('inquilino');
  const propietarios = personas('propietario');
  const garantes = personas('garante');
  const primero = r.partes.find((p) => p.papel === 'inquilino')?.persona;
  // El garante de una garantía es una persona de la reserva o un nombre suelto.
  const nombrePorId = new Map(r.partes.map((p) => [p.personaId, p.persona.nombre]));

  const importe = (n: Prisma.Decimal | null, m: string | null) => {
    if (n == null) return null;
    const valor = decToNum(n);
    if (!valor) return null;
    const mon = (m ?? moneda) as 'ARS' | 'USD';
    return { importe: plata(valor, mon), letras: importeEnLetras(valor, mon) };
  };
  // La seña que se cobró manda sobre la acordada: es la del recibo.
  const s = senaDto(r, r.conceptos);
  const sena = s ? importe(new Prisma.Decimal(s.importe), s.moneda) : null;
  const deposito = importe(r.depositoImporte, r.depositoMoneda);
  const alquiler = r.alquilerInicial != null ? decToNum(r.alquilerInicial) : null;
  const inicio = fromDate(r.inicio);
  const fin =
    inicio && r.duracionMeses ? sumarDiasIso(sumarMesesIso(inicio, r.duracionMeses), -1) : null;

  return {
    inmobiliaria,
    'reserva.numero': String(r.numero),
    'reserva.fecha': fechaCorta(fromDate(r.fecha)!),
    'reserva.vence': fechaCorta(fromDate(r.vence)!),
    'reserva.observaciones': r.obs ?? '',
    'propiedad.direccion': [r.propiedad.direccion, r.propiedad.unidad].filter(Boolean).join(' '),
    'propiedad.ciudad': r.propiedad.ciudad ?? '[sin cargar]',
    'interesado.nombre': primero?.nombre ?? '[sin cargar]',
    'interesado.documento':
      (primero && (documento(primero.documento) ?? documento(primero.cuit))) ?? '',
    'interesado.domicilio': primero
      ? [primero.domicilio, primero.localidad].filter(Boolean).join(', ')
      : '',
    'interesado.telefono': primero?.telefono ?? '',
    'interesado.email': primero?.email ?? '',
    'interesados.texto': todos(interesados) || '[sin cargar]',
    'propietarios.texto': todos(propietarios),
    'garantes.texto': todos(garantes),
    'sena.importe': sena?.importe ?? '',
    'sena.letras': sena?.letras ?? '',
    'sena.fecha': s?.recibidaEl ? fechaCorta(s.recibidaEl) : '',
    'sena.medio': s?.medio ?? '',
    'sena.recibo': s?.recibo ? nroRecibo(s.recibo.numero) : '',
    'contrato.tipo': NOMBRE_TIPO_CONTRATO[r.tipo as 'vivienda' | 'comercial'],
    'contrato.destino': r.tipo === 'comercial' ? 'uso comercial' : 'vivienda familiar',
    'contrato.inicio': inicio ? fechaCorta(inicio) : A_DEFINIR,
    'contrato.fin': fin ? fechaCorta(fin) : A_DEFINIR,
    'contrato.meses': r.duracionMeses ? String(r.duracionMeses) : A_DEFINIR,
    'alquiler.inicial': alquiler != null ? plata(alquiler, moneda) : A_DEFINIR,
    'alquiler.inicial.letras': alquiler != null ? importeEnLetras(alquiler, moneda) : A_DEFINIR,
    ajuste:
      r.ajuste === 'indexado'
        ? r.indice
          ? `${NOMBRE_INDICE[r.indice] ?? r.indice}${r.periodicidadMeses ? `, cada ${r.periodicidadMeses} meses` : ''}`
          : A_DEFINIR
        : 'los importes escalonados que se acuerden',
    'deposito.importe': deposito?.importe ?? '',
    'deposito.letras': deposito?.letras ?? '',
    'fecha.hoy': fechaCorta(hoy),
    sena,
    sena_recibida: !!s?.recibida,
    deposito,
    indexado: r.ajuste === 'indexado',
    escalonado: r.ajuste === 'escalonado',
    comercial: r.tipo === 'comercial',
    interesados,
    propietarios,
    garantes,
    garantias: r.garantias.map((g) => ({
      tipo: NOMBRE_TIPO_GARANTIA[g.tipo as TipoGarantia] ?? g.tipo,
      garante: g.garante ?? (g.personaId ? nombrePorId.get(g.personaId) : undefined) ?? '',
      detalle: g.detalle ?? '',
      estado: g.estado,
    })),
  };
}
