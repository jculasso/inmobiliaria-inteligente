import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { CobroDto } from '@vacker/types';
import { FUENTE_MARCA } from '../tasador/informes/fuentes';

// Recibo de un cobro (spec alquileres, regla 23). Mismo encabezado que los
// demás informes. Lleva la leyenda de «no válido como factura» hasta que la
// fase 2 sume la facturación electrónica.

const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
export const DANGER = '#C1121F';

export const LEYENDA_NO_FACTURA = 'Documento no válido como factura';

export const MEDIO: Record<CobroDto['medio'], string> = {
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
  cheque: 'Cheque',
  otro: 'Otro',
};

export function crearEstilos(red: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingHorizontal: 36,
      paddingBottom: 52,
      fontSize: 9,
      color: INK,
      fontFamily: FUENTE_MARCA,
    },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logoBox: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    logoImg: { width: 72, height: 72, objectFit: 'contain' },
    logoFallback: { width: 72, height: 72, borderRadius: 12, backgroundColor: red },
    brandName: { fontSize: 11, fontWeight: 700, color: INK },
    docMeta: { alignItems: 'flex-end' },
    docMetaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    docMetaValue: { fontSize: 8.5, color: MUTED, marginTop: 2 },
    kicker: { fontSize: 8, fontWeight: 700, color: red, letterSpacing: 1.5, marginTop: 16 },
    title: { fontSize: 16, fontWeight: 800, marginTop: 4 },
    divider: { height: 2.5, backgroundColor: red, marginTop: 12, marginBottom: 14 },
    datos: { flexDirection: 'row', gap: 24, marginBottom: 14 },
    datoLabel: { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    datoValor: { fontSize: 10, fontWeight: 700, marginTop: 2 },
    fila: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: LINE,
      paddingVertical: 6,
    },
    filaHead: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: INK,
      paddingVertical: 4,
    },
    th: { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    colContrato: { width: '14%' },
    colConcepto: { width: '62%' },
    colImporte: { width: '24%', textAlign: 'right' },
    nota: { fontSize: 7.5, color: MUTED },
    total: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 10 },
    subtotal: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, marginTop: 4 },
    subtotalLabel: { fontSize: 8.5, color: MUTED },
    subtotalValor: { fontSize: 9, width: 110, textAlign: 'right' },
    totalLabel: { fontSize: 9, fontWeight: 700, color: MUTED },
    totalValor: { fontSize: 14, fontWeight: 800 },
    aFavor: { textAlign: 'right', marginTop: 4, fontSize: 9, color: MUTED },
    obs: { marginTop: 14, fontSize: 8, color: MUTED },
    anulado: {
      marginTop: 14,
      padding: 10,
      borderWidth: 1.5,
      borderColor: DANGER,
      color: DANGER,
      fontSize: 11,
      fontWeight: 800,
      textAlign: 'center',
    },
    pie: {
      position: 'absolute',
      bottom: 24,
      left: 36,
      right: 36,
      textAlign: 'center',
      fontSize: 8,
      fontWeight: 700,
      color: MUTED,
    },
  });
}

export const pesos = (n: number, moneda: CobroDto['moneda']) =>
  `${moneda === 'USD' ? 'U$S' : '$'} ${n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const fecha = (iso: string) => iso.split('-').reverse().join('/');

export function ReciboDocument({
  cobro,
  tenantNombre,
  logoUrl,
  colorPrimario,
}: {
  cobro: CobroDto;
  tenantNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}) {
  const e = crearEstilos(colorPrimario || DANGER);
  const centavos = (n: number) => Math.round(n * 100);
  const saldoUsado =
    cobro.imputaciones
      .filter((i) => i.deSaldoAFavor != null)
      .reduce((s, i) => s + centavos(i.sentido === 'a_pagar' ? -i.importe : i.importe), 0) / 100;
  const cancelado =
    cobro.imputaciones.reduce(
      (s, i) => s + centavos(i.sentido === 'a_pagar' ? -i.importe : i.importe),
      0,
    ) / 100;
  const numero = String(cobro.numero).padStart(6, '0');
  return (
    <Document title={`Recibo ${numero} — ${tenantNombre}`} author={tenantNombre}>
      <Page size="A4" style={e.page}>
        <View style={e.header}>
          <View style={e.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={e.logoImg} /> : <View style={e.logoFallback} />}
            <Text style={e.brandName}>{tenantNombre}</Text>
          </View>
          <View style={e.docMeta}>
            <Text style={e.docMetaLabel}>RECIBO N° {numero}</Text>
            <Text style={e.docMetaValue}>{fecha(cobro.fecha)}</Text>
          </View>
        </View>

        <Text style={e.kicker}>ALQUILERES</Text>
        <Text style={e.title}>Recibimos de {cobro.persona.nombre}</Text>
        <View style={e.divider} />

        <View style={e.datos}>
          <View>
            <Text style={e.datoLabel}>IMPORTE RECIBIDO</Text>
            <Text style={e.datoValor}>{pesos(cobro.importe, cobro.moneda)}</Text>
          </View>
          <View>
            <Text style={e.datoLabel}>MEDIO</Text>
            <Text style={e.datoValor}>{MEDIO[cobro.medio]}</Text>
          </View>
          <View>
            <Text style={e.datoLabel}>FECHA</Text>
            <Text style={e.datoValor}>{fecha(cobro.fecha)}</Text>
          </View>
          {/* Quién lo registró: va en el recibo (decidido con Javier el 6/10/2026). */}
          {cobro.registradoPor && (
            <View>
              <Text style={e.datoLabel}>OPERADOR</Text>
              <Text style={e.datoValor}>{cobro.registradoPor}</Text>
            </View>
          )}
        </View>

        <View style={e.filaHead}>
          <Text style={[e.th, e.colContrato]}>CONTRATO</Text>
          <Text style={[e.th, e.colConcepto]}>CONCEPTO</Text>
          <Text style={[e.th, e.colImporte]}>IMPORTE</Text>
        </View>
        {cobro.imputaciones.map((i, n) => (
          <View key={n} style={e.fila} wrap={false}>
            <Text style={e.colContrato}>{i.contrato?.codigo ?? '—'}</Text>
            <View style={e.colConcepto}>
              <Text>{i.descripcion}</Text>
              {i.sentido === 'a_pagar' && (
                <Text style={e.nota}>Reintegro a su favor, descontado de lo que debía</Text>
              )}
              {i.deSaldoAFavor != null && (
                <Text style={e.nota}>
                  Pagado con el saldo a favor del recibo {String(i.deSaldoAFavor).padStart(6, '0')}
                </Text>
              )}
            </View>
            <Text style={e.colImporte}>
              {i.sentido === 'a_pagar' ? '− ' : ''}
              {pesos(i.importe, cobro.moneda)}
            </Text>
          </View>
        ))}

        {saldoUsado > 0 && (
          // Lo pagado con saldo a favor figura entre los conceptos pero no es
          // plata de este recibo: sin esta resta, las líneas sumaban más que el
          // total (pasada de pruebas del 6/10/2026).
          <>
            <View style={e.subtotal}>
              <Text style={e.subtotalLabel}>Conceptos cancelados</Text>
              <Text style={e.subtotalValor}>{pesos(cancelado, cobro.moneda)}</Text>
            </View>
            <View style={e.subtotal}>
              <Text style={e.subtotalLabel}>Menos lo pagado con saldo a favor</Text>
              <Text style={e.subtotalValor}>− {pesos(saldoUsado, cobro.moneda)}</Text>
            </View>
          </>
        )}
        <View style={e.total}>
          <Text style={e.totalLabel}>TOTAL RECIBIDO</Text>
          <Text style={e.totalValor}>{pesos(cobro.importe, cobro.moneda)}</Text>
        </View>
        {cobro.aFavor > 0 && (
          <Text style={e.aFavor}>
            Queda a su favor para el próximo pago: {pesos(cobro.aFavor, cobro.moneda)}
          </Text>
        )}
        {cobro.obs && <Text style={e.obs}>{cobro.obs}</Text>}
        {cobro.anulado && (
          <Text
            style={e.anulado}
          >{`RECIBO ANULADO · ${cobro.anulado.motivo}${cobro.anulado.por ? ` · ${cobro.anulado.por}` : ''}`}</Text>
        )}

        <Text style={e.pie} fixed>
          {LEYENDA_NO_FACTURA}
        </Text>
      </Page>
    </Document>
  );
}
