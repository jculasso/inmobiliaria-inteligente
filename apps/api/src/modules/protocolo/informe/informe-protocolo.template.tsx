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

// Informe de comercialización para el propietario. El encabezado y el
// tratamiento de secciones son los MISMOS que los del informe de tasación
// (ver ../../tasador/informes/informe.template.tsx): logo + marca a la
// izquierda, tipo de documento y fecha a la derecha, kicker, título,
// subtítulo, ficha de propietario/asesor y línea divisoria.
//
// Los cortes de página están cuidados a mano: cada bloque que se lee como una
// unidad lleva `wrap={false}` para que nunca quede partido al medio, y las dos
// secciones grandes arrancan en página propia. El pie se repite en todas.

const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';

function crearEstilos(red: string, redDark: string) {
  return StyleSheet.create({
    // `paddingBottom` deja lugar al pie fijo: sin eso el texto se le encima.
    page: { paddingTop: 36, paddingHorizontal: 36, paddingBottom: 58, fontSize: 9.5, color: INK, fontFamily: FUENTE_MARCA },

    // — encabezado, idéntico al informe de tasación —
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
    fichaRow: { flexDirection: 'row', gap: 32, marginTop: 14 },
    fichaLabel: { fontSize: 7.5, fontWeight: 700, color: MUTED, letterSpacing: 1 },
    fichaValue: { fontSize: 10, fontWeight: 700, color: INK, marginTop: 2 },
    fichaSub: { fontSize: 8.5, color: MUTED, marginTop: 1 },
    agenteBox: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    agenteFoto: { width: 42, height: 42, borderRadius: 21, objectFit: 'cover' },
    divider: { height: 2.5, backgroundColor: red, marginTop: 14, marginBottom: 14 },

    // — secciones, mismo tratamiento —
    sectionTitle: { fontSize: 11, fontWeight: 800, color: INK, marginBottom: 8, marginTop: 4 },
    sectionUnderline: { width: '100%', height: 2, backgroundColor: red, marginBottom: 10, marginTop: -4 },

    foto: { width: '100%', height: 150, borderRadius: 6, objectFit: 'cover', marginBottom: 12 },

    // — tarjetas del resumen —
    resumenGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    resumenCard: { width: '23.5%', borderWidth: 1, borderColor: LINE, borderRadius: 6, padding: 8, marginBottom: 8 },
    resumenCardDestacado: { backgroundColor: red, borderColor: redDark },
    resumenLabel: { fontSize: 7, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    resumenLabelDestacado: { color: 'rgba(255,255,255,0.85)' },
    resumenValue: { fontSize: 10.5, fontWeight: 700, color: INK, marginTop: 3 },
    resumenValueDestacado: { color: '#FFFFFF' },
    resumenSub: { fontSize: 7, color: MUTED, marginTop: 2 },
    resumenSubDestacado: { color: 'rgba(255,255,255,0.85)' },

    // — embudo —
    embudo: { flexDirection: 'row', borderWidth: 1, borderColor: LINE, borderRadius: 6, marginBottom: 12 },
    embudoTitulo: { flex: 1.3, backgroundColor: '#242428', padding: 11, justifyContent: 'center' },
    embudoTituloLabel: { fontSize: 7, fontWeight: 700, color: '#CFCFD3', letterSpacing: 0.65 },
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
      marginTop: 8,
      marginBottom: 5,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
    },
    accion: { borderWidth: 1, borderColor: LINE, borderRadius: 5, backgroundColor: '#FAFAFB', padding: 7, marginBottom: 4 },
    accionTitulo: { fontSize: 8.8, fontWeight: 700, color: INK },
    accionDetalle: { fontSize: 7.7, color: '#64646B', lineHeight: 1.4, marginTop: 2 },
    vacio: { fontSize: 8.8, color: MUTED, fontStyle: 'italic' },

    // — pie repetido en todas las páginas —
    pie: {
      position: 'absolute',
      bottom: 24,
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

  const ubicacion = [p.propiedad.barrio, p.propiedad.ciudad].filter(Boolean).join(', ');

  return (
    <Document title={`Informe de comercialización — ${p.propiedad.direccion}`}>
      <Page size="A4" style={styles.page}>
        {/* Encabezado — mismo bloque que el informe de tasación. */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={styles.logoImg} /> : <View style={styles.logoFallback} />}
            <Text style={styles.brandName}>{tenantNombre}</Text>
          </View>
          <View style={styles.docMeta}>
            <Text style={styles.docMetaLabel}>INFORME PARA EL PROPIETARIO</Text>
            <Text style={styles.docMetaValue}>{fechaHoy}</Text>
          </View>
        </View>

        <Text style={styles.kicker}>INFORME DE COMERCIALIZACIÓN · PROTOCOLO DE 5 SEMANAS</Text>
        <Text style={styles.title}>{p.propiedad.direccion}</Text>
        <Text style={styles.subtitle}>
          {p.propiedad.tipoPropiedad}
          {ubicacion ? ` · ${ubicacion}` : ''}
          {p.precioPublicado != null ? ` · ${fmtMoneda(p.precioPublicado, p.moneda)}` : ''}
        </Text>

        <View style={styles.fichaRow}>
          <View>
            <Text style={styles.fichaLabel}>PROPIETARIO</Text>
            <Text style={styles.fichaValue}>{p.propietarioNombre ?? '—'}</Text>
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

        <View style={styles.divider} />

        {p.propiedad.fotoUrl ? <Image src={p.propiedad.fotoUrl} style={styles.foto} /> : null}

        {/* Resumen — el grid de tarjetas no se parte al medio. */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>RESUMEN DE LA COMERCIALIZACIÓN</Text>
          <View style={styles.sectionUnderline} />
          <View style={styles.resumenGrid}>
            <Card s={styles} label="SEMANA EN CURSO" value={`${p.semanaActual} de ${TOTAL_SEMANAS}`} />
            <Card s={styles} label="AVANCE DEL PLAN" value={pct(p.avance)} destacado />
            <Card s={styles} label="DÍAS PUBLICADA" value={String(p.diasPublicada)} sub={`desde ${fmtFecha(p.fechaInicio)}`} />
            <Card s={styles} label="ACCIONES REALIZADAS" value={String(realizadas.length)} sub={`de ${p.acciones.length} previstas`} />
            <Card s={styles} label="CONSULTAS" value={String(p.embudo.consultas)} sub={`${p.embudo.consultasCalificadas} calificadas`} />
            <Card s={styles} label="VISITAS" value={String(p.embudo.visitas)} />
            <Card s={styles} label="INTERESADOS ACTIVOS" value={String(p.embudo.interesadosActivos)} />
            <Card s={styles} label="OFERTAS RECIBIDAS" value={String(p.embudo.ofertas)} />
          </View>
        </View>

        {/* Embudo — una sola tira, nunca partida. */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>EMBUDO COMERCIAL</Text>
          <View style={styles.sectionUnderline} />
          <View style={styles.embudo}>
            <View style={styles.embudoTitulo}>
              <Text style={styles.embudoTituloLabel}>DE LA CONSULTA A LA OFERTA</Text>
              <Text style={styles.embudoTituloValor}>Respuesta del mercado</Text>
            </View>
            <View style={styles.embudoItem}>
              <Text style={styles.embudoLabel}>CONVERSIÓN A VISITA</Text>
              <Text style={styles.embudoValor}>{pct(p.embudo.conversionVisita)}</Text>
            </View>
            <View style={styles.embudoItem}>
              <Text style={styles.embudoLabel}>VISITA / OFERTA</Text>
              <Text style={styles.embudoValor}>{pct(p.embudo.conversionOferta)}</Text>
            </View>
          </View>
        </View>

        {/* Lectura del mercado — cada caja entera o en la página siguiente. */}
        <View wrap={false}>
          <Text style={styles.sectionTitle}>LECTURA DEL MERCADO</Text>
          <View style={styles.sectionUnderline} />
          <View style={styles.cols}>
            <View style={styles.col}>
              <View style={styles.box} wrap={false}>
                <Text style={styles.boxTitulo}>Devoluciones recibidas</Text>
                <Text style={styles.boxTexto}>
                  {p.devolucionesMercado || 'No se registraron devoluciones en este período.'}
                </Text>
              </View>
              <View style={styles.box} wrap={false}>
                <Text style={styles.boxTitulo}>Principales objeciones</Text>
                <Text style={styles.boxTexto}>{p.objeciones || 'No se registraron objeciones relevantes.'}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <View style={[styles.box, styles.boxAcento]} wrap={false}>
                <Text style={styles.boxTitulo}>Nuestra lectura</Text>
                <Text style={styles.boxTexto}>
                  {p.recomendacion ||
                    'La recomendación se definirá con base en los resultados acumulados y la evolución del mercado.'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Página propia: el detalle del trabajo hecho merece arrancar limpio. */}
        <View break>
          <Text style={styles.sectionTitle}>ACCIONES REALIZADAS</Text>
          <View style={styles.sectionUnderline} />
          {porSemana.length === 0 ? (
            <Text style={styles.vacio}>Todavía no se registraron acciones realizadas.</Text>
          ) : (
            porSemana.map((g) => (
              // El encabezado de la semana viaja junto con su primera acción:
              // un título solo al pie de una página se lee como un error.
              <View key={g.semana}>
                <View wrap={false}>
                  <Text style={styles.semanaEtiqueta}>
                    SEMANA {g.semana} · {DESCRIPCION_SEMANA[g.semana]}
                  </Text>
                  <Accion s={styles} a={g.acciones[0]!} />
                </View>
                {g.acciones.slice(1).map((a) => (
                  <View key={a.id} wrap={false}>
                    <Accion s={styles} a={a} />
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        {/* Página propia: es la parte que se conversa con el propietario. */}
        <View break>
          <Text style={styles.sectionTitle}>CONCLUSIONES Y PRÓXIMOS PASOS</Text>
          <View style={styles.sectionUnderline} />

          <View style={styles.cols}>
            <View style={styles.col}>
              <View style={[styles.box, styles.boxAcento]} wrap={false}>
                <Text style={styles.boxTitulo}>Recomendación profesional</Text>
                <Text style={styles.boxTexto}>{p.recomendacion || 'Pendiente de completar.'}</Text>
              </View>
            </View>
            <View style={styles.col}>
              <View style={styles.box} wrap={false}>
                <Text style={styles.boxTitulo}>Decisión acordada</Text>
                <Text style={styles.boxTexto}>
                  {p.decisionPropietario || 'Pendiente de acordar con el propietario.'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.box} wrap={false}>
            <Text style={styles.boxTitulo}>Plan de acción para la próxima etapa</Text>
            <Text style={styles.boxTexto}>
              {p.proximasAcciones ||
                'Continuar con el seguimiento de interesados y revisar los indicadores de comercialización.'}
            </Text>
          </View>

          <View style={[styles.box, styles.boxOscuro]} wrap={false}>
            <Text style={[styles.boxTitulo, styles.boxTituloClaro]}>Contacto</Text>
            <Text style={[styles.boxTexto, styles.boxTextoClaro]}>
              {`${p.agente.nombre}\n${p.agente.telefono ? `${p.agente.email} · ${p.agente.telefono}` : p.agente.email}\n${tenantNombre}`}
            </Text>
          </View>
        </View>

        {/* `fixed`: se repite en todas las páginas, con su número real. */}
        <View style={styles.pie} fixed>
          <Text style={styles.pieTexto}>
            {tenantNombre} · {p.propiedad.direccion} · Informe confidencial
          </Text>
          <Text
            style={styles.pieMarca}
            render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Tarjeta del resumen, con el mismo diseño que las del informe de tasación. */
function Card({
  s,
  label,
  value,
  sub,
  destacado,
}: {
  s: ReturnType<typeof crearEstilos>;
  label: string;
  value: string;
  sub?: string;
  destacado?: boolean;
}) {
  return (
    <View style={destacado ? [s.resumenCard, s.resumenCardDestacado] : s.resumenCard}>
      <Text style={destacado ? [s.resumenLabel, s.resumenLabelDestacado] : s.resumenLabel}>{label}</Text>
      <Text style={destacado ? [s.resumenValue, s.resumenValueDestacado] : s.resumenValue}>{value}</Text>
      {sub && <Text style={destacado ? [s.resumenSub, s.resumenSubDestacado] : s.resumenSub}>{sub}</Text>}
    </View>
  );
}

function Accion({ s, a }: { s: ReturnType<typeof crearEstilos>; a: ProtocoloAccionDto }) {
  return (
    <View style={s.accion}>
      <Text style={s.accionTitulo}>
        {a.titulo}
        {a.fechaRealizada ? ` · ${fmtFecha(a.fechaRealizada)}` : ''}
      </Text>
      <Text style={s.accionDetalle}>{detalleDe(a)}</Text>
    </View>
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
