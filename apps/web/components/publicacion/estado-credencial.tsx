import type { CredencialEstado } from '@vacker/types';

/**
 * Estado de la conexión con Tokko, en modo LECTURA.
 *
 * Quien publica necesita saber si la clave está cargada —si no, nada va a
 * funcionar y no tendría forma de entender por qué—, pero no debería poder
 * reemplazarla: eso es configuración de alta y se hace desde el panel de
 * plataforma. Por eso acá se muestra y no se edita, y el aviso dice a quién
 * pedírselo en vez de dejar a la persona adivinando.
 */
export function EstadoCredencial({ estado }: { estado: CredencialEstado }) {
  if (estado.configurada) {
    return (
      <div className="rounded-brand border border-line border-l-[3px] border-l-success bg-success/5 p-3">
        <p className="text-sm font-semibold text-ink">
          Conectado con Tokko · clave terminada en{' '}
          <span className="font-mono">{estado.ultimos4}</span>
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-brand border border-line border-l-[3px] border-l-amber-500 bg-amber-50 p-3">
      <p className="text-sm font-semibold text-ink">Falta conectar con Tokko</p>
      <p className="mt-1 text-sm leading-relaxed text-ink/80">
        La clave de API la carga la administración de la plataforma. Hasta que esté, no se pueden traer
        propiedades.
      </p>
    </div>
  );
}
