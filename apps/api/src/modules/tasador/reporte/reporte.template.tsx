import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { EstadoTasacion, Exclusividad, RankingCaptacionItem, ResumenTasadorKpi } from '@vacker/types';
import { ESTADO_TASACION_COLOR } from '@vacker/types';

// Mirror de `docs/prototipos/tasador_de_propiedades.html`, función `ReporteView`:
// KPIs del período · distribución por estado · tabla de tasaciones · ranking.

const RED = '#C1121F';
const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10, color: INK, fontFamily: 'Helvetica' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  logo: { width: 48, height: 48, objectFit: 'contain' },
  brandName: { fontSize: 14, fontWeight: 700, color: RED },
  title: { fontSize: 16, fontWeight: 800, marginTop: 8 },
  subtitle: { fontSize: 10, color: MUTED, marginTop: 2, marginBottom: 16 },
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
  kpiRow: { flexDirection: 'row', gap: 8 },
  kpiCard: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8 },
  kpiLabel: { fontSize: 8, color: MUTED, textTransform: 'uppercase' },
  kpiValue: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  distDot: { width: 8, height: 8, borderRadius: 4 },
  distLabel: { width: 90, fontSize: 9 },
  distTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#F4F5F7' },
  distFill: { height: 6, borderRadius: 3 },
  distCount: { width: 60, fontSize: 9, textAlign: 'right' },
  table: { borderWidth: 1, borderColor: LINE, borderRadius: 4 },
  tableHeaderRow: { flexDirection: 'row', backgroundColor: '#F4F5F7', borderBottomWidth: 1, borderBottomColor: LINE },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
  th: { flex: 1, padding: 4, fontSize: 8, color: MUTED, textTransform: 'uppercase' },
  td: { flex: 1, padding: 4, fontSize: 9 },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: LINE },
  rankMedal: { width: 20, fontSize: 11 },
  rankName: { flex: 1, fontSize: 10, fontWeight: 700 },
  rankCount: { width: 30, fontSize: 10, fontWeight: 700, color: RED, textAlign: 'right' },
});

function fmtUSD(v: number | null): string {
  if (v == null) return '—';
  return `USD ${Math.round(v).toLocaleString('es-AR')}`;
}

function fmtPct(v: number): string {
  return `${Math.round(v * 100)}%`;
}

export interface ReporteFila {
  id: string;
  fecha: string;
  direccion: string;
  barrio: string | null;
  cliente: string;
  agenteNombre: string;
  estado: EstadoTasacion;
  exclusividad: Exclusividad | null;
  motivoNoCaptada: string | null;
  valorRecomendado: number | null;
}

function detalleEstado(f: ReporteFila): string {
  if (f.estado === 'Captada' && f.exclusividad) {
    return f.exclusividad.tipo === 'exclusiva' ? `Exclusiva ${f.exclusividad.dias} días` : 'No exclusiva';
  }
  if (f.estado === 'No captada' && f.motivoNoCaptada) return f.motivoNoCaptada;
  return '—';
}

export function ReporteDocument({
  resumen,
  ranking,
  filas,
  periodoLabel,
  tenantNombre,
  logoUrl,
}: {
  resumen: ResumenTasadorKpi;
  ranking: RankingCaptacionItem[];
  filas: ReporteFila[];
  periodoLabel: string;
  tenantNombre: string;
  logoUrl?: string | null;
}) {
  const valorTotal = filas.reduce((s, f) => s + (f.valorRecomendado ?? 0), 0);
  const maxDist = Math.max(...resumen.distribucionEstado.map((d) => d.cantidad), 1);
  const maxRank = Math.max(...ranking.map((r) => r.captadas), 1);

  return (
    <Document title={`Reporte de tasaciones — ${periodoLabel}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.brandName}>{tenantNombre}</Text>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>
        <Text style={styles.title}>Reporte de Tasaciones</Text>
        <Text style={styles.subtitle}>{periodoLabel}</Text>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Tasaciones</Text>
            <Text style={styles.kpiValue}>{resumen.total}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Captadas</Text>
            <Text style={[styles.kpiValue, { color: '#1E9E5A' }]}>
              {resumen.distribucionEstado.find((d) => d.estado === 'Captada')?.cantidad ?? 0}
            </Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Tasa de captación</Text>
            <Text style={styles.kpiValue}>{fmtPct(resumen.tasaCaptacion)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>Valor publicación total</Text>
            <Text style={[styles.kpiValue, { color: RED }]}>{fmtUSD(valorTotal)}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Distribución por estado</Text>
        {resumen.distribucionEstado.map((d) => (
          <View key={d.estado} style={styles.distRow}>
            <View style={[styles.distDot, { backgroundColor: ESTADO_TASACION_COLOR[d.estado] }]} />
            <Text style={styles.distLabel}>{d.estado}</Text>
            <View style={styles.distTrack}>
              <View
                style={[
                  styles.distFill,
                  { width: `${(d.cantidad / maxDist) * 100}%`, backgroundColor: ESTADO_TASACION_COLOR[d.estado] },
                ]}
              />
            </View>
            <Text style={styles.distCount}>
              {d.cantidad} ({resumen.total ? Math.round((d.cantidad / resumen.total) * 100) : 0}%)
            </Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Tasaciones del período ({filas.length})</Text>
        {filas.length === 0 ? (
          <Text style={{ color: MUTED, fontSize: 10 }}>Sin tasaciones para este período.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow}>
              <Text style={styles.th}>Fecha</Text>
              <Text style={[styles.th, { flex: 2 }]}>Propiedad</Text>
              <Text style={styles.th}>Cliente</Text>
              <Text style={styles.th}>Vendedor</Text>
              <Text style={styles.th}>Estado</Text>
              <Text style={styles.th}>Detalle</Text>
              <Text style={styles.th}>Valor</Text>
            </View>
            {filas.map((f) => (
              <View key={f.id} style={styles.tableRow}>
                <Text style={styles.td}>{f.fecha}</Text>
                <Text style={[styles.td, { flex: 2 }]}>
                  {f.direccion}
                  {f.barrio ? ` · ${f.barrio}` : ''}
                </Text>
                <Text style={styles.td}>{f.cliente}</Text>
                <Text style={styles.td}>{f.agenteNombre}</Text>
                <Text style={styles.td}>{f.estado}</Text>
                <Text style={styles.td}>{detalleEstado(f)}</Text>
                <Text style={[styles.td, { fontWeight: 700, color: RED }]}>{fmtUSD(f.valorRecomendado)}</Text>
              </View>
            ))}
          </View>
        )}

        {ranking.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Ranking de captaciones por vendedor</Text>
            {ranking.map((r, i) => (
              <View key={r.usuarioId} style={styles.rankRow}>
                <Text style={styles.rankMedal}>{`${i + 1}°`}</Text>
                <Text style={styles.rankName}>{r.nombre}</Text>
                <View style={styles.distTrack}>
                  <View style={[styles.distFill, { width: `${(r.captadas / maxRank) * 100}%`, backgroundColor: RED }]} />
                </View>
                <Text style={styles.rankCount}>{r.captadas}</Text>
              </View>
            ))}
          </>
        )}
      </Page>
    </Document>
  );
}
