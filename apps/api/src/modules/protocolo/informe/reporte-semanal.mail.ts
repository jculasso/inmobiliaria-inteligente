import { asuntoDelReporte, textoDeCierre, type ReporteSemanal } from '@vacker/types';

// El reporte semanal como mail.
//
// Todo va con estilos EN LÍNEA y tablas, no con clases ni flexbox: es lo único
// que respetan todos los clientes de correo. Outlook sigue usando el motor de
// Word para renderizar, y Gmail borra los bloques <style> en la vista web.
//
// El rojo de urgencia va fijo (#C1121F) y NO sale de la marca de la
// inmobiliaria, por lo mismo que en la web y en el PDF: con una marca azul las
// alertas críticas no se distinguían de un dato informativo
// (CONVENCIONES_TECNICAS.md §13).

const DANGER = '#C1121F';
const WARNING = '#B7791F';
const SUCCESS = '#1E9E5A';
const INK = '#1D1D1F';
const MUTED = '#6B6B6B';
const LINE = '#E6E6E6';
const FUENTE = "Montserrat, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

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

export interface MailDelReporte {
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Arma el mail del reporte.
 *
 * **Cuando no hay nada urgente el mail es CORTO**: el titular, los cuatro
 * números y nada más (regla 9 de la especificación). Un correo semanal que
 * mide siempre lo mismo se deja de abrir en la tercera semana; el valor está
 * en que sea breve cuando todo va bien y largo solo cuando hay algo que
 * decidir. El detalle completo siempre está en el PDF adjunto y en la app.
 */
export function armarMailDelReporte(
  reporte: ReporteSemanal,
  tenantNombre: string,
  urlApp: string,
): MailDelReporte {
  const asunto = asuntoDelReporte(reporte);
  const { resumen } = reporte;

  const kpis = [
    { label: 'En comercialización', valor: resumen.activas, color: INK },
    {
      label: 'Necesitan atención',
      valor: resumen.conRojas,
      color: resumen.conRojas > 0 ? DANGER : INK,
    },
    {
      label: 'Autorizaciones',
      valor: resumen.autorizacionesEnRiesgo,
      color: resumen.autorizacionesEnRiesgo > 0 ? WARNING : INK,
    },
    { label: 'Listas para cierre', valor: resumen.listasParaCierre, color: INK },
  ];

  const celdasKpi = kpis
    .map(
      (k) => `<td style="width:25%;padding:10px 8px;border:1px solid ${LINE};border-radius:6px;vertical-align:top">
  <div style="font-size:10px;font-weight:700;color:${MUTED};letter-spacing:.5px;text-transform:uppercase">${esc(k.label)}</div>
  <div style="font-size:24px;font-weight:800;color:${k.color};padding-top:4px">${k.valor}</div>
</td>`,
    )
    .join('<td style="width:8px"></td>');

  const urgencias = reporte.hayUrgencias
    ? `<h2 style="font-size:13px;font-weight:800;color:${DANGER};letter-spacing:1px;text-transform:uppercase;margin:26px 0 8px">Necesita atención</h2>
${reporte.urgencias
  .map(
    (u) => `<div style="border:1px solid #EFC2C7;border-left:3px solid ${DANGER};border-radius:6px;padding:10px 12px;margin-bottom:8px">
  <div style="font-size:15px;font-weight:700;color:${INK}">${esc(u.direccion)}</div>
  <div style="font-size:12px;color:${MUTED};padding-bottom:4px">${esc(u.vendedorNombre)}</div>
  ${u.alertas
    .map(
      (a) => `<div style="font-size:13px;color:#8F0D18;padding-top:3px">• <strong>${esc(a.titulo)}</strong> — ${esc(a.detalle)}</div>`,
    )
    .join('')}
</div>`,
  )
  .join('')}`
    : `<div style="border:1px solid #BFE3CE;background:#EAF6EF;border-radius:6px;padding:12px 14px;margin-top:22px;font-size:14px;font-weight:700;color:${SUCCESS}">
  Ninguna propiedad necesita atención esta semana. Todo el trabajo está al día.
</div>`;

  // El detalle por vendedor solo va cuando hay algo que mirar. Si está todo al
  // día, repetir la lista completa es exactamente lo que hace que el mail se
  // vuelva ruido.
  const detalle = reporte.hayUrgencias
    ? `<h2 style="font-size:13px;font-weight:800;color:${MUTED};letter-spacing:1px;text-transform:uppercase;margin:26px 0 8px">Detalle por vendedor</h2>
${reporte.porVendedor
  .map(
    (v) => `<div style="border-bottom:1px solid ${LINE};padding:10px 0 4px;font-size:14px;font-weight:800;color:${INK}">
  ${esc(v.vendedorNombre)}
  <span style="font-weight:400;font-size:12px;color:${v.conRojas > 0 ? DANGER : MUTED}"> · ${v.propiedades.length} ${v.propiedades.length === 1 ? 'propiedad' : 'propiedades'}</span>
</div>
${v.propiedades
  .map((p) => {
    const cierre = textoDeCierre(p);
    const precio = monto(p.precio, p.moneda);
    const pasada = p.diasTranscurridos > CINCO_SEMANAS_EN_DIAS;
    return `<div style="padding:8px 0 10px;border-bottom:1px solid #F2F2F2">
  <a href="${esc(urlApp)}/protocolo/${esc(p.protocoloId)}" style="font-size:14px;font-weight:700;color:${INK};text-decoration:none">${esc(p.direccion)}</a>
  <div style="font-size:12px;color:${MUTED};padding-top:2px">
    Semana ${p.semanaActual} de 5${precio ? ` · ${esc(precio)}` : ''} · desde el ${fecha(p.fechaInicio)} ·
    <strong style="color:${pasada ? WARNING : INK}">${p.diasTranscurridos} ${p.diasTranscurridos === 1 ? 'día' : 'días'}</strong>${pasada ? ' (pasó las 5 semanas)' : ''}
  </div>
  ${cierre ? `<div style="font-size:12px;font-weight:700;color:${p.pendientesArrastrados > 0 ? WARNING : SUCCESS};padding-top:3px">${esc(cierre)}</div>` : ''}
  ${[...p.alertasGenerales, ...p.semanas.flatMap((s) => s.alertas)]
    .map(
      (a) =>
        `<div style="font-size:12px;padding-top:3px;color:${a.nivel === 'roja' ? '#8F0D18' : a.nivel === 'ambar' ? WARNING : SUCCESS}">• ${esc(a.titulo)}</div>`,
    )
    .join('')}
</div>`;
  })
  .join('')}`,
  )
  .join('')}`
    : '';

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(asunto)}</title></head>
<body style="margin:0;padding:0;background:#F4F5F7">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(asunto)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:20px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#fff;border-radius:12px;padding:22px;font-family:${FUENTE};color:${INK}">
<tr><td>
  <div style="font-size:11px;font-weight:700;color:${MUTED};letter-spacing:1.5px;text-transform:uppercase">${esc(tenantNombre)} · Protocolo 5 Semanas</div>
  <h1 style="font-size:19px;font-weight:800;margin:8px 0 4px;color:${reporte.hayUrgencias ? DANGER : SUCCESS}">${esc(asunto)}</h1>
  <div style="font-size:12px;color:${MUTED};padding-bottom:16px">Reporte del ${fecha(reporte.generadoEl)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${celdasKpi}</tr></table>

  ${urgencias}
  ${detalle}

  <div style="padding-top:24px">
    <a href="${esc(urlApp)}/protocolo/reporte" style="display:inline-block;background:${DANGER};color:#fff;font-size:14px;font-weight:700;text-decoration:none;padding:11px 20px;border-radius:10px">Ver el reporte completo</a>
  </div>
  <div style="font-size:11px;color:${MUTED};padding-top:18px;border-top:1px solid ${LINE};margin-top:20px">
    El detalle completo va adjunto en PDF. Este reporte se manda automáticamente los lunes; para dejar de recibirlo, avisale a tu administrador.
  </div>
</td></tr></table>
</td></tr></table>
</body></html>`;

  return { asunto, html, texto: textoPlano(reporte, tenantNombre, urlApp) };
}

/**
 * La versión en texto. No es opcional: un mail solo-HTML suma puntaje de spam,
 * y es lo que se ve en los relojes y en los lectores accesibles.
 */
function textoPlano(reporte: ReporteSemanal, tenantNombre: string, urlApp: string): string {
  const { resumen } = reporte;
  const lineas = [
    `${tenantNombre} · Protocolo 5 Semanas`,
    asuntoDelReporte(reporte),
    `Reporte del ${fecha(reporte.generadoEl)}`,
    '',
    `En comercialización: ${resumen.activas}`,
    `Necesitan atención: ${resumen.conRojas}`,
    `Autorizaciones vencidas o por vencer: ${resumen.autorizacionesEnRiesgo}`,
    `Listas para cierre: ${resumen.listasParaCierre}`,
    '',
  ];

  if (reporte.hayUrgencias) {
    lineas.push('NECESITA ATENCIÓN');
    for (const u of reporte.urgencias) {
      lineas.push(`- ${u.direccion} (${u.vendedorNombre})`);
      for (const a of u.alertas) lineas.push(`    ${a.titulo} — ${a.detalle}`);
    }
  } else {
    lineas.push('Ninguna propiedad necesita atención esta semana.');
  }

  lineas.push('', `Ver el reporte completo: ${urlApp}/protocolo/reporte`);
  return lineas.join('\n');
}
