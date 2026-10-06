import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import { crearEstilos, DANGER } from './recibo.template';

/**
 * El contrato generado desde una plantilla (entrega 15). La plantilla es texto
 * con tres convenciones: «# » para el título, «## » para cada cláusula y una
 * línea en blanco entre párrafos. El resto se compone solo.
 */
export function PlantillaDocument({ texto, tenantNombre, logoUrl, colorPrimario }: { texto: string; tenantNombre: string; logoUrl: string | null; colorPrimario: string | null }) {
  const e = crearEstilos(colorPrimario || DANGER);
  const bloques = texto.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  return (
    <Document title={`Contrato — ${tenantNombre}`} author={tenantNombre}>
      <Page size="A4" style={[e.page, { fontSize: 10, lineHeight: 1.45 }]}>
        <View style={[e.header, { marginBottom: 12 }]} fixed>
          <View style={e.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={{ width: 40, height: 40, objectFit: 'contain' }} /> : null}
            <Text style={e.brandName}>{tenantNombre}</Text>
          </View>
        </View>
        {bloques.map((b, i) => {
          if (b.startsWith('# ')) return <Text key={i} style={{ fontSize: 14, fontWeight: 800, textAlign: 'center', marginBottom: 12 }}>{b.slice(2)}</Text>;
          if (b.startsWith('## ')) {
            const [titulo, ...resto] = b.slice(3).split('\n');
            return (
              <View key={i} style={{ marginBottom: 8 }} wrap={false}>
                <Text style={{ fontWeight: 700, marginBottom: 3 }}>{titulo}</Text>
                {resto.length > 0 && <Text style={{ textAlign: 'justify' }}>{resto.join('\n')}</Text>}
              </View>
            );
          }
          return (
            <Text key={i} style={{ textAlign: 'justify', marginBottom: 8 }}>
              {b}
            </Text>
          );
        })}
        <Text style={e.pie} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
