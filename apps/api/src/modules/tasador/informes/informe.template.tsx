import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { promedioUsdM2 } from '@vacker/domain';
import type { TasacionDto } from '@vacker/types';

// Layout de las 7 secciones del informe, en el mismo orden que el prototipo
// (docs/prototipos/tasador_de_propiedades.html, bloque "REPORT VIEW"):
// 1. Resumen ejecutivo · 2. Características · 3. Análisis comercial ·
// 4. Comparables de mercado · 5. Estimación de valor ·
// 6. Estrategia de comercialización · 7. Conclusión.

const RED = '#C1121F';
const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  brandName: { fontSize: 14, fontWeight: 700, color: RED },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: INK,
    marginTop: 16,
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: LINE,
    paddingBottom: 3,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card: {
    width: '31%',
    borderWidth: 1,
    borderColor: LINE,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  cardLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase' },
  cardValue: { fontSize: 11, fontWeight: 700, marginTop: 2 },
  fichaRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3, borderBottomWidth: 1, borderBottomColor: LINE },
  fichaLabel: { color: MUTED },
  fichaValue: { fontWeight: 700 },
  paragraph: { lineHeight: 1.5, color: INK },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#F4F5F7', borderBottomWidth: 1, borderBottomColor: LINE },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
  th: { flex: 1, padding: 4, fontSize: 8, color: MUTED, textTransform: 'uppercase' },
  td: { flex: 1, padding: 4, fontSize: 9 },
  disclaimer: { marginTop: 12, fontSize: 8, color: MUTED, lineHeight: 1.4 },
});

function Card({ label, value, destacado }: { label: string; value: string; destacado?: boolean }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, destacado ? { color: RED } : {}]}>{value}</Text>
    </View>
  );
}

function FichaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fichaRow}>
      <Text style={styles.fichaLabel}>{label}</Text>
      <Text style={styles.fichaValue}>{value}</Text>
    </View>
  );
}

function fmtUSD(v: number | null): string {
  if (v == null) return '—';
  return `USD ${Math.round(v).toLocaleString('es-AR')}`;
}

function textoAnalisisComercial(t: TasacionDto): string {
  const a = t.analisisComercial;
  if (!a) return 'Sin análisis comercial cargado todavía.';
  const partes: string[] = [];
  if (a.fortalezas.length > 0) partes.push(`Fortalezas destacadas: ${a.fortalezas.join(', ')}.`);
  if (a.aspectos.length > 0) partes.push(`Aspectos a considerar: ${a.aspectos.join(', ')}.`);
  if (a.demanda) partes.push(`La demanda estimada para este tipo de propiedad es ${a.demanda.toLowerCase()}.`);
  if (a.competencia) partes.push(`El nivel de competencia en la zona es ${a.competencia.toLowerCase()}.`);
  if (a.perfilComprador) partes.push(`El perfil de comprador esperado es: ${a.perfilComprador.toLowerCase()}.`);
  if (a.observacionesComerciales) partes.push(a.observacionesComerciales);
  return partes.length > 0 ? partes.join(' ') : 'Sin análisis comercial cargado todavía.';
}

function textoConclusion(t: TasacionDto): string {
  return (
    `En base a las características relevadas y al análisis de mercado realizado, se estima un valor ` +
    `recomendado de ${fmtUSD(t.valorRecomendado)} para la propiedad ubicada en ${t.direccion}, ` +
    `dentro de un escenario de ${t.escenarioRecomendado?.toLowerCase() ?? 'venta equilibrada'} ` +
    `y un plazo estimado de comercialización de ${t.plazoEstimado ?? 'a definir'}.`
  );
}

export function InformeDocument({
  tasacion,
  tenantNombre,
  logoUrl,
}: {
  tasacion: TasacionDto;
  tenantNombre: string;
  logoUrl?: string | null;
}) {
  const t = tasacion;
  const promedio = promedioUsdM2(t.comparables);

  return (
    <Document title={`Informe de tasación — ${t.direccion}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brandName}>{tenantNombre}</Text>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        <Text style={styles.sectionTitle}>1. Resumen ejecutivo</Text>
        <View style={styles.row}>
          <Card label="Tipo" value={t.tipoPropiedad} />
          <Card label="Ubicación" value={`${t.direccion}${t.barrio ? `, ${t.barrio}` : ''}`} />
          <Card label="Superficie total" value={`${t.superficieTotal} m²`} />
          <Card label="Estado general" value={t.estadoInmueble ?? '—'} />
          <Card label="Valor mínimo" value={fmtUSD(t.valorMinimo)} />
          <Card label="Valor recomendado" value={fmtUSD(t.valorRecomendado)} destacado />
          <Card label="Escenario" value={t.escenarioRecomendado ?? '—'} />
          <Card label="Plazo estimado" value={t.plazoEstimado ?? '—'} />
        </View>

        <Text style={styles.sectionTitle}>2. Características de la propiedad</Text>
        <FichaRow label="Tipo de propiedad" value={t.tipoPropiedad} />
        <FichaRow label="Tipo de operación" value={t.tipoOperacion} />
        <FichaRow label="Ambientes" value={String(t.ambientes ?? '—')} />
        <FichaRow label="Dormitorios" value={String(t.dormitorios ?? '—')} />
        <FichaRow label="Baños" value={String(t.banos ?? '—')} />
        <FichaRow label="Sup. cubierta" value={`${t.supCubierta} m²`} />
        <FichaRow label="Sup. semicubierta" value={`${t.supSemicubierta} m²`} />
        <FichaRow label="Sup. descubierta" value={`${t.supDescubierta} m²`} />
        <FichaRow label="Sup. total" value={`${t.superficieTotal} m²`} />

        <Text style={styles.sectionTitle}>3. Análisis comercial</Text>
        <Text style={styles.paragraph}>{textoAnalisisComercial(t)}</Text>

        {t.comparables.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>4. Comparables de mercado</Text>
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.th}>Dirección</Text>
                <Text style={styles.th}>Sup.</Text>
                <Text style={styles.th}>Precio</Text>
                <Text style={styles.th}>USD/m²</Text>
              </View>
              {t.comparables.map((c) => (
                <View key={c.id} style={styles.tableRow}>
                  <Text style={styles.td}>{c.direccion}</Text>
                  <Text style={styles.td}>{c.superficie} m²</Text>
                  <Text style={styles.td}>{fmtUSD(c.precio)}</Text>
                  <Text style={styles.td}>{fmtUSD(c.usdM2)}</Text>
                </View>
              ))}
            </View>
            <Text style={[styles.paragraph, { marginTop: 6 }]}>
              Promedio USD/m² de los comparables: {fmtUSD(promedio)}.
            </Text>
          </>
        )}

        <Text style={styles.sectionTitle}>5. Estimación de valor</Text>
        <FichaRow label="Valor mínimo" value={fmtUSD(t.valorMinimo)} />
        <FichaRow label="Valor recomendado" value={fmtUSD(t.valorRecomendado)} />
        <FichaRow label="Valor aspiracional" value={fmtUSD(t.valorAspiracional)} />
        <FichaRow label="Margen de negociación" value={t.margenNegociacion != null ? `${t.margenNegociacion}%` : '—'} />
        <FichaRow label="Escenario recomendado" value={t.escenarioRecomendado ?? '—'} />
        <FichaRow label="Plazo estimado" value={t.plazoEstimado ?? '—'} />

        <Text style={styles.sectionTitle}>6. Estrategia de comercialización</Text>
        <Text style={styles.paragraph}>
          {t.estrategiaComercial && t.estrategiaComercial.estrategia.length > 0
            ? t.estrategiaComercial.estrategia.join(' · ')
            : 'Sin acciones de estrategia cargadas todavía.'}
        </Text>
        {t.estrategiaComercial?.observacionesEstrategia && (
          <Text style={[styles.paragraph, { marginTop: 6, fontStyle: 'italic' }]}>
            {t.estrategiaComercial.observacionesEstrategia}
          </Text>
        )}

        <Text style={styles.sectionTitle}>7. Conclusión</Text>
        <Text style={styles.paragraph}>{textoConclusion(t)}</Text>
        <Text style={styles.disclaimer}>
          El presente informe constituye una estimación comercial realizada en base a la información
          disponible al momento de su elaboración y a un relevamiento de mercado comparativo. No
          constituye una tasación con validez legal ni un peritaje técnico.
        </Text>
      </Page>
    </Document>
  );
}
