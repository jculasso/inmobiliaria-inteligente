import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import type { LineaLiquidacion, LiquidacionDto } from '@vacker/types';
import { crearEstilos, DANGER, fecha, LEYENDA_NO_FACTURA, MEDIO, pesos } from './recibo.template';

// Liquidación al propietario (regla 23): lo cobrado a su favor, cada
// descuento y el neto. Mismo encabezado y estilos que el recibo.

export function LiquidacionDocument({
  liquidacion: l,
  tenantNombre,
  logoUrl,
  colorPrimario,
}: {
  liquidacion: LiquidacionDto;
  tenantNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}) {
  const e = crearEstilos(colorPrimario || DANGER);
  const numero = String(l.numero).padStart(6, '0');
  const total = (xs: LineaLiquidacion[]) => xs.reduce((s, x) => s + x.importe, 0);
  const Bloque = ({ titulo, lineas, signo }: { titulo: string; lineas: LineaLiquidacion[]; signo: string }) => (
    <View style={{ marginBottom: 12 }}>
      <View style={e.filaHead}>
        <Text style={[e.th, e.colContrato]}>CONTRATO</Text>
        <Text style={[e.th, e.colConcepto]}>{titulo}</Text>
        <Text style={[e.th, e.colImporte]}>IMPORTE</Text>
      </View>
      {lineas.map((x) => (
        <View key={x.conceptoId} style={e.fila} wrap={false}>
          <Text style={e.colContrato}>{x.contrato?.codigo ?? '—'}</Text>
          <Text style={e.colConcepto}>{x.descripcion}</Text>
          <Text style={e.colImporte}>
            {signo}
            {pesos(x.importe, l.moneda)}
          </Text>
        </View>
      ))}
      <View style={e.fila}>
        <Text style={e.colContrato} />
        <Text style={[e.colConcepto, { fontWeight: 700 }]}>Subtotal</Text>
        <Text style={[e.colImporte, { fontWeight: 700 }]}>
          {signo}
          {pesos(total(lineas), l.moneda)}
        </Text>
      </View>
    </View>
  );

  return (
    <Document title={`Liquidación ${numero} — ${tenantNombre}`} author={tenantNombre}>
      <Page size="A4" style={e.page}>
        <View style={e.header}>
          <View style={e.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={e.logoImg} /> : <View style={e.logoFallback} />}
            <Text style={e.brandName}>{tenantNombre}</Text>
          </View>
          <View style={e.docMeta}>
            <Text style={e.docMetaLabel}>LIQUIDACIÓN N° {numero}</Text>
            <Text style={e.docMetaValue}>{fecha(l.fecha)}</Text>
          </View>
        </View>

        <Text style={e.kicker}>ALQUILERES · LIQUIDACIÓN AL PROPIETARIO</Text>
        <Text style={e.title}>{l.persona.nombre}</Text>
        <View style={e.divider} />

        <Bloque titulo="COBRADO A SU FAVOR" lineas={l.aPagar} signo="" />
        {l.aDescontar.length > 0 && <Bloque titulo="DESCUENTOS" lineas={l.aDescontar} signo="− " />}

        <View style={e.total}>
          <Text style={e.totalLabel}>NETO A PAGAR</Text>
          <Text style={e.totalValor}>{pesos(l.neto, l.moneda)}</Text>
        </View>
        <Text style={e.aFavor}>Medio de pago: {MEDIO[l.medio]}</Text>
        {l.anulado && <Text style={e.anulado}>LIQUIDACIÓN ANULADA · {l.anulado.motivo}</Text>}

        <Text style={e.pie} fixed>
          {LEYENDA_NO_FACTURA}
        </Text>
      </Page>
    </Document>
  );
}
