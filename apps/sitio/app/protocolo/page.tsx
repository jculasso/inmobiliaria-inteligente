import type { Metadata } from 'next';
import { Captura, CapturaPendiente } from '../../components/marco';
import { Bloque, PaginaModulo, Paso, Rol } from '../../components/pagina-modulo';

export const metadata: Metadata = {
  title: 'Protocolo 5 Semanas — Inmobiliaria Inteligente',
  description:
    'Veintinueve acciones concretas sobre cada propiedad captada, repartidas en cinco semanas. El sistema avisa qué se atrasó, y sale el informe con el que se renueva la autorización.',
};

export default function Protocolo() {
  return (
    <PaginaModulo
      ruta="/protocolo"
      titular="Lo que distingue a una inmobiliaria que trabaja de una que espera."
      bajada="Captada la propiedad, empieza un procedimiento de cinco semanas con veintinueve acciones concretas. No es una lista de buenas intenciones: cada acción tiene semana, responsable y fecha, y el sistema avisa cuando algo no se hizo."
      sale="Informe de gestión para el propietario — con esto se renueva la autorización"
    >
      <Bloque
        kicker="El problema"
        titulo="La propiedad se capta con entusiasmo y a la tercera semana nadie se acuerda."
        fondo
      >
        <p>
          La semana uno siempre se cumple: fotos, publicación, cartel. La tres y la cuatro son otra
          cosa. Nadie decidió abandonar la propiedad — simplemente entraron captaciones nuevas, y
          las nuevas siempre ganan.
        </p>
        <p>
          El costo aparece a los seis meses, cuando el propietario pregunta qué se hizo y la
          respuesta honesta es <em>no me acuerdo</em>. Ahí se pierde la renovación, o se renueva
          bajando el precio, que es la misma pérdida con otro nombre.
        </p>
        <p className="font-semibold text-ink">
          Todas las inmobiliarias saben qué hay que hacer. Muy pocas pueden demostrar que lo
          hicieron.
        </p>
      </Bloque>

      <Bloque kicker="Cómo funciona" titulo="Cinco semanas, veintinueve acciones, ninguna ambigüedad.">
        <ol className="mt-2 list-none space-y-7 p-0">
          <Paso numero={1} titulo="La propiedad entra con su protocolo armado">
            <p>
              Al captarse, se le crea el procedimiento completo: documentación, producción
              fotográfica, publicación, difusión, seguimiento de consultas, informe al propietario,
              revisión de precio. Cada acción con su semana.
            </p>
          </Paso>
          <Paso numero={2} titulo="El vendedor va marcando">
            <p>
              Desde el teléfono, en la calle. Cada acción se marca hecha, se posterga con motivo o
              se declara que no corresponde — porque no todas las propiedades necesitan todo, y
              obligar a mentir para poder avanzar es la forma más rápida de que nadie use el
              sistema.
            </p>
          </Paso>
          <Paso numero={3} titulo="El sistema levanta la mano">
            <p>
              Una acción vencida, una semana que quedó atrás sin cerrar, una autorización por
              caducar, una propiedad sin movimiento. Las alertas no son un adorno: son el motivo
              por el que existe el módulo.
            </p>
          </Paso>
          <Paso numero={4} titulo="Sale el informe de gestión">
            <p>
              Un documento que muestra, semana por semana, todo lo que se hizo sobre la propiedad.
              Es la herramienta más subestimada del negocio inmobiliario:{' '}
              <strong className="font-semibold text-ink">
                es con lo que se renueva una autorización sin bajar el precio
              </strong>
              .
            </p>
          </Paso>
        </ol>
        <p className="mt-8">
          En la semana 2 la propiedad sale a los portales.{' '}
          <strong className="font-semibold text-ink">Eso lo hace su CRM</strong> — hoy, en las
          inmobiliarias con las que trabajamos, Tokko Broker: es el que publica en Zonaprop, Mercado
          Libre y Argenprop. Nosotros nos conectamos con Tokko y traemos la propiedad de vuelta con
          sus fotos, su precio y el vendedor que la captó, para que el protocolo arranque sin volver
          a cargar nada.
        </p>
        <Captura
          src="/capturas/protocolo-ficha.png"
          ancho={2560}
          alto={1600}
          alt="Ficha de la propiedad Alsina 3841 en semana 4 de 5, con tres alertas: seis acciones atrasadas, la autorización venciendo en tres días y doce días sin movimiento."
          pie="Una propiedad en la semana 4. El sistema no espera a que alguien pregunte: avisa que hay seis acciones vencidas, que la autorización cae en tres días y que hace doce que no se registra un avance."
        />
        <Captura
          src="/capturas/protocolo-ficha-telefono.png"
          ancho={750}
          alto={1624}
          alt="La misma ficha vista en un teléfono, con la tira de cinco semanas y las alertas."
          pie="La misma pantalla en el teléfono. Es donde el vendedor la usa: en la calle, entre visita y visita."
          telefono
        />
        <CapturaPendiente archivo="protocolo-informe.png"
          que="Informe de gestión en PDF — la página del detalle semana por semana. Sale de Belgrano 2087, que tiene 27 acciones hechas y se ve lleno." />
      </Bloque>

      <Bloque kicker="Los lunes" titulo="La dirección se entera sin entrar al sistema." fondo>
        <p>
          Todos los lunes a la mañana llega un correo con las propiedades que necesitan atención,
          agrupadas por vendedor: qué se atrasó, qué autorización está por vencer, qué protocolo
          terminó las cinco semanas y quedó listo para revisar.
        </p>
        <p>
          Si no hay nada urgente, el correo lo dice en una línea. Un reporte que siempre alarma deja
          de leerse a la tercera semana.
        </p>
        <Captura
          src="/capturas/protocolo-correo-lunes.png"
          ancho={750}
          alto={1624}
          alt="El reporte semanal del Protocolo visto en un teléfono, con las propiedades que necesitan atención agrupadas por vendedor."
          pie="Lo que llega el lunes a la mañana, agrupado por vendedor. Si no hay nada urgente, lo dice en una línea: un reporte que siempre alarma deja de leerse."
          telefono
        />
      </Bloque>

      <Bloque kicker="La cartera entera" titulo="Y en una pantalla, todo lo que está en la calle.">
        <p>
          Cuántas propiedades están en comercialización, cuáles tienen atrasos, cuánto avanzó el
          promedio, y cuáles se captaron pero todavía no arrancaron.
        </p>
        <Captura
          src="/capturas/protocolo-panel.png"
          ancho={2560}
          alto={1600}
          alt="Panel del Protocolo: cuatro propiedades en comercialización, dos con alertas críticas, 41% de avance promedio y tres captadas sin iniciar."
          pie="El panel de la dirección. Cuatro propiedades en comercialización, dos con atrasos, y tres captadas que todavía no arrancaron su protocolo."
        />
      </Bloque>

      <Bloque kicker="Quién ve qué" titulo="Cada uno ve lo suyo, sin pedir permiso.">
        <div className="mt-2">
          <Rol rol="Vendedor" ve="Sus propiedades y lo que tiene que hacer esta semana." />
          <Rol rol="Team leader" ve="Las de su equipo, y quién viene arrastrando pendientes." />
          <Rol
            rol="Dirección"
            ve="Todas, más el correo de los lunes. Sin pedirle un informe a nadie."
          />
        </div>
      </Bloque>
    </PaginaModulo>
  );
}
