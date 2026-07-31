import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import {
  asuntoDelReporte,
  textoDeCierre,
  type EstadoSemana,
  type PropiedadEnReporte,
  type ReporteSemanal,
} from '@vacker/types';
import { FUENTE_MARCA } from '../../tasador/informes/fuentes';

// Reporte semanal en PDF: el mismo contenido que la pantalla y que el mail,
// para imprimir o adjuntar. Encabezado y tratamiento idénticos a los otros dos
// informes (tasación y comercialización).
//
// NO lleva las fotos de las propiedades, a diferencia de la pantalla. Cada foto
// es una descarga remota en el momento de armar el PDF; con veinte propiedades
// son veinte descargas en serie antes de poder responder, sobre un servidor que
// además está en otra región que Storage. En pantalla la foto ayuda a reconocer
// la propiedad mientras uno navega; en un PDF que se lee de arriba abajo, la
// dirección alcanza.

const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';

/**
 * Colores de severidad. Fijos, NO derivados de la marca de la inmobiliaria.
 *
 * Misma regla que en la web (`CONVENCIONES_TECNICAS.md` §13): con una marca
 * azul las alertas críticas salían azules y nada resaltaba. Un reporte impreso
 * donde lo urgente no se distingue no sirve para nada.
 */
const DANGER = '#C1121F';
const DANGER_DARK = '#8F0D18';
const WARNING = '#B7791F';
const SUCCESS = '#1E9E5A';

const COLOR_SEMANA: Record<EstadoSemana, { fondo: string; texto: string; borde: string }> = {
  completa: { fondo: '#EAF6EF', texto: SUCCESS, borde: '#BFE3CE' },
  en_curso: { fondo: '#FBF3E4', texto: WARNING, borde: '#E8D3A8' },
  incompleta: { fondo: '#FBEAEC', texto: DANGER, borde: '#EFC2C7' },
  futura: { fondo: '#F4F5F7', texto: MUTED, borde: LINE },
};

function crearEstilos(red: string) {
  return StyleSheet.create({
    page: {
      paddingTop: 36,
      paddingHorizontal: 36,
      paddingBottom: 52,
      fontSize: 9,
      color: INK,
      fontFamily: FUENTE_MARCA,
    },

    // — encabezado, idéntico a los otros informes —
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

    // — tarjetas del resumen —
    resumenGrid: { flexDirection: 'row', gap: 8 },
    resumenCard: {
      width: '23.5%',
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 6,
      padding: 8,
    },
    resumenLabel: { fontSize: 6.5, fontWeight: 700, color: MUTED, letterSpacing: 0.5 },
    resumenValor: { fontSize: 17, fontWeight: 800, marginTop: 3 },
    resumenSub: { fontSize: 6.5, color: MUTED, marginTop: 2 },

    // — secciones —
    sectionTitle: { fontSize: 10, fontWeight: 800, marginTop: 18, marginBottom: 6 },
    sectionUnderline: { width: '100%', height: 2, marginBottom: 10 },

    // — bloque de urgencias —
    urgente: {
      borderWidth: 1,
      borderColor: '#EFC2C7',
      borderLeftWidth: 3,
      borderLeftColor: DANGER,
      borderRadius: 5,
      padding: 8,
      marginBottom: 6,
    },
    urgenteTitulo: { fontSize: 10, fontWeight: 700 },
    urgenteVendedor: { fontSize: 8, color: MUTED },
    alertaLinea: { fontSize: 8.5, marginTop: 3 },

    // — detalle por vendedor —
    vendedor: {
      fontSize: 10,
      fontWeight: 800,
      marginTop: 14,
      marginBottom: 5,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: LINE,
    },
    propiedad: {
      borderWidth: 1,
      borderColor: LINE,
      borderRadius: 5,
      padding: 8,
      marginBottom: 6,
    },
    propDireccion: { fontSize: 10, fontWeight: 700 },
    propMeta: { fontSize: 8, color: MUTED, marginTop: 1 },
    tira: { flexDirection: 'row', gap: 4, marginTop: 6 },
    celda: {
      flex: 1,
      borderWidth: 1,
      borderRadius: 3,
      paddingVertical: 3,
      alignItems: 'center',
    },
    celdaSemana: { fontSize: 7, fontWeight: 700 },
    celdaValor: { fontSize: 8, fontWeight: 800, marginTop: 1 },
    cierre: { fontSize: 8, fontWeight: 700, marginTop: 5 },

    vacio: { fontSize: 9, color: MUTED, marginTop: 10 },

    pie: {
      position: 'absolute',
      bottom: 24,
      left: 36,
      right: 36,
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderTopWidth: 1,
      borderTopColor: LINE,
      paddingTop: 6,
      fontSize: 7,
      color: MUTED,
    },
  });
}

type Estilos = ReturnType<typeof crearEstilos>;

/** dd/mm/aaaa, como lo escribe la dirección. */
function fecha(iso: string): string {
  const [a, m, d] = iso.split('-');
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

function monto(precio: number | null, moneda: string): string | null {
  if (precio == null) return null;
  const n = Math.round(precio).toLocaleString('es-AR');
  return moneda === 'USD' ? `$${n}` : `${moneda} ${n}`;
}

const CINCO_SEMANAS_EN_DIAS = 35;

function Tira({ propiedad, e }: { propiedad: PropiedadEnReporte; e: Estilos }) {
  return (
    <View style={e.tira}>
      {propiedad.semanas.map((s) => {
        const c = COLOR_SEMANA[s.estado];
        /*
         * En pantalla la semana completa muestra un ✓. Acá va un 0, y no es
         * un descuido: **Montserrat no tiene el carácter ✓**. react-pdf, al no
         * encontrarlo, incrusta Helvetica solo para ese glifo — una segunda
         * tipografía en un informe de marca, por una tilde.
         *
         * El 0 dice lo mismo (cero pendientes), es coherente con las otras
         * celdas —que también son números— y el color verde ya comunica que
         * está cerrada. Hay un test que verifica que la ÚNICA familia
         * incrustada sea Montserrat.
         */
        const valor =
          s.estado === 'futura' ? '·' : s.atrasadas > 0 ? String(s.atrasadas) : String(s.pendientes);
        return (
          <View key={s.semana} style={[e.celda, { backgroundColor: c.fondo, borderColor: c.borde }]}>
            <Text style={[e.celdaSemana, { color: c.texto }]}>S{s.semana}</Text>
            <Text style={[e.celdaValor, { color: c.texto }]}>{valor}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Propiedad({ propiedad, e }: { propiedad: PropiedadEnReporte; e: Estilos }) {
  const cierre = textoDeCierre(propiedad);
  const pasada = propiedad.diasTranscurridos > CINCO_SEMANAS_EN_DIAS;
  const precio = monto(propiedad.precio, propiedad.moneda);
  const alertas = [...propiedad.alertasGenerales, ...propiedad.semanas.flatMap((s) => s.alertas)];

  return (
    // `wrap={false}`: la ficha se lee como una unidad; partida al medio entre
    // dos páginas no se entiende.
    <View style={e.propiedad} wrap={false}>
      <Text style={e.propDireccion}>{propiedad.direccion}</Text>
      <Text style={e.propMeta}>
        Semana {propiedad.semanaActual} de 5{precio ? ` · ${precio}` : ''}
      </Text>
      <Text style={e.propMeta}>
        Desde el {fecha(propiedad.fechaInicio)} · {propiedad.diasTranscurridos}{' '}
        {propiedad.diasTranscurridos === 1 ? 'día' : 'días'}
        {pasada ? ' (pasó las 5 semanas)' : ''}
      </Text>

      <Tira propiedad={propiedad} e={e} />

      {cierre && (
        <Text style={[e.cierre, { color: propiedad.pendientesArrastrados > 0 ? WARNING : SUCCESS }]}>
          {cierre}
        </Text>
      )}

      {alertas.map((a, i) => (
        <Text
          key={i}
          style={[
            e.alertaLinea,
            { color: a.nivel === 'roja' ? DANGER_DARK : a.nivel === 'ambar' ? WARNING : SUCCESS },
          ]}
        >
          • {a.titulo} — {a.detalle}
        </Text>
      ))}
    </View>
  );
}

export function ReporteSemanalDocument({
  reporte,
  tenantNombre,
  logoUrl,
  colorPrimario,
}: {
  reporte: ReporteSemanal;
  tenantNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}) {
  const red = colorPrimario || '#C1121F';
  const e = crearEstilos(red);
  const { resumen } = reporte;

  return (
    <Document
      title={`Reporte semanal — ${tenantNombre}`}
      author={tenantNombre}
      subject={asuntoDelReporte(reporte)}
    >
      <Page size="A4" style={e.page}>
        <View style={e.header} fixed>
          <View style={e.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={e.logoImg} /> : <View style={e.logoFallback} />}
            <Text style={e.brandName}>{tenantNombre}</Text>
          </View>
          <View style={e.docMeta}>
            <Text style={e.docMetaLabel}>REPORTE SEMANAL</Text>
            <Text style={e.docMetaValue}>{fecha(reporte.generadoEl)}</Text>
          </View>
        </View>

        <Text style={e.kicker}>PROTOCOLO 5 SEMANAS</Text>
        <Text style={[e.title, { color: reporte.hayUrgencias ? DANGER : SUCCESS }]}>
          {asuntoDelReporte(reporte)}
        </Text>
        <View style={e.divider} />

        <View style={e.resumenGrid}>
          <View style={e.resumenCard}>
            <Text style={e.resumenLabel}>EN COMERCIALIZACIÓN</Text>
            <Text style={e.resumenValor}>{resumen.activas}</Text>
            <Text style={e.resumenSub}>Propiedades activas</Text>
          </View>
          <View style={e.resumenCard}>
            <Text style={e.resumenLabel}>NECESITAN ATENCIÓN</Text>
            <Text style={[e.resumenValor, { color: resumen.conRojas > 0 ? DANGER : INK }]}>
              {resumen.conRojas}
            </Text>
            <Text style={e.resumenSub}>Con algo vencido</Text>
          </View>
          <View style={e.resumenCard}>
            <Text style={e.resumenLabel}>AUTORIZACIONES</Text>
            <Text style={[e.resumenValor, { color: resumen.autorizacionesEnRiesgo > 0 ? WARNING : INK }]}>
              {resumen.autorizacionesEnRiesgo}
            </Text>
            <Text style={e.resumenSub}>Vencidas o por vencer</Text>
          </View>
          <View style={e.resumenCard}>
            <Text style={e.resumenLabel}>LISTAS PARA CIERRE</Text>
            <Text style={e.resumenValor}>{resumen.listasParaCierre}</Text>
            <Text style={e.resumenSub}>
              {resumen.listasConPendientes > 0
                ? `${resumen.listasConPendientes} con tareas pendientes`
                : 'Completaron las cinco semanas'}
            </Text>
          </View>
        </View>

        {reporte.porVendedor.length === 0 ? (
          <Text style={e.vacio}>
            Todavía no hay propiedades en comercialización.
          </Text>
        ) : (
          <>
            {reporte.hayUrgencias && (
              <>
                <Text style={[e.sectionTitle, { color: DANGER }]}>NECESITA ATENCIÓN</Text>
                <View style={[e.sectionUnderline, { backgroundColor: DANGER }]} />
                {reporte.urgencias.map((u) => (
                  <View key={u.protocoloId} style={e.urgente} wrap={false}>
                    <Text style={e.urgenteTitulo}>{u.direccion}</Text>
                    <Text style={e.urgenteVendedor}>{u.vendedorNombre}</Text>
                    {u.alertas.map((a, i) => (
                      <Text key={i} style={[e.alertaLinea, { color: DANGER_DARK }]}>
                        • {a.titulo} — {a.detalle}
                      </Text>
                    ))}
                  </View>
                ))}
              </>
            )}

            <Text style={[e.sectionTitle, { color: INK }]}>DETALLE POR VENDEDOR</Text>
            <View style={[e.sectionUnderline, { backgroundColor: red }]} />
            {reporte.porVendedor.map((v) => (
              <View key={v.vendedorId}>
                <Text style={e.vendedor}>{v.vendedorNombre}</Text>
                {v.propiedades.map((p) => (
                  <Propiedad key={p.protocoloId} propiedad={p} e={e} />
                ))}
              </View>
            ))}
          </>
        )}

        <View style={e.pie} fixed>
          <Text>
            {tenantNombre} · Reporte semanal del Protocolo 5 Semanas
          </Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
