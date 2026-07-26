import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { FUENTE_MARCA } from '../modules/tasador/informes/fuentes';

/**
 * Flyer comercial de la plataforma — 4 páginas.
 *
 * Lo usa un vendedor frente a un dueño de inmobiliaria, casi siempre desde el
 * teléfono. Por eso:
 *
 * - Va con la marca de la PLATAFORMA, no la de una inmobiliaria cliente:
 *   mostrarle a un prospecto el logo de un competidor juega en contra.
 * - Se genera ESTÁTICO con `scripts/generar-flyer.ts` y se sirve como archivo
 *   desde la web. No cuelga de un endpoint: en una reunión de venta nadie
 *   espera el arranque en frío del backend.
 * - Cada página se lee de un vistazo. Poco texto y una sola idea por página.
 */

const RED = '#C1121F';
const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const SURFACE = '#F4F5F7';
const GREEN = '#1E9E5A';

const s = StyleSheet.create({
  page: { paddingTop: 44, paddingHorizontal: 44, paddingBottom: 52, fontSize: 10, color: INK, fontFamily: FUENTE_MARCA },

  // — marca —
  marca: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  marcaIcono: { width: 22, height: 22, borderRadius: 6, backgroundColor: RED },
  marcaTexto: { fontSize: 8.5, fontWeight: 800, color: INK, letterSpacing: 2 },

  // — portada —
  portada: { flex: 1, justifyContent: 'center' },
  portadaKicker: { fontSize: 9, fontWeight: 800, color: RED, letterSpacing: 2.5, marginBottom: 16 },
  portadaTitulo: { fontSize: 40, fontWeight: 800, color: INK, lineHeight: 1.12 },
  portadaBarra: { width: 92, height: 5, backgroundColor: RED, marginTop: 26, marginBottom: 26 },
  portadaBajada: { fontSize: 13, color: MUTED, lineHeight: 1.6, maxWidth: '88%' },
  portadaPie: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 40 },
  puntoVerde: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: GREEN },
  portadaPieTexto: { fontSize: 9.5, color: MUTED },

  // — páginas de contenido —
  numero: { fontSize: 8, fontWeight: 800, color: MUTED, letterSpacing: 2 },
  titulo: { fontSize: 25, fontWeight: 800, color: INK, marginTop: 8, lineHeight: 1.18 },
  subrayado: { width: 60, height: 4, backgroundColor: RED, marginTop: 14, marginBottom: 20 },

  problema: { borderLeftWidth: 3.5, borderLeftColor: RED, paddingLeft: 14, paddingVertical: 4, marginBottom: 24 },
  problemaTexto: { fontSize: 13, fontWeight: 700, color: INK, lineHeight: 1.5, fontStyle: 'italic' },

  bloque: { borderWidth: 1, borderColor: LINE, borderRadius: 10, padding: 18, marginBottom: 14 },
  bloqueEtiqueta: { fontSize: 8, fontWeight: 800, color: RED, letterSpacing: 1.5 },
  bloqueTitulo: { fontSize: 15, fontWeight: 800, color: INK, marginTop: 7 },
  bloqueTexto: { fontSize: 10.5, color: MUTED, lineHeight: 1.65, marginTop: 7 },

  remate: { backgroundColor: INK, borderRadius: 10, padding: 20, marginTop: 'auto' },
  remateTexto: { fontSize: 13, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.5 },
  remateAcento: { color: '#FF8A93' },

  // — tres roles —
  roles: { flexDirection: 'row', gap: 11, marginBottom: 20 },
  rol: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 10, overflow: 'hidden' },
  rolCabecera: { backgroundColor: SURFACE, paddingVertical: 11, paddingHorizontal: 13, borderBottomWidth: 2, borderBottomColor: RED },
  rolNombre: { fontSize: 12.5, fontWeight: 800, color: INK },
  rolCuerpo: { padding: 13 },
  rolItem: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  rolBullet: { width: 3.5, height: 3.5, borderRadius: 1.75, backgroundColor: RED, marginTop: 5 },
  rolTexto: { flex: 1, fontSize: 9.5, color: MUTED, lineHeight: 1.55 },

  // — cierre —
  citaCaja: { backgroundColor: SURFACE, borderRadius: 10, padding: 22, marginBottom: 18 },
  citaTexto: { fontSize: 12, color: INK, lineHeight: 1.65 },
  citaFuerte: { fontWeight: 800 },

  ctaCaja: { backgroundColor: RED, borderRadius: 12, padding: 26, marginTop: 'auto' },
  ctaTitulo: { fontSize: 21, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.25 },
  ctaTexto: { fontSize: 11, color: '#FFE3E5', lineHeight: 1.6, marginTop: 10 },
  ctaWeb: { fontSize: 13, fontWeight: 800, color: '#FFFFFF', marginTop: 16 },

  pie: { position: 'absolute', bottom: 26, left: 44, right: 44, flexDirection: 'row', justifyContent: 'space-between' },
  pieTexto: { fontSize: 7.5, color: MUTED, letterSpacing: 0.5 },
});

const WEB = 'app.inmobiliariainteligente.net';

function Marca() {
  return (
    <View style={s.marca}>
      <View style={s.marcaIcono} />
      <Text style={s.marcaTexto}>INMOBILIARIA INTELIGENTE</Text>
    </View>
  );
}

function Pie({ n }: { n: number }) {
  return (
    <View style={s.pie} fixed>
      <Text style={s.pieTexto}>INMOBILIARIA INTELIGENTE</Text>
      <Text style={s.pieTexto}>{n} / 4</Text>
    </View>
  );
}

function Rol({ nombre, items }: { nombre: string; items: string[] }) {
  return (
    <View style={s.rol}>
      <View style={s.rolCabecera}>
        <Text style={s.rolNombre}>{nombre}</Text>
      </View>
      <View style={s.rolCuerpo}>
        {items.map((t, i) => (
          <View key={i} style={s.rolItem}>
            <View style={s.rolBullet} />
            <Text style={s.rolTexto}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function FlyerComercial() {
  return (
    <Document
      title="Inmobiliaria Inteligente"
      author="Inmobiliaria Inteligente"
      subject="Plataforma de gestión para inmobiliarias"
    >
      {/* 1 — La promesa. No explica: hace querer dar vuelta la hoja. */}
      <Page size="A4" style={s.page}>
        <Marca />
        <View style={s.portada}>
          <Text style={s.portadaKicker}>PLATAFORMA DE GESTIÓN INMOBILIARIA</Text>
          <Text style={s.portadaTitulo}>
            Tu inmobiliaria deja{'\n'}de funcionar{'\n'}de memoria.
          </Text>
          <View style={s.portadaBarra} />
          <Text style={s.portadaBajada}>
            Captación, seguimiento y resultados en un solo lugar. Cada uno ve lo que necesita: el vendedor
            su día, el líder su equipo, la dirección el negocio.
          </Text>
          <View style={s.portadaPie}>
            <View style={s.puntoVerde} />
            <Text style={s.portadaPieTexto}>En uso en Vacker Negocios Inmobiliarios</Text>
          </View>
        </View>
        <Pie n={1} />
      </Page>

      {/* 2 — Captación. */}
      <Page size="A4" style={s.page}>
        <Marca />
        <Text style={[s.numero, { marginTop: 26 }]}>01 · CAPTACIÓN</Text>
        <Text style={s.titulo}>De la charla{'\n'}al compromiso</Text>
        <View style={s.subrayado} />

        <View style={s.problema}>
          <Text style={s.problemaTexto}>
            &quot;¿Cuánto vale mi propiedad?&quot; es la pregunta más importante del negocio, y hoy se
            contesta con un número dicho al pasar.
          </Text>
        </View>

        <View style={s.bloque}>
          <Text style={s.bloqueEtiqueta}>TASACIÓN CON RESPALDO</Text>
          <Text style={s.bloqueTitulo}>El propietario recibe un informe, no un mensaje</Text>
          <Text style={s.bloqueTexto}>
            Comparables reales del mercado, con valor mínimo, recomendado y aspiracional. El sistema
            calcula la referencia y arma un informe profesional con la marca de tu inmobiliaria, listo
            para dejarle al cliente en la primera visita.
          </Text>
        </View>

        <View style={s.bloque}>
          <Text style={s.bloqueEtiqueta}>PROTOCOLO DE 5 SEMANAS</Text>
          <Text style={s.bloqueTitulo}>Un método, no la memoria de cada uno</Text>
          <Text style={s.bloqueTexto}>
            Desde que se firma la exclusividad, la plataforma sabe qué corresponde hacer cada semana y
            registra quién lo hizo. Nada queda librado a que alguien se acuerde.
          </Text>
        </View>

        <View style={s.remate}>
          <Text style={s.remateTexto}>
            Dejás de competir por precio{'\n'}y empezás a competir <Text style={s.remateAcento}>por método.</Text>
          </Text>
        </View>
        <Pie n={2} />
      </Page>

      {/* 3 — Visión por rol. */}
      <Page size="A4" style={s.page}>
        <Marca />
        <Text style={[s.numero, { marginTop: 26 }]}>02 · VISIÓN DEL NEGOCIO</Text>
        <Text style={s.titulo}>Cada uno ve lo suyo</Text>
        <View style={s.subrayado} />

        <View style={s.roles}>
          <Rol
            nombre="Vendedor"
            items={[
              'Sus operaciones y sus objetivos del año.',
              'Sus tasaciones y en qué semana va cada propiedad.',
              'Su agenda del día, sincronizada.',
            ]}
          />
          <Rol
            nombre="Team Leader"
            items={[
              'Su equipo completo, no solo lo propio.',
              'Quién avanza y quién se quedó, sin preguntar.',
              'El ranking del mes al día.',
            ]}
          />
          <Rol
            nombre="Dirección"
            items={[
              'Volumen, comisiones y puntas del año.',
              'La tendencia por trimestre y por mes.',
              'De cada número, quién y qué hay detrás.',
            ]}
          />
        </View>

        <View style={s.bloque}>
          <Text style={s.bloqueEtiqueta}>SIN REPORTES A MANO</Text>
          <Text style={s.bloqueTitulo}>Nadie pide un número por WhatsApp</Text>
          <Text style={s.bloqueTexto}>
            Cada rol entra y ve lo suyo, sin planillas que alguien tenga que armar el lunes a la mañana.
            Los números salen de las operaciones cargadas, así que están siempre al día.
          </Text>
        </View>

        <View style={s.remate}>
          <Text style={s.remateTexto}>
            La misma información,{'\n'}
            <Text style={s.remateAcento}>tres alturas distintas.</Text>
          </Text>
        </View>
        <Pie n={3} />
      </Page>

      {/* 4 — El cliente + demo. */}
      <Page size="A4" style={s.page}>
        <Marca />
        <Text style={[s.numero, { marginTop: 26 }]}>03 · LA RELACIÓN CON EL CLIENTE</Text>
        <Text style={s.titulo}>El propietario{'\n'}lo nota</Text>
        <View style={s.subrayado} />

        <View style={s.citaCaja}>
          <Text style={s.citaTexto}>
            A las cinco semanas, el propietario recibe un informe de lo que se hizo con su propiedad:
            visitas, consultas, publicaciones y ajustes de precio.{'\n'}
            {'\n'}
            <Text style={s.citaFuerte}>
              La conversación deja de ser &quot;¿por qué no se vendió?&quot; y pasa a ser &quot;esto
              hicimos, esto aprendimos, esto proponemos&quot;.
            </Text>
          </Text>
        </View>

        <View style={s.bloque}>
          <Text style={s.bloqueEtiqueta}>LO QUE CAMBIA</Text>
          <Text style={s.bloqueTexto}>
            El cliente que recibe un informe cada mes renueva la exclusividad sin discutir. El que no
            recibe nada, llama para preguntar qué está pasando — y esa llamada nunca es buena.
          </Text>
        </View>

        <View style={s.ctaCaja}>
          <Text style={s.ctaTitulo}>Te lo mostramos{'\n'}en 20 minutos</Text>
          <Text style={s.ctaTexto}>
            Una demo con tus propios números: cargamos una operación, generamos un informe de tasación y
            recorremos el protocolo de una propiedad. Vas a ver exactamente cómo lo usaría tu equipo.
          </Text>
          <Text style={s.ctaWeb}>{WEB}</Text>
        </View>
        <Pie n={4} />
      </Page>
    </Document>
  );
}
