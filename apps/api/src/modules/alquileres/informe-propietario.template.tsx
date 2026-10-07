import React from 'react';
import { Document, Image, Page, Text, View } from '@react-pdf/renderer';
import { nombreDelRango } from '@vacker/domain';
import {
  NOMBRE_CATEGORIA_PARTIDA,
  NOMBRE_ESTADO_RECLAMO,
  estadoDePartida,
  queSeDescuentaEnLaProxima,
  renglonesDeLaCadena,
  type CategoriaPartida,
  type InformePropietarioDto,
  type MonedaAlquiler,
} from '@vacker/types';
import { crearEstilos, DANGER, fecha, LEYENDA_NO_FACTURA, MEDIO, pesos } from './recibo.template';

// El informe al propietario en PDF (regla 95): lo mismo que la pantalla, con
// el encabezado y los estilos de la liquidación. Sin ✓ ni flechas: Montserrat
// no los tiene y arrastrarían Helvetica (CONVENCIONES_TECNICAS §14).

const MUTED = '#6B6B6B';
const numero = (n: number) => String(n).padStart(6, '0');
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const mesDe = (p: string) => `${MESES[Number(p.slice(5, 7)) - 1]} ${p.slice(0, 4)}`;

export function InformePropietarioDocument({
  informe: i,
  tenantNombre,
  logoUrl,
  colorPrimario,
}: {
  informe: InformePropietarioDto;
  tenantNombre: string;
  logoUrl: string | null;
  colorPrimario: string | null;
}) {
  const e = crearEstilos(colorPrimario || DANGER);
  const periodo = nombreDelRango(i.desde, i.hasta);
  const sinMovimientos = i.resumen.length === 0 && i.reclamos.length === 0;
  const plata = (n: number, moneda: MonedaAlquiler) => pesos(n, moneda);
  // Un título no queda solo al pie de una hoja: si no entra algo debajo, pasa a la siguiente.
  const Seccion = ({ children }: { children: string }) => (
    <Text minPresenceAhead={120} style={[e.kicker, { marginTop: 18, marginBottom: 6 }]}>
      {children}
    </Text>
  );
  // Las columnas de texto llevan aire a la izquierda: pegadas a un importe
  // alineado a la derecha, se leían como un solo número.
  const AIRE = { paddingLeft: 8 };
  const Cabeza = ({ cols }: { cols: [string, string, boolean?][] }) => (
    <View style={e.filaHead} wrap={false}>
      {cols.map(([t, w, der], k) => (
        <Text
          key={t}
          style={[e.th, { width: w }, der ? { textAlign: 'right' } : k > 0 ? AIRE : {}]}
        >
          {t}
        </Text>
      ))}
    </View>
  );
  const Celda = ({
    w,
    children,
    der,
    bold,
    primera,
  }: {
    w: string;
    children: string;
    der?: boolean;
    bold?: boolean;
    primera?: boolean;
  }) => (
    <Text
      style={[
        { width: w, fontSize: 8.5 },
        der ? { textAlign: 'right' } : primera ? {} : AIRE,
        bold ? { fontWeight: 700 } : {},
      ]}
    >
      {children}
    </Text>
  );
  const categorias = Object.keys(NOMBRE_CATEGORIA_PARTIDA) as CategoriaPartida[];

  return (
    <Document title={`Informe ${periodo} — ${i.persona.nombre}`} author={tenantNombre}>
      <Page size="A4" style={e.page}>
        <View style={e.header}>
          <View style={e.logoBox}>
            {logoUrl ? <Image src={logoUrl} style={e.logoImg} /> : <View style={e.logoFallback} />}
            <Text style={e.brandName}>{tenantNombre}</Text>
          </View>
          <View style={e.docMeta}>
            <Text style={e.docMetaLabel}>INFORME AL PROPIETARIO</Text>
            <Text style={e.docMetaValue}>{`Emitido el ${fecha(i.hoy)}`}</Text>
          </View>
        </View>

        <Text style={e.kicker}>ALQUILERES · INFORME AL PROPIETARIO</Text>
        <Text style={e.title}>{i.persona.nombre}</Text>
        <View style={e.divider} />

        <View style={e.datos}>
          <View>
            <Text style={e.datoLabel}>PERÍODO</Text>
            <Text style={e.datoValor}>{periodo}</Text>
          </View>
          <View>
            <Text style={e.datoLabel}>PROPIEDADES</Text>
            <Text style={e.datoValor}>{String(i.contratos.length)}</Text>
          </View>
        </View>
        <Text style={e.nota}>
          Lo cobrado y lo liquidado se cuentan hasta la fecha de emisión de este informe.
        </Text>

        <Seccion>RESUMEN</Seccion>
        {i.resumen.length === 0 ? (
          <Text style={{ fontSize: 9.5, color: MUTED }}>{`Sin movimientos en ${periodo}.`}</Text>
        ) : (
          i.resumen.map((c) => (
            <View key={c.moneda} style={{ marginBottom: 8 }} wrap={false}>
              {i.resumen.length > 1 && (
                <Text style={[e.datoLabel, { marginBottom: 2 }]}>
                  {c.moneda === 'USD' ? 'EN DÓLARES' : 'EN PESOS'}
                </Text>
              )}
              {renglonesDeLaCadena(c, queSeDescuentaEnLaProxima(i.partidas, c.moneda)).map((r) => (
                <View key={r.nombre} style={e.fila} wrap={false}>
                  <View style={{ width: '70%' }}>
                    <Text style={[{ fontSize: 9 }, r.fuerte ? { fontWeight: 700 } : {}]}>
                      {r.nombre}
                    </Text>
                    {r.detalle && <Text style={[e.nota, { marginTop: 2 }]}>{r.detalle}</Text>}
                  </View>
                  <Text
                    style={[e.colImporte, { width: '30%' }, r.fuerte ? { fontWeight: 700 } : {}]}
                  >
                    {plata(r.importe, c.moneda)}
                  </Text>
                </View>
              ))}
            </View>
          ))
        )}
        {i.deuda.map((d) => (
          <Text key={d.moneda} style={[e.nota, { color: DANGER, marginTop: 4 }]}>
            {`El inquilino debe hoy ${plata(d.total, d.moneda)}, ya vencido: ${d.contratos
              .map((x) => `${x.inquilino} (contrato ${x.codigo}) ${plata(x.importe, d.moneda)}`)
              .join(' · ')}.`}
          </Text>
        ))}

        <Seccion>POR PROPIEDAD</Seccion>
        {i.contratos.map((c) => (
          <View key={c.id} style={{ marginBottom: 12 }} wrap={false}>
            <View
              style={{ backgroundColor: '#F4F5F7', padding: 8, borderRadius: 4, marginBottom: 4 }}
            >
              <Text style={{ fontSize: 10, fontWeight: 800 }}>{`PROPIEDAD: ${c.propiedad}`}</Text>
              <Text style={{ fontSize: 8.5, marginTop: 3 }}>
                {[
                  `Contrato: ${c.codigo}`,
                  `${c.inquilinos.length > 1 ? 'Inquilinos' : 'Inquilino'}: ${c.inquilinos.join(', ') || '—'}`,
                  c.porcentaje != null ? `Su parte: ${c.porcentaje}%` : null,
                ]
                  .filter(Boolean)
                  .join('   ·   ')}
              </Text>
              <Text style={{ fontSize: 8.5, marginTop: 2 }}>
                {[
                  `Alquiler vigente: ${c.alquilerVigente != null ? plata(c.alquilerVigente, c.moneda) : '—'}`,
                  `Próxima indexación: ${c.proximaIndexacion ? fecha(c.proximaIndexacion) : '—'}`,
                  `Vence: ${fecha(c.vence)}`,
                ].join('   ·   ')}
              </Text>
            </View>
            {c.meses.length === 0 ? (
              <Text style={e.nota}>Sin alquileres generados en el período.</Text>
            ) : (
              <>
                <Cabeza
                  cols={[
                    ['MES', '18%'],
                    ['ALQUILER', '18%', true],
                    ['COBRADO', '18%', true],
                    ['COBRADO EL', '20%'],
                    ['LIQUIDADO EN', '26%'],
                  ]}
                />
                {c.meses.map((m) => (
                  <View key={m.periodo} style={e.fila} wrap={false}>
                    <Celda w="18%" primera>
                      {mesDe(m.periodo)}
                    </Celda>
                    <Celda w="18%" der>
                      {plata(m.alquiler, c.moneda)}
                    </Celda>
                    <Celda w="18%" der>
                      {plata(m.cobrado, c.moneda)}
                    </Celda>
                    <Celda w="20%">
                      {m.cobradoEl.map(fecha).join(', ') || (m.enEspera ? 'Todavía no pagó' : '—')}
                    </Celda>
                    <Celda w="26%">
                      {m.liquidaciones
                        .map((l) => `Liq. ${numero(l.numero)} del ${fecha(l.fecha)}`)
                        .join(', ') || (m.cobrado ? 'Va en la próxima' : '—')}
                    </Celda>
                  </View>
                ))}
              </>
            )}
          </View>
        ))}

        <Seccion>DESCUENTOS DETALLADOS</Seccion>
        {i.partidas.length === 0 ? (
          <Text style={e.nota}>No se le descontó nada en el período.</Text>
        ) : (
          categorias
            .filter((cat) => i.partidas.some((p) => p.categoria === cat))
            .map((cat) => {
              const ps = i.partidas.filter((p) => p.categoria === cat);
              return (
                <View key={cat} style={{ marginBottom: 8 }}>
                  <Text minPresenceAhead={30} style={[e.datoLabel, { marginBottom: 2 }]}>
                    {NOMBRE_CATEGORIA_PARTIDA[cat].toUpperCase()}
                  </Text>
                  {ps.map((p) => (
                    <View key={p.conceptoId} style={e.fila} wrap={false}>
                      <Celda w="24%" bold primera>
                        {p.nombre}
                      </Celda>
                      <Celda w="34%">{`${p.detalle} · ${p.contrato.codigo}`}</Celda>
                      <Celda w="24%">{estadoDePartida(p)}</Celda>
                      <Celda w="18%" der>
                        {plata(p.importe, p.moneda)}
                      </Celda>
                    </View>
                  ))}
                </View>
              );
            })
        )}

        <Seccion>MANTENIMIENTO</Seccion>
        {i.reclamos.length === 0 ? (
          <Text style={e.nota}>Sin reclamos en el período.</Text>
        ) : (
          <>
            <Cabeza
              cols={[
                ['FECHA', '12%'],
                ['RECLAMO', '30%'],
                ['PROPIEDAD', '20%'],
                ['PROVEEDOR', '14%'],
                ['ESTADO', '10%'],
                ['A SU CARGO', '14%', true],
              ]}
            />
            {i.reclamos.map((r) => (
              <View key={r.id} style={e.fila} wrap={false}>
                <Celda w="12%" primera>
                  {fecha(r.fecha)}
                </Celda>
                <Celda w="30%">{`N° ${r.numero} · ${r.asunto}`}</Celda>
                <Celda w="20%">{r.propiedad ?? '—'}</Celda>
                <Celda w="14%">{r.proveedor ?? '—'}</Celda>
                <Celda w="10%">{NOMBRE_ESTADO_RECLAMO[r.estado]}</Celda>
                <Celda w="14%" der>
                  {r.aCargoDelPropietario.map((x) => plata(x.importe, x.moneda)).join(' + ') || '—'}
                </Celda>
              </View>
            ))}
          </>
        )}

        <Seccion>LIQUIDACIONES</Seccion>
        {i.liquidaciones.length === 0 ? (
          <Text style={e.nota}>
            {sinMovimientos
              ? 'Ninguna en el período.'
              : 'Todavía no se le liquidó nada de este período.'}
          </Text>
        ) : (
          <>
            <Cabeza
              cols={[
                ['N°', '16%'],
                ['FECHA', '18%'],
                ['MEDIO', '22%'],
                ['NETO', '22%', true],
                ['DEL PERÍODO', '22%', true],
              ]}
            />
            {i.liquidaciones.map((l) => (
              <View key={l.id} style={e.fila} wrap={false}>
                <Celda w="16%" primera>
                  {numero(l.numero)}
                </Celda>
                <Celda w="18%">{fecha(l.fecha)}</Celda>
                <Celda w="22%">{MEDIO[l.medio]}</Celda>
                <Celda w="22%" der>
                  {plata(l.neto, l.moneda)}
                </Celda>
                <Celda w="22%" der>
                  {plata(l.delPeriodo, l.moneda)}
                </Celda>
              </View>
            ))}
          </>
        )}

        <Text style={e.pie} fixed>
          {LEYENDA_NO_FACTURA}
        </Text>
      </Page>
    </Document>
  );
}
