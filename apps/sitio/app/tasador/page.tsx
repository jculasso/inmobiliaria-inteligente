import type { Metadata } from 'next';
import { Captura, CapturaPendiente } from '../../components/marco';
import { Bloque, PaginaModulo, Paso, Rol } from '../../components/pagina-modulo';

export const metadata: Metadata = {
  title: 'Tasador — Inmobiliaria Inteligente',
  description:
    'El vendedor llega a la reunión de captación con un informe fundamentado en comparables del mercado, no con una estimación de memoria.',
};

export default function Tasador() {
  return (
    <PaginaModulo
      ruta="/tasador"
      titular="Llegue a la reunión con un informe, no con una carpeta."
      bajada="La captación se gana o se pierde en la primera reunión con el propietario. El Tasador convierte esa reunión en una presentación profesional: un rango de valores fundamentado en comparables reales, en un documento que el propietario se queda."
      sale="Informe de tasación en PDF, con la marca de su inmobiliaria"
    >
      <Bloque kicker="El problema" titulo="El precio se discute de memoria, y así se pierde la autorización." fondo>
        <p>
          En la mayoría de las inmobiliarias, el valor de una propiedad sale de la experiencia del
          vendedor y de dos o tres propiedades que tiene en la cabeza. Puede estar bien. El problema
          es que <strong className="font-semibold text-ink">no se puede mostrar</strong>.
        </p>
        <p>
          El propietario que escucha un número sin respaldo hace lo previsible: llama a otras dos
          inmobiliarias y se queda con la que le dice el número más alto. Seis meses después la
          propiedad sigue publicada, ya se quemó, y hay que pedirle una baja de precio a alguien
          que no entiende por qué.
        </p>
        <p className="font-semibold text-ink">
          Una tasación fundamentada no sirve para acertar el precio. Sirve para que la conversación
          del precio la tenga usted y no el vecino.
        </p>
      </Bloque>

      <Bloque kicker="Cómo funciona" titulo="Cuatro pasos, y el informe sale solo.">
        <ol className="mt-2 list-none space-y-7 p-0">
          <Paso numero={1} titulo="Se carga la propiedad">
            <p>
              Dirección, tipo, superficie, ambientes, estado, antigüedad, amenities. Las fotos se
              suben desde el teléfono, en la misma visita.
            </p>
          </Paso>
          <Paso numero={2} titulo="Se eligen los comparables">
            <p>
              Propiedades similares del mercado, con su precio y sus metros. El sistema calcula el
              valor por metro cuadrado de cada una y le deja ajustar por las diferencias: la que
              está a estrenar, la que no tiene cochera, la que está en el contrafrente.
            </p>
          </Paso>
          <Paso numero={3} titulo="Sale el rango">
            <p>
              No un número: un rango, con el valor por metro que lo sostiene. Un rango es más
              honesto y, en la reunión, es más fácil de defender.
            </p>
          </Paso>
          <Paso numero={4} titulo="Se descarga el informe">
            <p>
              Un PDF con la marca de su inmobiliaria: la propiedad, las fotos, los comparables que
              se usaron y el rango. Se lo manda al propietario ese mismo día.
            </p>
          </Paso>
        </ol>
        <Captura
          src="/capturas/tasador-wizard.png"
          ancho={2560}
          alto={1600}
          alt="Paso 4 de 6 del Tasador: seis comparables del mercado con su precio por metro cuadrado, uno marcado como atípico, y un resumen automático con 75% de confianza."
          pie="El paso de comparables. Cada propiedad similar aporta su precio por metro cuadrado, el sistema marca los valores atípicos y calcula cuánta confianza merece el conjunto. De ahí sale el rango, y por eso se puede defender."
        />
        <CapturaPendiente archivo="tasador-informe.png"
          que="Primera página del informe en PDF: la foto de portada, los datos y el rango." />
      </Bloque>

      <Bloque kicker="Quién ve qué" titulo="Cada uno ve lo suyo, sin pedir permiso." fondo>
        <div className="mt-2">
          <Rol rol="Vendedor" ve="Sus propias tasaciones. Las carga, las edita y descarga el informe." />
          <Rol
            rol="Team leader"
            ve="Las de su equipo, para revisar un rango antes de que salga a la calle."
          />
          <Rol rol="Dirección" ve="Todas. Y qué se está tasando, que es el mejor anticipo de lo que se va a captar." />
        </div>
        <Captura
          src="/capturas/tasador-tasaciones.png"
          ancho={2560}
          alto={1600}
          alt="Listado de tasaciones con su cliente, tipo de propiedad, superficie, vendedor y estado de captación."
          pie="Todas las tasaciones de la inmobiliaria, con su estado de captación. La dirección ve cuántas se están haciendo, que es el mejor anticipo de lo que se va a captar."
        />
      </Bloque>

      <Bloque kicker="Lo que sigue" titulo="La tasación no muere en el informe.">
        <p>
          Cuando la captación se concreta, la propiedad{' '}
          <strong className="font-semibold text-ink">pasa al Protocolo 5 Semanas sin volver a
          cargar nada</strong>: los datos, las fotos y el valor ya están.
        </p>
        <p>
          Ese es el punto del sistema. Cada módulo le deja el trabajo hecho al siguiente, en vez de
          pedir la misma información tres veces.
        </p>
      </Bloque>
    </PaginaModulo>
  );
}
