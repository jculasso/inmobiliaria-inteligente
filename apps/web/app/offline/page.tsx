/**
 * Pantalla que muestra el service worker cuando una navegación no llega a la
 * red. Es la única página que se guarda en caché, así que no puede depender de
 * datos ni de los estilos de la app: después de un deploy, los archivos de
 * estilo cacheados pueden no ser los de esta versión. Por eso lleva sus
 * estilos adentro, y sus botones son links comunes, que andan sin JavaScript.
 *
 * Instalada como app no hay botón de recargar: sin «Reintentar» era un
 * callejón sin salida (revisión PWA del 6/10/2026).
 */
export const metadata = { title: 'Sin conexión · Inmobiliaria Inteligente' };

const boton = { display: 'inline-block', borderRadius: 16, padding: '10px 18px', fontWeight: 700, fontSize: 15, textDecoration: 'none' } as const;

export default function OfflinePage() {
  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: '#F4F5F7', fontFamily: 'Montserrat, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 420, width: '100%', textAlign: 'center', background: '#fff', borderRadius: 16, border: '1px solid #E6E6E6', padding: 28 }}>
        <div aria-hidden style={{ fontSize: 34 }}>
          📡
        </div>
        <h1 style={{ margin: '10px 0 6px', fontSize: 20, color: '#1D1D1F' }}>Sin conexión</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: '#6B6B6B' }}>
          No pudimos conectarnos. Revisá tu conexión a internet y volvé a intentar: la app carga los datos en el momento, así que necesita estar conectada.
        </p>
        <div style={{ marginTop: 20, display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {/* href vacío = la misma dirección: vuelve a pedir la página que falló. */}
          <a href="" style={{ ...boton, background: '#C1121F', color: '#fff' }}>
            Reintentar
          </a>
          <a href="/" style={{ ...boton, background: '#fff', color: '#1D1D1F', border: '1px solid #E6E6E6' }}>
            Ir al inicio
          </a>
        </div>
      </div>
    </main>
  );
}
