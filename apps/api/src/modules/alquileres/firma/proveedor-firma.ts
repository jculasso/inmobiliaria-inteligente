import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { EstadoFirmante } from '@vacker/types';

/** Una persona que tiene que firmar, como la necesita un proveedor. */
export interface FirmanteAEnviar {
  personaId: string;
  nombre: string;
  email: string | null;
}

/** Lo que dice un proveedor sobre un envío: por aviso (webhook) o al consultarlo. */
export interface AvisoFirma {
  envioId: string;
  firmantes: { personaId: string; estado: EstadoFirmante }[];
  vencido?: boolean;
  /** El PDF firmado, si el proveedor lo manda junto con el aviso. */
  archivoFirmado?: Buffer;
}

/**
 * La interfaz con la que el módulo pide una firma (regla 35). Ninguna otra
 * parte del módulo conoce al proveedor: cambiarlo es escribir otro adaptador
 * y registrarlo en `PROVEEDORES_FIRMA`.
 */
export interface ProveedorFirma {
  readonly nombre: string;
  /**
   * Manda el documento a firmar. Devuelve el id del envío en el proveedor. El
   * PDF se pide con `obtenerPdf`, recién cuando el adaptador lo necesita: el
   * manual no lo baja nunca.
   */
  enviar(
    documento: { nombre: string; obtenerPdf: () => Promise<Buffer> },
    firmantes: FirmanteAEnviar[],
  ): Promise<{ envioId: string }>;
  /**
   * Valida y traduce un aviso del proveedor. `null` si no es auténtico (firma
   * o token que no cierran): la API lo rechaza sin mirar qué dice.
   */
  leerAviso(
    cabeceras: Record<string, string | string[] | undefined>,
    cuerpo: unknown,
  ): AvisoFirma | null;
}

/** Los adaptadores disponibles, por nombre. Lo inyecta el módulo. */
export const PROVEEDORES_FIRMA = Symbol('PROVEEDORES_FIRMA');

/**
 * El adaptador manual (regla 34): no hay un proveedor del otro lado. La
 * inmobiliaria manda el PDF por su cuenta —mail, WhatsApp, en papel— y marca a
 * mano quién firmó. No recibe avisos.
 *
 * Es el que se usa hasta elegir un proveedor de firma electrónica.
 */
@Injectable()
export class FirmaManual implements ProveedorFirma {
  readonly nombre = 'manual';

  async enviar(): Promise<{ envioId: string }> {
    return { envioId: randomUUID() };
  }

  leerAviso(): AvisoFirma | null {
    return null;
  }
}
