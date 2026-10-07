import type { Prisma } from '@prisma/client';
import { NOMBRE_TIPO_CONTRATO } from '@vacker/types';
import { fechaCorta, importeEnLetras } from '@vacker/domain';
import { decToNum, fromDate } from '../tablero/tablero.util';
import { mesesDeContrato } from './contrato-completo.service';
import { plata } from './historial';

/**
 * Lo que se lee de un contrato para completar su plantilla: una sola consulta,
 * con las partes, la propiedad y los tramos adentro.
 */
export const SELECT_PLANTILLA = {
  codigo: true,
  tipo: true,
  moneda: true,
  inicio: true,
  fin: true,
  fechaFirma: true,
  ajuste: true,
  indice: true,
  periodicidadMeses: true,
  diaVencimiento: true,
  punitorioDiarioPct: true,
  depositoImporte: true,
  depositoMoneda: true,
  propiedad: { select: { direccion: true, unidad: true, ciudad: true } },
  partes: {
    select: {
      papel: true,
      porcentaje: true,
      persona: {
        select: { nombre: true, documento: true, cuit: true, domicilio: true, localidad: true },
      },
    },
    orderBy: { persona: { nombre: 'asc' } },
  },
  tramos: {
    select: { numero: true, desde: true, hasta: true, importe: true },
    orderBy: { numero: 'asc' },
  },
} satisfies Prisma.AlqContratoSelect;

export type ContratoParaPlantilla = Prisma.AlqContratoGetPayload<{
  select: typeof SELECT_PLANTILLA;
}>;

const NOMBRE_INDICE: Record<string, string> = {
  ICL: 'el Índice para Contratos de Locación (ICL) del BCRA',
  IPC: 'el Índice de Precios al Consumidor (IPC) del INDEC',
  CCP: 'el índice Casa Propia',
};

/** «20.123.456» o «20-12345678-6». */
const documento = (d: string | null) =>
  !d
    ? null
    : d.length === 11
      ? `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`
      : d.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Lo que va después de cada uno en «Juan, Ana y Pedro». */
const separador = (i: number, total: number) =>
  i === total - 1 ? '' : i === total - 2 ? ' y ' : ', ';

/**
 * Los datos con que se completa una plantilla de contrato. Las claves son los
 * nombres de `MARCADORES_PLANTILLA` (`@vacker/types`), y un test comprueba
 * que estén todos y que no sobre ninguno.
 *
 * Lo que el contrato necesita y falta queda a la vista («[sin cargar]»), para
 * que se note antes de firmar. Lo que es opcional (la fecha de firma, el
 * depósito) queda vacío.
 */
export function datosDePlantilla(
  c: ContratoParaPlantilla,
  inmobiliaria: string,
  hoy: string,
): Record<string, unknown> {
  const moneda = c.moneda as 'ARS' | 'USD';
  const personas = (papel: string) => {
    const delPapel = c.partes.filter((p) => p.papel === papel);
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
        ...(papel === 'propietario'
          ? {
              porcentaje:
                p.porcentaje != null ? `${decToNum(p.porcentaje).toLocaleString('es-AR')}%` : '',
            }
          : {}),
      };
    });
  };
  const todos = (lista: { texto: string }[]) =>
    lista.map((p) => p.texto).join('; ') || '[sin cargar]';

  const propietarios = personas('propietario');
  const inquilinos = personas('inquilino');
  const garantes = personas('garante');
  const inicio = fromDate(c.inicio)!;
  const fin = fromDate(c.fin)!;
  const primero = c.tramos[0]?.importe;
  const inicial = primero != null ? decToNum(primero) : null;
  const importeDeposito = c.depositoImporte != null ? decToNum(c.depositoImporte) : 0;
  const monedaDeposito = (c.depositoMoneda ?? c.moneda) as 'ARS' | 'USD';
  const deposito = importeDeposito
    ? {
        importe: plata(importeDeposito, monedaDeposito),
        letras: importeEnLetras(importeDeposito, monedaDeposito),
      }
    : null;

  return {
    inmobiliaria,
    'contrato.codigo': c.codigo,
    'contrato.tipo': NOMBRE_TIPO_CONTRATO[c.tipo as 'vivienda' | 'comercial'],
    'contrato.destino': c.tipo === 'comercial' ? 'uso comercial' : 'vivienda familiar',
    'contrato.inicio': fechaCorta(inicio),
    'contrato.fin': fechaCorta(fin),
    'contrato.meses': String(mesesDeContrato(inicio, fin)),
    'contrato.firma': c.fechaFirma ? fechaCorta(fromDate(c.fechaFirma)!) : '',
    'propiedad.direccion': [c.propiedad.direccion, c.propiedad.unidad].filter(Boolean).join(' '),
    'propiedad.ciudad': c.propiedad.ciudad ?? '[sin cargar]',
    'propietarios.texto': todos(propietarios),
    'inquilinos.texto': todos(inquilinos),
    'garantes.texto': todos(garantes),
    'alquiler.inicial': inicial != null ? plata(inicial, moneda) : '[sin cargar]',
    'alquiler.inicial.letras': inicial != null ? importeEnLetras(inicial, moneda) : '[sin cargar]',
    ajuste:
      c.ajuste === 'indexado' && c.indice
        ? `${NOMBRE_INDICE[c.indice] ?? c.indice}, cada ${c.periodicidadMeses} meses`
        : 'los importes escalonados que se detallan',
    'vencimiento.dia': String(c.diaVencimiento),
    punitorio: `${decToNum(c.punitorioDiarioPct).toLocaleString('es-AR')}%`,
    'deposito.importe': deposito?.importe ?? '',
    'deposito.letras': deposito?.letras ?? '',
    'fecha.hoy': fechaCorta(hoy),
    deposito,
    indexado: c.ajuste === 'indexado',
    escalonado: c.ajuste === 'escalonado',
    comercial: c.tipo === 'comercial',
    propietarios,
    inquilinos,
    garantes,
    tramos: c.tramos.map((t) => {
      const importe = t.importe != null ? decToNum(t.importe) : null;
      return {
        numero: String(t.numero),
        desde: fechaCorta(fromDate(t.desde)!),
        hasta: fechaCorta(fromDate(t.hasta)!),
        importe: importe != null ? plata(importe, moneda) : 'según el índice',
        letras: importe != null ? importeEnLetras(importe, moneda) : '',
      };
    }),
  };
}
