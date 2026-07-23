import React from 'react';
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { analizarComparables, type ComparableCalc, type PropiedadCalc } from '@vacker/domain';
import type { ComparableDto, TasacionDto } from '@vacker/types';
import { FUENTE_MARCA } from './fuentes';

// Réplica del informe del prototipo (docs/prototipos/tasador_de_propiedades.html,
// función `renderReporteTasacion`): encabezado con logo + "DOCUMENTO INTERNO" y
// fecha, título con tipo de propiedad, ficha cliente/agente, línea divisoria de
// color, y las 7 secciones en el mismo orden: Resumen ejecutivo · Características
// · Análisis comercial · Comparables de mercado · Estimación de valor ·
// Estrategia de comercialización · Conclusión.

const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const SURFACE = '#F4F5F7';

function crearEstilos(red: string, redDark: string) {
  return StyleSheet.create({
    page: { padding: 36, fontSize: 9.5, color: INK, fontFamily: FUENTE_MARCA },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logoBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoImg: { width: 36, height: 36, objectFit: 'contain' },
    logoFallback: { width: 36, height: 36, borderRadius: 8, backgroundColor: red },
    brandName: { fontSize: 11, fontWeight: 700, color: INK },
    docMeta: { alignItems: 'flex-end' },
    docMetaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    docMetaValue: { fontSize: 8.5, color: MUTED, marginTop: 2 },
    kicker: { fontSize: 8, fontWeight: 700, color: red, letterSpacing: 1.5, marginTop: 18 },
    title: { fontSize: 22, fontWeight: 800, color: INK, marginTop: 4 },
    subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
    fichaRow: { flexDirection: 'row', gap: 32, marginTop: 14 },
    fichaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    fichaValue: { fontSize: 10, fontWeight: 700, color: INK, marginTop: 2 },
    fichaSub: { fontSize: 8.5, color: MUTED, marginTop: 1 },
    divider: { height: 2.5, backgroundColor: red, marginTop: 14, marginBottom: 14 },
    sectionTitle: { fontSize: 11, fontWeight: 800, color: INK, marginBottom: 8, marginTop: 4 },
    sectionUnderline: { width: '100%', height: 2, backgroundColor: red, marginBottom: 10, marginTop: -4 },
    resumenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    resumenCard: {
      width: '23.5%',
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 6,
      padding: 8,
      marginBottom: 8,
    },
    resumenCardDestacado: { backgroundColor: red, borderColor: redDark },
    resumenLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    resumenLabelDestacado: { color: 'rgba(255,255,255,0.85)' },
    resumenValue: { fontSize: 10.5, fontWeight: 700, color: INK, marginTop: 3 },
    resumenValueDestacado: { color: '#FFFFFF' },
    cols: { flexDirection: 'row', gap: 28 },
    col: { flex: 1 },
    fichaLineaRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 4,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
    },
    fichaLineaLabel: { color: MUTED, fontSize: 9 },
    fichaLineaValue: { fontWeight: 700, fontSize: 9 },
    paragraph: { lineHeight: 1.5, color: INK, fontSize: 9.5 },
    paragraphMuted: { lineHeight: 1.4, color: MUTED, fontSize: 8.5, fontStyle: 'italic' },
    fotos: { flexDirection: 'row', gap: 8, marginTop: 10, marginBottom: 4 },
    foto: { flex: 1, height: 84, borderRadius: 4, objectFit: 'cover' },
    table: { borderWidth: 1, borderColor: LINE, borderRadius: 4, marginBottom: 8 },
    tableHeaderRow: { flexDirection: 'row', backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: LINE },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE },
    tableRowAlt: { backgroundColor: SURFACE },
    th: { flex: 1, padding: 5, fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    td: { flex: 1, padding: 5, fontSize: 8.5 },
    tdBold: { flex: 1, padding: 5, fontSize: 8.5, fontWeight: 700, color: INK },
    tdRed: { flex: 1, padding: 5, fontSize: 8.5, fontWeight: 700, color: red },
    tdLink: { flex: 1, padding: 5 },
    linkPill: {
      backgroundColor: red,
      color: '#FFFFFF',
      fontSize: 7.5,
      fontWeight: 700,
      paddingVertical: 3,
      paddingHorizontal: 6,
      borderRadius: 4,
      alignSelf: 'flex-start',
    },
    valorTable: { borderWidth: 1, borderColor: LINE, borderRadius: 4, marginTop: 4 },
    valorHeaderRow: { flexDirection: 'row', backgroundColor: SURFACE, borderBottomWidth: 1, borderBottomColor: LINE },
    valorRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: LINE, alignItems: 'center' },
    valorTh: { flex: 1, padding: 6, fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    valorTd: { flex: 1, padding: 6, fontSize: 9 },
    valorTdBold: { flex: 1, padding: 6, fontSize: 9, fontWeight: 700, textAlign: 'right' },
    sugeridoBox: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: red,
      borderRadius: 8,
      padding: 12,
      marginTop: 10,
    },
    sugeridoLabel: { fontSize: 8, fontWeight: 700, color: '#FFFFFF', letterSpacing: 0.5 },
    sugeridoSub: { fontSize: 8, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    sugeridoValor: { fontSize: 20, fontWeight: 800, color: '#FFFFFF' },
    margenTexto: { fontSize: 8.5, color: MUTED, textAlign: 'center', marginTop: 8 },
    pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: SURFACE,
      borderRadius: 11,
      paddingVertical: 4,
      paddingHorizontal: 9,
    },
    pillDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: red },
    pillText: { fontSize: 8, color: INK },
    disclaimer: {
      marginTop: 10,
      padding: 8,
      backgroundColor: SURFACE,
      borderRadius: 6,
      fontSize: 8,
      color: MUTED,
      lineHeight: 1.4,
      fontStyle: 'italic',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 18,
      paddingTop: 8,
      borderTopWidth: 1,
      borderTopColor: LINE,
      fontSize: 8,
      color: MUTED,
    },
    footerBrand: { fontWeight: 700, color: INK },
  });
}

function fmtUSD(v: number | null): string {
  if (v == null) return '—';
  return `$${Math.round(v).toLocaleString('es-AR')}`;
}

function fmtFecha(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function fmtSiNo(v: boolean): string {
  return v ? 'Sí' : 'No';
}

/** Color del chip de confianza (semáforo): Alta verde · Media ámbar · Baja rojo. */
function confianzaEstilo(nivel: string): { bg: string; text: string } {
  if (nivel === 'Alta') return { bg: '#E3F4EA', text: '#1E9E5A' };
  if (nivel === 'Media') return { bg: '#FBF0DC', text: '#B7791F' };
  return { bg: '#FBE3E5', text: '#C1121F' };
}

function fmtFechaCorta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/** Observación del comparable: fuente · tipo de precio · fecha · nota. */
function obsComparable(c: ComparableDto): string {
  return (
    [c.fuente, c.tipoPrecio, c.fechaReferencia ? fmtFechaCorta(c.fechaReferencia) : null, c.observaciones]
      .filter(Boolean)
      .join(' · ') || '—'
  );
}

/**
 * Características a mostrar en el PDF: se omiten los campos sin valor o en
 * "No"/0 (booleanos en false, números en 0/null, enums vacíos). Devuelve la
 * lista visible para repartir en dos columnas.
 */
function caracteristicas(t: TasacionDto): { label: string; value: string }[] {
  const items: { label: string; value: string }[] = [];
  const texto = (label: string, value: string | null | undefined) => {
    if (value) items.push({ label, value });
  };
  const numero = (label: string, v: number | null, sufijo = '') => {
    if (v != null && v > 0) items.push({ label, value: `${v}${sufijo}` });
  };
  const siVerdadero = (label: string, v: boolean) => {
    if (v) items.push({ label, value: 'Sí' });
  };

  texto('Tipo de propiedad', t.tipoPropiedad);
  texto('Tipo de operación', t.tipoOperacion.charAt(0).toUpperCase() + t.tipoOperacion.slice(1));
  numero('Ambientes', t.ambientes);
  numero('Dormitorios', t.dormitorios);
  numero('Baños', t.banos);
  numero('Toilettes', t.toilette);
  numero('Sup. cubierta', t.supCubierta, ' m²');
  numero('Sup. semi-cubierta', t.supSemicubierta, ' m²');
  numero('Sup. descubierta', t.supDescubierta, ' m²');
  numero('Sup. total', t.superficieTotal, ' m²');
  if (t.antiguedad != null && t.antiguedad > 0) items.push({ label: 'Antigüedad', value: `${t.antiguedad} años` });
  texto('Estado general', t.estadoInmueble);
  texto('Disposición', t.disposicion);
  texto('Orientación', t.orientacion);
  siVerdadero('Cochera', t.cochera);
  siVerdadero('Balcón', t.balcon);
  siVerdadero('Terraza', t.terraza);
  siVerdadero('Patio', t.patio);
  siVerdadero('Lavadero', t.lavadero);
  siVerdadero('Piscina', t.piscina);
  if (t.amenities.length > 0) items.push({ label: 'Amenities', value: t.detalleAmenities ? `Sí — ${t.detalleAmenities}` : 'Sí' });
  if (t.expensas != null && t.expensas > 0) items.push({ label: 'Expensas', value: `ARS ${t.expensas.toLocaleString('es-AR')}` });
  texto('Documentación', t.documentacion);
  return items;
}

function textoAnalisisComercial(t: TasacionDto): string {
  const a = t.analisisComercial;
  const base = `Se trata de un/a ${t.tipoPropiedad.toLowerCase()} ubicado en ${t.barrio ?? t.direccion}, en estado ${
    (t.estadoInmueble ?? 'a definir').toLowerCase()
  }, con una superficie total de ${t.superficieTotal} m².`;
  if (!a) return `${base} Análisis comercial pendiente de completar.`;
  const partes: string[] = [base];
  if (a.fortalezas.length > 0) {
    partes.push(`Entre sus principales fortalezas se destacan: ${a.fortalezas.join(', ').toLowerCase()}.`);
  }
  if (a.aspectos.length > 0) {
    partes.push(`Como aspectos a considerar para la estrategia comercial mencionamos: ${a.aspectos.join(', ').toLowerCase()}.`);
  }
  if (a.demanda) partes.push(`El nivel de demanda estimado para esta tipología es ${a.demanda.toLowerCase()},`);
  if (a.competencia) partes.push(`con una competencia ${a.competencia.toLowerCase()} en la zona.`);
  if (a.perfilComprador) partes.push(`El perfil probable de comprador corresponde a ${a.perfilComprador.toLowerCase()}.`);
  if (a.observacionesComerciales) partes.push(a.observacionesComerciales);
  return partes.join(' ');
}

function textoConclusion(t: TasacionDto): string {
  return (
    `En función del análisis realizado, consideramos que el valor comercial probable de la propiedad se ` +
    `encuentra entre ${fmtUSD(t.valorMinimo)} y ${fmtUSD(t.valorAspiracional)}. Nuestra recomendación es iniciar ` +
    `la comercialización en ${fmtUSD(t.valorRecomendado)}, ya que representa un valor competitivo frente a la ` +
    `oferta actual y permite captar compradores reales desde el comienzo.`
  );
}

export function InformeDocument({
  tasacion,
  tenantNombre,
  logoUrl,
  colorPrimario,
  colorPrimarioOscuro,
}: {
  tasacion: TasacionDto;
  tenantNombre: string;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorPrimarioOscuro?: string | null;
}) {
  const t = tasacion;
  const analisis = analizarComparables(
    t.comparables.map((c) => ({ ...c, cocheraComp: c.cochera ? 'Sí' : 'No' }) as ComparableCalc),
    {
      tipoPropiedad: t.tipoPropiedad,
      supCubierta: t.supCubierta,
      supSemi: t.supSemicubierta,
      supDescubierta: t.supDescubierta,
      supTerreno: t.supTerreno,
      dormitorios: t.dormitorios,
      banos: t.banos,
      estado: t.estadoInmueble,
      cochera: t.cochera,
    } satisfies PropiedadCalc,
  );
  const red = colorPrimario || '#C1121F';
  const redDark = colorPrimarioOscuro || red;
  const styles = crearEstilos(red, redDark);
  const fechaHoy = fmtFecha(new Date().toISOString());

  return (
    <Document title={`Informe de tasación — ${t.direccion}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : <View style={styles.logoFallback} />}
            <Text style={styles.brandName}>{tenantNombre}</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docMetaLabel}>DOCUMENTO INTERNO</Text>
            <Text style={styles.docMetaValue}>{fechaHoy}</Text>
          </View>
        </View>

        <Text style={styles.kicker}>INFORME DE TASACIÓN COMERCIAL</Text>
        <Text style={styles.title}>{t.tipoPropiedad}</Text>
        <Text style={styles.subtitle}>
          {t.direccion}
          {t.barrio ? ` · ${t.barrio}` : ''}
          {t.ciudad ? `, ${t.ciudad}` : ''}
        </Text>

        <View style={styles.fichaRow}>
          <View>
            <Text style={styles.fichaLabel}>CLIENTE</Text>
            <Text style={styles.fichaValue}>{t.cliente}</Text>
          </View>
          <View>
            <Text style={styles.fichaLabel}>AGENTE RESPONSABLE</Text>
            <Text style={styles.fichaValue}>{t.agente.nombre}</Text>
            <Text style={styles.fichaSub}>{t.agente.email}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>RESUMEN EJECUTIVO</Text>
        <View style={styles.sectionUnderline} />
        <View style={styles.resumenGrid}>
          <ResumenCard styles={styles} label="TIPO" value={t.tipoPropiedad} />
          <ResumenCard styles={styles} label="UBICACIÓN" value={t.barrio ?? t.direccion} />
          <ResumenCard styles={styles} label="SUP. TOTAL" value={`${t.superficieTotal} m²`} />
          <ResumenCard styles={styles} label="ESTADO GENERAL" value={t.estadoInmueble ?? '—'} />
          <ResumenCard styles={styles} label="VALOR MÍNIMO" value={fmtUSD(t.valorMinimo)} />
          <ResumenCard styles={styles} label="VALOR RECOMENDADO" value={fmtUSD(t.valorRecomendado)} destacado />
          <ResumenCard styles={styles} label="ESCENARIO" value={t.escenarioRecomendado ?? '—'} />
          <ResumenCard styles={styles} label="PLAZO ESTIMADO" value={t.plazoEstimado ?? '—'} />
        </View>

        <View wrap={false}>
        <Text style={styles.sectionTitle}>CARACTERÍSTICAS DE LA PROPIEDAD</Text>
        <View style={styles.sectionUnderline} />
        {(() => {
          const items = caracteristicas(t);
          const mitad = Math.ceil(items.length / 2);
          return (
            <View style={styles.cols}>
              <View style={styles.col}>
                {items.slice(0, mitad).map((it) => (
                  <FichaLinea key={it.label} styles={styles} label={it.label} value={it.value} />
                ))}
              </View>
              <View style={styles.col}>
                {items.slice(mitad).map((it) => (
                  <FichaLinea key={it.label} styles={styles} label={it.label} value={it.value} />
                ))}
              </View>
            </View>
          );
        })()}
        </View>

        {t.fotos.length > 0 && (
          <View style={styles.fotos}>
            {t.fotos.slice(0, 3).map((f) => (
              <Image key={f.id} src={f.url} style={styles.foto} />
            ))}
          </View>
        )}

        <View wrap={false}>
          <Text style={styles.sectionTitle}>ANÁLISIS COMERCIAL</Text>
          <View style={styles.sectionUnderline} />
          <Text style={styles.paragraph}>{textoAnalisisComercial(t)}</Text>
        </View>

        {t.comparables.length > 0 && (
          <View wrap={false}>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>COMPARABLES DE MERCADO</Text>
            <View style={styles.sectionUnderline} />
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={[styles.th, { flex: 1.4 }]}>Dirección</Text>
                <Text style={styles.th}>Sup. Tot.</Text>
                <Text style={styles.th}>Dor.</Text>
                <Text style={styles.th}>Baños</Text>
                <Text style={styles.th}>Coch.</Text>
                <Text style={styles.th}>Precio</Text>
                <Text style={styles.th}>USD/m²</Text>
                <Text style={[styles.th, { flex: 2 }]}>Observaciones</Text>
                {t.comparables.some((c) => c.link) && <Text style={styles.th}>Link</Text>}
              </View>
              {t.comparables.map((c, idx) => (
                <View key={c.id} style={[styles.tableRow, idx % 2 === 1 ? styles.tableRowAlt : {}]}>
                  <Text style={[styles.tdBold, { flex: 1.4 }]}>{c.direccion}</Text>
                  <Text style={styles.td}>{c.superficie} m²</Text>
                  <Text style={styles.td}>{c.dormitorios ?? '—'}</Text>
                  <Text style={styles.td}>{c.banos ?? '—'}</Text>
                  <Text style={styles.td}>{fmtSiNo(c.cochera)}</Text>
                  <Text style={styles.td}>{fmtUSD(c.precio)}</Text>
                  <Text style={styles.tdRed}>{fmtUSD(c.usdM2)}</Text>
                  <Text style={[styles.td, { flex: 2 }]}>{obsComparable(c)}</Text>
                  {t.comparables.some((x) => x.link) && (
                    <View style={styles.tdLink}>
                      {c.link ? (
                        <Link src={c.link} style={styles.linkPill}>
                          Ver →
                        </Link>
                      ) : (
                        <Text style={styles.td}>—</Text>
                      )}
                    </View>
                  )}
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 6 }}>
              <View
                style={{
                  backgroundColor: confianzaEstilo(analisis.confidence).bg,
                  borderRadius: 4,
                  paddingVertical: 4,
                  paddingHorizontal: 9,
                }}
              >
                <Text style={{ fontSize: 9.5, fontWeight: 700, color: confianzaEstilo(analisis.confidence).text }}>
                  Confianza {analisis.confidence} · {analisis.confidenceScore}%
                </Text>
              </View>
            </View>
            <Text style={styles.paragraphMuted}>
              Los inmuebles comparables relevados se ubican dentro de un rango aproximado de{' '}
              {fmtUSD(analisis.minPrice)} a {fmtUSD(analisis.maxPrice)}, con una referencia ponderada de{' '}
              {fmtUSD(analisis.weightedUsdPerM2)} USD/m² y confianza {analisis.confidence.toLowerCase()} (
              {analisis.confidenceScore}%). Estos valores funcionan como referencia de mercado, considerando que los
              precios publicados pueden diferir de los valores finales de cierre.
            </Text>
          </View>
        )}

        <View wrap={false}>
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>ESTIMACIÓN DE VALOR</Text>
        <View style={styles.sectionUnderline} />
        <View style={styles.valorTable}>
          <View style={styles.valorHeaderRow}>
            <Text style={styles.valorTh}>Escenario</Text>
            <Text style={styles.valorTh}>Estrategia</Text>
            <Text style={[styles.valorTh, { textAlign: 'right' }]}>Valor</Text>
          </View>
          <View style={styles.valorRow}>
            <Text style={styles.valorTd}>Venta rápida</Text>
            <Text style={[styles.valorTd, { color: MUTED }]}>Valor mínimo competitivo</Text>
            <Text style={styles.valorTdBold}>{fmtUSD(t.valorMinimo)}</Text>
          </View>
          <View style={styles.valorRow}>
            <Text style={styles.valorTd}>Venta equilibrada</Text>
            <Text style={[styles.valorTd, { color: MUTED }]}>Valor recomendado</Text>
            <Text style={[styles.valorTdBold, { color: red }]}>{fmtUSD(t.valorRecomendado)}</Text>
          </View>
          <View style={[styles.valorRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.valorTd}>Venta aspiracional</Text>
            <Text style={[styles.valorTd, { color: MUTED }]}>Valor máximo</Text>
            <Text style={styles.valorTdBold}>{fmtUSD(t.valorAspiracional)}</Text>
          </View>
        </View>

        <View style={styles.sugeridoBox}>
          <View>
            <Text style={styles.sugeridoLabel}>VALOR SUGERIDO DE PUBLICACIÓN</Text>
            <Text style={styles.sugeridoSub}>
              {t.escenarioRecomendado ?? 'Venta equilibrada'} · Plazo estimado: {t.plazoEstimado ?? 'a definir'}
            </Text>
          </View>
          <Text style={styles.sugeridoValor}>{fmtUSD(t.valorRecomendado)}</Text>
        </View>
        {t.margenNegociacion != null && (
          <Text style={styles.margenTexto}>Margen de negociación estimado: {t.margenNegociacion}%</Text>
        )}
        </View>

        <View wrap={false}>
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>ESTRATEGIA DE COMERCIALIZACIÓN</Text>
        <View style={styles.sectionUnderline} />
        {t.estrategiaComercial && t.estrategiaComercial.estrategia.length > 0 && (
          <View style={styles.pills}>
            {t.estrategiaComercial.estrategia.map((e) => (
              <View key={e} style={styles.pill}>
                <View style={styles.pillDot} />
                <Text style={styles.pillText}>{e}</Text>
              </View>
            ))}
          </View>
        )}
        <Text style={styles.paragraph}>
          Una correcta tasación debe estar acompañada por una estrategia comercial activa. Recomendamos iniciar la
          publicación con una presentación profesional del inmueble, difusión en portales, trabajo sobre base de
          datos y seguimiento de resultados durante las primeras semanas.
        </Text>
        {t.estrategiaComercial?.observacionesEstrategia && (
          <Text style={[styles.paragraph, { marginTop: 6, fontStyle: 'italic', color: MUTED }]}>
            {t.estrategiaComercial.observacionesEstrategia}
          </Text>
        )}
        </View>

        <View wrap={false}>
        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>CONCLUSIÓN</Text>
        <View style={styles.sectionUnderline} />
        <Text style={styles.paragraph}>{textoConclusion(t)}</Text>
        <Text style={styles.disclaimer}>
          El presente informe constituye una estimación comercial basada en información disponible al momento de su
          elaboración. No representa una tasación bancaria, judicial ni fiscal. El valor final de venta puede variar
          según condiciones de negociación, documentación, contexto económico y respuesta del mercado.
        </Text>
        </View>

        <View style={styles.footer}>
          <Text>
            <Text style={styles.footerBrand}>{tenantNombre}</Text> · {t.agente.nombre}
          </Text>
          <Text>{fechaHoy}</Text>
        </View>
      </Page>
    </Document>
  );
}

function ResumenCard({
  styles,
  label,
  value,
  destacado,
}: {
  styles: ReturnType<typeof crearEstilos>;
  label: string;
  value: string;
  destacado?: boolean;
}) {
  return (
    <View style={[styles.resumenCard, destacado ? styles.resumenCardDestacado : {}]}>
      <Text style={[styles.resumenLabel, destacado ? styles.resumenLabelDestacado : {}]}>{label}</Text>
      <Text style={[styles.resumenValue, destacado ? styles.resumenValueDestacado : {}]}>{value}</Text>
    </View>
  );
}

function FichaLinea({
  styles,
  label,
  value,
}: {
  styles: ReturnType<typeof crearEstilos>;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.fichaLineaRow}>
      <Text style={styles.fichaLineaLabel}>{label}</Text>
      <Text style={styles.fichaLineaValue}>{value}</Text>
    </View>
  );
}
