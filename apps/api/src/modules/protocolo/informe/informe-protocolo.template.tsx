import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  DESCRIPCION_SEMANA,
  SEMANAS,
  TOTAL_SEMANAS,
  type ProtocoloAccionDto,
  type ProtocoloDto,
} from '@vacker/types';
import { FUENTE_MARCA } from '../../tasador/informes/fuentes';

// Informe de comercialización para el propietario, según el mockup
// (Protocolo_Vacker_5_Semanas.html, `openReport`). El encabezado, las fuentes y
// el tratamiento de secciones replican el informe de tasación, como pide el
// brief: portada · resumen ejecutivo · trabajo realizado · conclusiones.

const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const SURFACE = '#F4F5F7';

function crearEstilos(red: string, redDark: string) {
  return StyleSheet.create({
    page: { padding: 36, fontSize: 9.5, color: INK, fontFamily: FUENTE_MARCA },
    // — cabecera compartida con el informe de tasación —
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    logoBox: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    logoImg: { width: 100, height: 100, objectFit: 'contain' },
    logoFallback: { width: 100, height: 100, borderRadius: 14, backgroundColor: red },
    brandName: { fontSize: 11, fontWeight: 700, color: INK },
    docMeta: { alignItems: 'flex-end' },
    docMetaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    docMetaValue: { fontSize: 8.5, color: MUTED, marginTop: 2 },
    kicker: { fontSize: 8, fontWeight: 700, color: red, letterSpacing: 1.5, marginTop: 18 },
    title: { fontSize: 22, fontWeight: 800, color: INK, marginTop: 4 },
    subtitle: { fontSize: 10, color: MUTED, marginTop: 2 },
    divider: { height: 2.5, backgroundColor: red, marginTop: 14, marginBottom: 14 },
    sectionTitle: { fontSize: 11, fontWeight: 800, color: INK, marginBottom: 8, marginTop: 4 },
    sectionUnderline: { width: '100%', height: 2, backgroundColor: red, marginBottom: 10, marginTop: -4 },

    // — portada —
    portada: { height: 250, borderRadius: 8, marginTop: 16, objectFit: 'cover' },
    portadaVacia: {
      height: 250,
      borderRadius: 8,
      marginTop: 16,
      backgroundColor: SURFACE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    portadaVaciaTexto: { fontSize: 9, color: MUTED },
    tagLine: {
      alignSelf: 'flex-start',
      backgroundColor: red,
      color: '#FFFFFF',
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: 0.8,
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 10,
      marginTop: 14,
    },
    portadaPie: { flexDirection: 'row', gap: 32, marginTop: 18 },
    agenteBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    agenteFoto: { width: 42, height: 42, borderRadius: 21, objectFit: 'cover' },
    fichaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    fichaValue: { fontSize: 10, fontWeight: 700, color: INK, marginTop: 2 },
    fichaSub: { fontSize: 8.5, color: MUTED, marginTop: 1 },
    semanaCirculo: {
      width: 92,
      height: 92,
      borderRadius: 46,
      borderWidth: 1,
      borderColor: LINE,
      backgroundColor: SURFACE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    semanaLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.7 },
    semanaValor: { fontSize: 24, fontWeight: 800, color: red },

    // — KPIs y embudo —
    kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    kpiCard: {
      flex: 1,
      borderWidth: 1,
      borderColor: LINE,
      borderTopWidth: 2.5,
      borderTopColor: red,
      borderRadius: 6,
      padding: 9,
    },
    kpiLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    kpiValor: { fontSize: 18, fontWeight: 800, color: INK, marginTop: 3 },
    kpiSub: { fontSize: 7.5, color: MUTED, marginTop: 2 },

    embudo: { flexDirection: 'row', borderWidth: 1, borderColor: LINE, borderRadius: 6, marginBottom: 12 },
    embudoTitulo: { flex: 1.3, backgroundColor: '#242428', padding: 11, justifyContent: 'center' },
    embudoTituloLabel: { fontSize: 7, fontWeight: 700, color: '#CFCFD3', letterSpacing: 0.6 },
    embudoTituloValor: { fontSize: 11, fontWeight: 700, color: '#FFFFFF', marginTop: 2 },
    embudoItem: { flex: 1, padding: 11, borderLeftWidth: 1, borderLeftColor: LINE },
    embudoLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    embudoValor: { fontSize: 15, fontWeight: 800, color: red, marginTop: 3 },

    // — cajas de texto —
    cols: { flexDirection: 'row', gap: 10 },
    col: { flex: 1 },
    box: { borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 10, marginBottom: 8 },
    boxAcento: { backgroundColor: '#FFF5F5', borderColor: redDark },
    boxOscuro: { backgroundColor: '#242428', borderColor: '#242428' },
    boxTitulo: { fontSize: 9.5, fontWeight: 700, color: INK, marginBottom: 4 },
    boxTituloClaro: { color: '#FFFFFF' },
    boxTexto: { fontSize: 8.8, lineHeight: 1.5, color: '#4E4E54' },
    boxTextoClaro: { color: '#E7E7E9' },

    // — acciones realizadas —
    semanaEtiqueta: {
      fontSize: 9,
      fontWeight: 800,
      color: INK,
      letterSpacing: 0.6,
      marginTop: 10,
      marginBottom: 5,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
    },
    accion: {
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 5,
      backgroundColor: '#FAFAFB',
      padding: 7,
      marginBottom: 4,
    },
    accionTitulo: { fontSize: 8.8, fontWeight: 700, color: INK },
    accionDetalle: { fontSize: 7.7, color: '#64646B', lineHeight: 1.4, marginTop: 2 },

    pie: {
      position: 'absolute',
      bottom: 22,
      left: 36,
      right: 36,
      borderTopWidth: 1,
      borderTopColor: LINE,
      paddingTop: 6,
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    pieTexto: { fontSize: 7, color: MUTED },
    pieMarca: { fontSize: 7, fontWeight: 700, color: INK },
  });
}

export function InformeProtocoloDocument({
  protocolo,
  tenantNombre,
  logoUrl,
  colorPrimario,
  colorPrimarioOscuro,
}: {
  protocolo: ProtocoloDto;
  tenantNombre: string;
  logoUrl?: string | null;
  colorPrimario?: string | null;
  colorPrimarioOscuro?: string | null;
}) {
  const p = protocolo;
  const red = colorPrimario || '#C1121F';
  const redDark = colorPrimarioOscuro || red;
  const styles = crearEstilos(red, redDark);
  const fechaHoy = fmtFecha(new Date().toISOString().slice(0, 10));

  const realizadas = p.acciones.filter((a) => a.estado === 'realizada');
  const porSemana = SEMANAS.map((s) => ({
    semana: s,
    acciones: realizadas.filter((a) => a.semana === s),
  })).filter((g) => g.acciones.length > 0);

  // `fixed` + numeración dinámica: la sección de acciones puede desbordar a
  // una página extra, así que el número no puede ser fijo por sección.
  const Pie = () => (
    <View style={styles.pie} fixed>
      <Text style={styles.pieTexto}>{tenantNombre} · Informe confidencial</Text>
      <Text style={styles.pieMarca} render={({ pageNumber }) => String(pageNumber).padStart(2, '0')} />
    </View>
  );

  const Cabecera = ({ seccion }: { seccion: string }) => (
    <View style={styles.header}>
      <View style={styles.logoBox}>
        {logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : <View style={styles.logoFallback} />}
        <Text style={styles.brandName}>{tenantNombre}</Text>
      </View>
      <View style={styles.docMeta}>
        <Text style={styles.docMetaLabel}>{seccion}</Text>
        <Text style={styles.docMetaValue}>{fechaHoy}</Text>
      </View>
    </View>
  );

  return (
    <Document title={`Informe de comercialización — ${p.propiedad.direccion}`}>
      {/* 1 — Portada */}
      <Page size="A4" style={styles.page}>
        <Cabecera seccion="INFORME PARA EL PROPIETARIO" />
        <Text style={styles.tagLine}>PROTOCOLO DE COMERCIALIZACIÓN · 5 SEMANAS</Text>

        {p.propiedad.fotoUrl ? (
          <Image src={p.propiedad.fotoUrl} style={styles.portada} />
        ) : (
          <View style={styles.portadaVacia}>
            <Text style={styles.portadaVaciaTexto}>Fotografía de la propiedad</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginTop: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>INFORME DE COMERCIALIZACIÓN</Text>
            <Text style={styles.title}>{p.propiedad.direccion}</Text>
            <Text style={styles.subtitle}>
              {p.propiedad.tipoPropiedad}
              {p.propiedad.barrio ? ` · ${p.propiedad.barrio}` : ''}
              {p.propiedad.ciudad ? `, ${p.propiedad.ciudad}` : ''}
              {p.precioPublicado != null ? ` · ${fmtMoneda(p.precioPublicado, p.moneda)}` : ''}
            </Text>
          </View>
          <View style={styles.semanaCirculo}>
            <Text style={styles.semanaLabel}>SEMANA</Text>
            <Text style={styles.semanaValor}>{p.semanaActual}</Text>
            <Text style={styles.semanaLabel}>{pct(p.avance)} AVANCE</Text>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.portadaPie}>
          <View>
            <Text style={styles.fichaLabel}>PREPARADO PARA</Text>
            <Text style={styles.fichaValue}>{p.propietarioNombre ?? 'Propietario'}</Text>
            {p.propietarioTelefono && <Text style={styles.fichaSub}>{p.propietarioTelefono}</Text>}
          </View>
          <View style={styles.agenteBox}>
            {p.agente.fotoUrl ? <Image src={p.agente.fotoUrl} style={styles.agenteFoto} /> : null}
            <View>
              <Text style={styles.fichaLabel}>ASESOR RESPONSABLE</Text>
              <Text style={styles.fichaValue}>{p.agente.nombre}</Text>
              <Text style={styles.fichaSub}>
                {p.agente.telefono ? `${p.agente.email} · ${p.agente.telefono}` : p.agente.email}
              </Text>
            </View>
          </View>
          <View>
            <Text style={styles.fichaLabel}>PERÍODO</Text>
            <Text style={styles.fichaValue}>{fmtFecha(p.fechaInicio)}</Text>
            <Text style={styles.fichaSub}>al {fechaHoy}</Text>
          </View>
        </View>

        <Pie />
      </Page>

      {/* 2 — Resumen ejecutivo */}
      <Page size="A4" style={styles.page}>
        <Cabecera seccion="RESUMEN EJECUTIVO" />
        <Text style={styles.kicker}>RESPUESTA DEL MERCADO</Text>
        <Text style={styles.title}>Resultados de la comercialización</Text>
        <Text style={styles.subtitle}>
          Indicadores acumulados desde el inicio del protocolo y lectura profesional del desempeño.
        </Text>
        <View style={styles.divider} />

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>DÍAS PUBLICADA</Text>
            <Text style={styles.kpiValor}>{p.diasPublicada}</Text>
            <Text style={styles.kpiSub}>desde {fmtFecha(p.fechaInicio)}</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>ACCIONES REALIZADAS</Text>
            <Text style={styles.kpiValor}>{realizadas.length}</Text>
            <Text style={styles.kpiSub}>de {p.acciones.length} previstas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>CONSULTAS</Text>
            <Text style={styles.kpiValor}>{p.embudo.consultas}</Text>
            <Text style={styles.kpiSub}>{p.embudo.consultasCalificadas} calificadas</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>VISITAS</Text>
            <Text style={styles.kpiValor}>{p.embudo.visitas}</Text>
            <Text style={styles.kpiSub}>{p.embudo.interesadosActivos} interesados activos</Text>
          </View>
        </View>

        <View style={styles.embudo}>
          <View style={styles.embudoTitulo}>
            <Text style={styles.embudoTituloLabel}>EMBUDO COMERCIAL</Text>
            <Text style={styles.embudoTituloValor}>De la consulta a la oferta</Text>
          </View>
          <View style={styles.embudoItem}>
            <Text style={styles.embudoLabel}>CONVERSIÓN A VISITA</Text>
            <Text style={styles.embudoValor}>{pct(p.embudo.conversionVisita)}</Text>
          </View>
          <View style={styles.embudoItem}>
            <Text style={styles.embudoLabel}>OFERTAS RECIBIDAS</Text>
            <Text style={styles.embudoValor}>{p.embudo.ofertas}</Text>
          </View>
          <View style={styles.embudoItem}>
            <Text style={styles.embudoLabel}>CONVERSIÓN VISITA / OFERTA</Text>
            <Text style={styles.embudoValor}>{pct(p.embudo.conversionOferta)}</Text>
          </View>
        </View>

        <View style={styles.cols}>
          <View style={styles.col}>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Devoluciones del mercado</Text>
              <Text style={styles.boxTexto}>
                {p.devolucionesMercado || 'No se registraron devoluciones en este período.'}
              </Text>
            </View>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Principales objeciones</Text>
              <Text style={styles.boxTexto}>{p.objeciones || 'No se registraron objeciones relevantes.'}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={[styles.box, styles.boxAcento]}>
              <Text style={styles.boxTitulo}>Lectura y recomendación</Text>
              <Text style={styles.boxTexto}>
                {p.recomendacion ||
                  'La recomendación estratégica se definirá con base en los resultados acumulados y la evolución del mercado.'}
              </Text>
            </View>
            <View style={[styles.box, styles.boxOscuro]}>
              <Text style={[styles.boxTitulo, styles.boxTituloClaro]}>Estado actual</Text>
              <Text style={[styles.boxTexto, styles.boxTextoClaro]}>
                {`Semana ${p.semanaActual} de ${TOTAL_SEMANAS}\nAvance del protocolo: ${pct(p.avance)}\nInteresados activos: ${p.embudo.interesadosActivos}\nOfertas recibidas: ${p.embudo.ofertas}`}
              </Text>
            </View>
          </View>
        </View>

        <Pie />
      </Page>

      {/* 3 — Trabajo realizado */}
      <Page size="A4" style={styles.page}>
        <Cabecera seccion="TRABAJO REALIZADO" />
        <Text style={styles.kicker}>EJECUCIÓN DEL PROTOCOLO</Text>
        <Text style={styles.title}>Acciones de comercialización</Text>
        <Text style={styles.subtitle}>
          Detalle de las acciones realizadas y de los resultados registrados durante las cinco semanas.
        </Text>
        <View style={styles.divider} />

        {porSemana.length === 0 ? (
          <View style={styles.box}>
            <Text style={styles.boxTexto}>Todavía no se registraron acciones realizadas.</Text>
          </View>
        ) : (
          porSemana.map((g) => (
            <View key={g.semana} wrap={false}>
              <Text style={styles.semanaEtiqueta}>
                SEMANA {g.semana} · {DESCRIPCION_SEMANA[g.semana]}
              </Text>
              {g.acciones.map((a) => (
                <View key={a.id} style={styles.accion} wrap={false}>
                  <Text style={styles.accionTitulo}>
                    {a.titulo}
                    {a.fechaRealizada ? ` · ${fmtFecha(a.fechaRealizada)}` : ''}
                  </Text>
                  <Text style={styles.accionDetalle}>{detalleDe(a)}</Text>
                </View>
              ))}
            </View>
          ))
        )}

        <Pie />
      </Page>

      {/* 4 — Conclusiones */}
      <Page size="A4" style={styles.page}>
        <Cabecera seccion="PRÓXIMA ETAPA" />
        <Text style={styles.kicker}>TOMA DE DECISIÓN</Text>
        <Text style={styles.title}>Conclusiones y plan de acción</Text>
        <Text style={styles.subtitle}>
          Síntesis de la recomendación profesional y de las decisiones acordadas para la siguiente etapa.
        </Text>
        <View style={styles.divider} />

        <View style={styles.cols}>
          <View style={styles.col}>
            <View style={[styles.box, styles.boxAcento]}>
              <Text style={styles.boxTitulo}>Recomendación profesional</Text>
              <Text style={styles.boxTexto}>{p.recomendacion || 'Pendiente de completar.'}</Text>
            </View>
          </View>
          <View style={styles.col}>
            <View style={styles.box}>
              <Text style={styles.boxTitulo}>Decisión acordada con el propietario</Text>
              <Text style={styles.boxTexto}>
                {p.decisionPropietario || 'Pendiente de acordar con el propietario.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={styles.boxTitulo}>Próximas acciones</Text>
          <Text style={styles.boxTexto}>
            {p.proximasAcciones ||
              'Continuar con el seguimiento de interesados y revisar los indicadores de comercialización.'}
          </Text>
        </View>

        <View style={[styles.box, styles.boxOscuro]}>
          <Text style={[styles.boxTitulo, styles.boxTituloClaro]}>Contacto</Text>
          <Text style={[styles.boxTexto, styles.boxTextoClaro]}>
            {`${p.agente.nombre}\n${p.agente.telefono ? `${p.agente.email} · ${p.agente.telefono}` : p.agente.email}\n${tenantNombre}`}
          </Text>
        </View>

        <Pie />
      </Page>
    </Document>
  );
}

/** Qué mostrar de una acción realizada: resultado, si no observaciones, si no genérico. */
function detalleDe(a: ProtocoloAccionDto): string {
  const base = a.resultado || a.observaciones || 'Acción realizada según el protocolo comercial.';
  return a.evidencia ? `${base}\n${a.evidencia}` : base;
}

function pct(valor: number): string {
  return `${Math.round(valor * 100)}%`;
}

function fmtMoneda(valor: number, moneda: string): string {
  return `${moneda} ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(valor)}`;
}

/** `YYYY-MM-DD` → `dd/mm/aaaa` sin depender de la zona horaria del server. */
function fmtFecha(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
