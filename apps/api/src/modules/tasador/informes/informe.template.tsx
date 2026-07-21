import React from 'react';
import { Document, Image, Link, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { promedioUsdM2 } from '@vacker/domain';
import type { TasacionDto } from '@vacker/types';

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
    page: { padding: 36, fontSize: 9.5, color: INK, fontFamily: 'Helvetica' },
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
    sectionUnderline: { width: 32, height: 2.5, backgroundColor: red, marginBottom: 10, marginTop: -6 },
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
    th: { flex: 1, padding: 5, fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    td: { flex: 1, padding: 5, fontSize: 8.5 },
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
    pill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    pillDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: red },
    pillText: { fontSize: 8.5, color: INK },
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

function fmtAmenities(t: TasacionDto): string {
  if (t.amenities.length === 0) return 'No';
  return t.detalleAmenities ? `Sí — ${t.detalleAmenities}` : 'Sí';
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
  const promedio = promedioUsdM2(t.comparables);
  const precios = t.comparables.map((c) => c.precio).filter((p): p is number => p != null);
  const rangoMin = precios.length > 0 ? Math.min(...precios) : null;
  const rangoMax = precios.length > 0 ? Math.max(...precios) : null;
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

        <Text style={styles.sectionTitle}>CARACTERÍSTICAS DE LA PROPIEDAD</Text>
        <View style={styles.sectionUnderline} />
        <View style={styles.cols}>
          <View style={styles.col}>
            <FichaLinea styles={styles} label="Tipo de propiedad" value={t.tipoPropiedad} />
            <FichaLinea
              styles={styles}
              label="Tipo de operación"
              value={t.tipoOperacion.charAt(0).toUpperCase() + t.tipoOperacion.slice(1)}
            />
            <FichaLinea styles={styles} label="Ambientes" value={String(t.ambientes ?? '—')} />
            <FichaLinea styles={styles} label="Dormitorios" value={String(t.dormitorios ?? '—')} />
            <FichaLinea styles={styles} label="Baños" value={String(t.banos ?? '—')} />
            <FichaLinea styles={styles} label="Sup. cubierta" value={`${t.supCubierta} m²`} />
            <FichaLinea styles={styles} label="Sup. semi-cubierta" value={`${t.supSemicubierta} m²`} />
            <FichaLinea styles={styles} label="Sup. descubierta" value={`${t.supDescubierta} m²`} />
            <FichaLinea styles={styles} label="Sup. total" value={`${t.superficieTotal} m²`} />
            <FichaLinea styles={styles} label="Antigüedad" value={t.antiguedad != null ? `${t.antiguedad} años` : '—'} />
            <FichaLinea styles={styles} label="Estado general" value={t.estadoInmueble ?? '—'} />
          </View>
          <View style={styles.col}>
            <FichaLinea styles={styles} label="Disposición" value={t.disposicion ?? '—'} />
            <FichaLinea styles={styles} label="Orientación" value={t.orientacion ?? '—'} />
            <FichaLinea styles={styles} label="Cocheras" value={fmtSiNo(t.cochera)} />
            <FichaLinea styles={styles} label="Toilettes" value={String(t.toilette ?? '—')} />
            <FichaLinea styles={styles} label="Balcón" value={fmtSiNo(t.balcon)} />
            <FichaLinea styles={styles} label="Lavadero" value={fmtSiNo(t.lavadero)} />
            <FichaLinea styles={styles} label="Piscina" value={fmtSiNo(t.piscina)} />
            <FichaLinea styles={styles} label="Amenities" value={fmtAmenities(t)} />
            <FichaLinea
              styles={styles}
              label="Expensas"
              value={t.expensas != null ? `ARS ${t.expensas.toLocaleString('es-AR')}` : '—'}
            />
            <FichaLinea styles={styles} label="Documentación" value={t.documentacion ?? '—'} />
          </View>
        </View>

        {t.fotos.length > 0 && (
          <View style={styles.fotos}>
            {t.fotos.slice(0, 3).map((f) => (
              <Image key={f.id} src={f.url} style={styles.foto} />
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>ANÁLISIS COMERCIAL</Text>
        <View style={styles.sectionUnderline} />
        <Text style={styles.paragraph}>{textoAnalisisComercial(t)}</Text>

        {t.comparables.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>COMPARABLES DE MERCADO</Text>
            <View style={styles.sectionUnderline} />
            <View style={styles.table}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.th}>Zona</Text>
                <Text style={styles.th}>Sup.</Text>
                <Text style={styles.th}>Dor.</Text>
                <Text style={styles.th}>Baños</Text>
                <Text style={styles.th}>Coch.</Text>
                <Text style={styles.th}>Precio</Text>
                <Text style={styles.th}>USD/m²</Text>
                <Text style={[styles.th, { flex: 2 }]}>Observaciones</Text>
                {t.comparables.some((c) => c.link) && <Text style={styles.th}>Link</Text>}
              </View>
              {t.comparables.map((c) => (
                <View key={c.id} style={styles.tableRow}>
                  <Text style={styles.td}>{c.direccion}</Text>
                  <Text style={styles.td}>{c.superficie} m²</Text>
                  <Text style={styles.td}>{c.dormitorios ?? '—'}</Text>
                  <Text style={styles.td}>{c.banos ?? '—'}</Text>
                  <Text style={styles.td}>{fmtSiNo(c.cochera)}</Text>
                  <Text style={styles.td}>{fmtUSD(c.precio)}</Text>
                  <Text style={styles.td}>{fmtUSD(c.usdM2)}</Text>
                  <Text style={[styles.td, { flex: 2 }]}>{c.observaciones ?? '—'}</Text>
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
            <Text style={styles.paragraphMuted}>
              Los inmuebles comparables relevados se ubican dentro de un rango aproximado de {fmtUSD(rangoMin)} a{' '}
              {fmtUSD(rangoMax)}, con un promedio de USD/m² de {fmtUSD(promedio)}. Estos valores funcionan como
              referencia de mercado, considerando que los precios publicados pueden diferir de los valores finales
              de cierre.
            </Text>
          </>
        )}

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

        <Text style={[styles.sectionTitle, { marginTop: 14 }]}>CONCLUSIÓN</Text>
        <View style={styles.sectionUnderline} />
        <Text style={styles.paragraph}>{textoConclusion(t)}</Text>
        <Text style={styles.disclaimer}>
          El presente informe constituye una estimación comercial basada en información disponible al momento de su
          elaboración. No representa una tasación bancaria, judicial ni fiscal. El valor final de venta puede variar
          según condiciones de negociación, documentación, contexto económico y respuesta del mercado.
        </Text>

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
