import Link from 'next/link';

/**
 * Firma de la plataforma en la cabecera de cada módulo: el ícono de
 * Inmobiliaria Inteligente + su nombre, con link a la Home.
 *
 * Convive con el logo de la inmobiliaria, no lo reemplaza: al lado va el
 * logo del cliente (Vacker, Alteva…), que es de quien es la operación. Acá se
 * marca de quién es la plataforma, en chico y sin competir.
 *
 * Va en `plataforma` y NO en `brand-red`. `brand-red` lo pisa cada inmobiliaria
 * desde su configuración, así que nuestra propia firma salía del color del
 * cliente: dentro de Alteva, que tiene marca verde, este logotipo se veía
 * verde. La marca de la plataforma es azul y no la pisa nadie.
 */
export function MarcaPlataforma() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-plataforma hover:underline"
    >
      <svg viewBox="0 0 100 100" className="h-4 w-4 shrink-0" aria-hidden>
        <rect width="100" height="100" rx="22" fill="#173F6B" />
        <path
          d="M22 50 L50 27 L78 50"
          fill="none"
          stroke="#fff"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="31" y="58" width="9" height="15" rx="3" fill="#fff" opacity=".65" />
        <rect x="45.5" y="52" width="9" height="21" rx="3" fill="#fff" opacity=".82" />
        <rect x="60" y="45" width="9" height="28" rx="3" fill="#fff" />
      </svg>
      Inmobiliaria Inteligente
    </Link>
  );
}
