import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import { agruparPorContrato, type LineaLiquidacion, type LiquidacionDto } from '@vacker/types';
import { crearEstilos, DANGER, fecha, LEYENDA_NO_FACTURA, MEDIO, pesos } from './recibo.template';

// Liquidación al propietario (regla 23), una propiedad por bloque: qué
// propiedad es, quién la alquila, lo cobrado a su favor, cada descuento y lo
// que deja; al final, el neto. Mismo encabezado y estilos que el recibo.

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
  const grupos = agruparPorContrato(l);
  // Un solo texto por renglón: partido en pedazos, el PDF los guarda sueltos.
  const detalleDe = (c: (typeof grupos)[number]['contrato']) => {
    const xs = c?.inquilinos ?? [];
    return `${xs.length > 1 ? 'Inquilinos' : 'Inquilino'}: ${xs.join(', ') || '—'}   ·   Propietario: ${l.persona.nombre}   ·   Contrato: ${c?.codigo ?? '—'}`;
  };
  const Linea = ({ x, signo }: { x: LineaLiquidacion; signo: string }) => (
    <View style={e.fila} wrap={false}>
      <Text style={[e.colConcepto, { width: '76%' }]}>{x.descripcion}</Text>
      <Text style={e.colImporte}>
        {signo}
        {pesos(x.importe, l.moneda)}
      </Text>
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

        <View style={e.datos}>
          <View>
            <Text style={e.datoLabel}>PROPIETARIO</Text>
            <Text style={e.datoValor}>{l.persona.nombre}</Text>
          </View>
          <View>
            <Text style={e.datoLabel}>PROPIEDADES</Text>
            <Text style={e.datoValor}>{grupos.length}</Text>
          </View>
          <View>
            <Text style={e.datoLabel}>MEDIO DE PAGO</Text>
            <Text style={e.datoValor}>{MEDIO[l.medio]}</Text>
          </View>
          {l.registradoPor && (
            <View>
              <Text style={e.datoLabel}>OPERADOR</Text>
              <Text style={e.datoValor}>{l.registradoPor}</Text>
            </View>
          )}
        </View>

        {/* Una propiedad por bloque: qué es, quién la alquila y lo suyo. */}
        {grupos.map((g) => (
          <View key={g.contrato?.id ?? 'otros'} style={{ marginBottom: 14 }} wrap={false}>
            <View
              style={{ backgroundColor: '#F4F5F7', padding: 8, borderRadius: 4, marginBottom: 4 }}
            >
              <Text
                style={{ fontSize: 10, fontWeight: 800 }}
              >{`PROPIEDAD: ${g.contrato?.propiedad || '—'}`}</Text>
              <Text style={{ fontSize: 8.5, marginTop: 3 }}>{detalleDe(g.contrato)}</Text>
            </View>
            <View style={e.filaHead}>
              <Text style={[e.th, { width: '76%' }]}>CONCEPTO</Text>
              <Text style={[e.th, e.colImporte]}>IMPORTE</Text>
            </View>
            {g.aPagar.map((x) => (
              <Linea key={x.conceptoId} x={x} signo="" />
            ))}
            {g.aDescontar.map((x) => (
              <Linea key={x.conceptoId} x={x} signo="− " />
            ))}
            <View style={e.fila}>
              <Text style={[e.colConcepto, { width: '76%', fontWeight: 700 }]}>
                Subtotal de la propiedad
              </Text>
              <Text style={[e.colImporte, { fontWeight: 700 }]}>{pesos(g.subtotal, l.moneda)}</Text>
            </View>
          </View>
        ))}

        <View style={e.total}>
          <Text style={e.totalLabel}>NETO A PAGAR</Text>
          <Text style={e.totalValor}>{pesos(l.neto, l.moneda)}</Text>
        </View>
        {l.cuentaDestino && (
          <Text style={e.aFavor}>
            {`Se transfiere a: ${l.cuentaDestino.banco}${l.cuentaDestino.cbu ? ` · CBU ${l.cuentaDestino.cbu}` : ''}${l.cuentaDestino.alias ? ` · Alias ${l.cuentaDestino.alias}` : ''}${l.cuentaDestino.titular ? ` · ${l.cuentaDestino.titular}` : ''}`}
          </Text>
        )}
        {l.anulado && (
          <Text
            style={e.anulado}
          >{`LIQUIDACIÓN ANULADA · ${l.anulado.motivo}${l.anulado.por ? ` · ${l.anulado.por}` : ''}`}</Text>
        )}

        <Text style={e.pie} fixed>
          {LEYENDA_NO_FACTURA}
        </Text>
      </Page>
    </Document>
  );
}
