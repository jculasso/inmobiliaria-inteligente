import type { Metadata } from 'next';
import { CapturaPendiente } from '../../components/marco';
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
        <CapturaPendiente archivo="protocolo-ficha.png"
          que="La ficha de ALSINA 3841 (Nicolás Vera): 23 días, 10 acciones hechas y 6 atrasadas. Es la que mejor muestra las dos cosas a la vez — el método avanzando y el sistema levantando la mano. Escritorio a 1280px." />
        <CapturaPendiente archivo="protocolo-ficha-telefono.png"
          que="La misma ficha desde el celular. Es donde el vendedor la usa de verdad." />
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
        <CapturaPendiente archivo="protocolo-correo-lunes.png"
          que="El correo de los lunes como llega al celular. Si no tenés uno a mano, se genera a pedido desde el Protocolo." />
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
