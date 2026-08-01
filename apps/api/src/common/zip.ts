import { deflateRawSync } from 'node:zlib';

/**
 * Escritor mínimo de archivos ZIP.
 *
 * Va a mano y sin dependencias, igual que el cliente de Tokko y el de Resend:
 * un ZIP es un formato viejo y estable —cabecera por archivo, directorio
 * central, y un cierre— y traer una librería entera para escribir tres
 * estructuras binarias no se justifica.
 *
 * El CRC también va a mano en vez de usar `zlib.crc32`, que existe recién
 * desde Node 22.2: el `engines` del proyecto pide `>=22` a secas, así que
 * apoyarse en esa función sería funcionar en local y romper en producción si
 * el servidor quedó en un 22.0.
 */

export interface ArchivoZip {
  nombre: string;
  contenido: Buffer;
}

/** Tabla del CRC-32 (polinomio 0xEDB88320), calculada una sola vez. */
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en el formato de dos bytes que usa el ZIP (heredado de MS-DOS). */
function fechaDos(d: Date): { hora: number; fecha: number } {
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    // Los años se cuentan desde 1980, que es cuando se definió el formato.
    fecha: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/**
 * Arma un ZIP con los archivos dados.
 *
 * `momento` se pasa desde afuera para que el resultado sea reproducible en los
 * tests: con la hora del reloj adentro, el mismo contenido daría dos archivos
 * distintos y no se podría comparar nada.
 */
export function crearZip(archivos: ArchivoZip[], momento = new Date()): Buffer {
  const { hora, fecha } = fechaDos(momento);
  const locales: Buffer[] = [];
  const centrales: Buffer[] = [];
  let offset = 0;

  for (const a of archivos) {
    const nombre = Buffer.from(a.nombre, 'utf8');
    const crudo = a.contenido;
    const comprimido = deflateRawSync(crudo);
    // Si comprimir no achica (archivos diminutos), se guarda tal cual.
    const usaDeflate = comprimido.length < crudo.length;
    const datos = usaDeflate ? comprimido : crudo;
    const metodo = usaDeflate ? 8 : 0;
    const suma = crc32(crudo);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // firma de cabecera local
    local.writeUInt16LE(20, 4); // versión necesaria
    local.writeUInt16LE(0x0800, 6); // bandera: el nombre viene en UTF-8
    local.writeUInt16LE(metodo, 8);
    local.writeUInt16LE(hora, 10);
    local.writeUInt16LE(fecha, 12);
    local.writeUInt32LE(suma, 14);
    local.writeUInt32LE(datos.length, 18);
    local.writeUInt32LE(crudo.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    local.writeUInt16LE(0, 28); // sin campo extra
    locales.push(local, nombre, datos);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // firma del directorio central
    central.writeUInt16LE(20, 4); // versión que lo creó
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(metodo, 10);
    central.writeUInt16LE(hora, 12);
    central.writeUInt16LE(fecha, 14);
    central.writeUInt32LE(suma, 16);
    central.writeUInt32LE(datos.length, 20);
    central.writeUInt32LE(crudo.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42); // dónde empieza su cabecera local
    centrales.push(central, nombre);

    offset += local.length + nombre.length + datos.length;
  }

  const cuerpo = Buffer.concat(locales);
  const directorio = Buffer.concat(centrales);
  const cierre = Buffer.alloc(22);
  cierre.writeUInt32LE(0x06054b50, 0); // firma del cierre
  cierre.writeUInt16LE(0, 4);
  cierre.writeUInt16LE(0, 6);
  cierre.writeUInt16LE(archivos.length, 8);
  cierre.writeUInt16LE(archivos.length, 10);
  cierre.writeUInt32LE(directorio.length, 12);
  cierre.writeUInt32LE(cuerpo.length, 16);
  cierre.writeUInt16LE(0, 20); // sin comentario

  return Buffer.concat([cuerpo, directorio, cierre]);
}
