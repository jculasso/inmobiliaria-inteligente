import type { TasacionDto } from '@vacker/types';

/**
 * El borrador de una tasación NUEVA, antes de que exista en la base.
 *
 * Hasta el primer «Siguiente» la tasación no existe y no hay dónde guardarla:
 * si el iPhone descargaba la pestaña (abrir la cámara, cambiar de app) se
 * perdía todo lo cargado en la visita. Va a `sessionStorage` —vive mientras
 * viva la pestaña, no queda en el equipo— y con el id del usuario: en un
 * celular compartido, el borrador de una persona no le aparece a otra.
 */
export interface BorradorTasacion {
  usuarioId: string;
  seccion: number;
  datos: Partial<TasacionDto>;
}

const CLAVE = 'tasacion-nueva-borrador';

function almacen(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null; // modo privado o almacenamiento bloqueado: sin borrador, pero la pantalla anda
  }
}

/** El borrador de este usuario, o `null` si no hay o es de otra persona. */
export function leerBorrador(usuarioId: string): BorradorTasacion | null {
  try {
    const crudo = almacen()?.getItem(CLAVE);
    if (!crudo) return null;
    const b = JSON.parse(crudo) as BorradorTasacion;
    if (!b || b.usuarioId !== usuarioId || typeof b.datos !== 'object') return null;
    return b;
  } catch {
    return null;
  }
}

export function guardarBorrador(b: BorradorTasacion): void {
  try {
    almacen()?.setItem(CLAVE, JSON.stringify(b));
  } catch {
    // Lleno o bloqueado: se sigue sin borrador.
  }
}

export function borrarBorrador(): void {
  try {
    almacen()?.removeItem(CLAVE);
  } catch {
    // nada
  }
}
