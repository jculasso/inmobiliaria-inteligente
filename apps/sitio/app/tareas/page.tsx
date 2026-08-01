import type { Metadata } from 'next';
import { CapturaPendiente } from '../../components/marco';
import { Bloque, PaginaModulo, Paso, Rol } from '../../components/pagina-modulo';

export const metadata: Metadata = {
  title: 'To Do List — Inmobiliaria Inteligente',
  description:
    'Las tareas del equipo, sincronizadas con el calendario que ya usan. Sin pedirle a nadie que aprenda una aplicación más.',
};

export default function Tareas() {
  return (
    <PaginaModulo
      ruta="/tareas"
      titular="Lo que hay que hacer, donde ya lo está mirando."
      bajada="Las tareas del equipo viven en el sistema y aparecen en el calendario que cada uno ya tiene abierto en el teléfono. Nadie tiene que acordarse de entrar a un lugar más."
      sale="La agenda de la semana, sin una aplicación nueva"
    >
      <Bloque kicker="El problema" titulo="La quinta aplicación no la abre nadie." fondo>
        <p>
          Un vendedor ya tiene el CRM, el WhatsApp, el correo y el calendario del teléfono. Cuando
          se le suma una herramienta de tareas, la usa dos semanas por compromiso y después vuelve
          a la libreta.
        </p>
        <p>
          Y no es falta de voluntad: es que la información importante ya está repartida en cuatro
          lados, y el que agrega el quinto es el que pierde.
        </p>
        <p className="font-semibold text-ink">
          La única lista de tareas que se usa es la que está donde la persona ya mira.
        </p>
      </Bloque>

      <Bloque kicker="Cómo funciona" titulo="El sistema escribe en el calendario que ya usan.">
        <ol className="mt-2 list-none space-y-7 p-0">
          <Paso numero={1} titulo="La tarea se crea donde nació">
            <p>
              Desde la ficha de una propiedad, desde una tasación o a mano. Con responsable y
              fecha.
            </p>
          </Paso>
          <Paso numero={2} titulo="Aparece en el calendario de esa persona">
            <p>
              Sincronizada con Google Calendar. La ve en el teléfono, junto a las visitas y las
              reuniones, sin abrir nada nuestro.
            </p>
          </Paso>
          <Paso numero={3} titulo="Se cierra desde cualquiera de los dos lados">
            <p>
              Lo que cambia en un lado se refleja en el otro. Una tarea que hay que marcar dos
              veces se termina marcando cero.
            </p>
          </Paso>
        </ol>
        <CapturaPendiente que="Lista de tareas de la semana en el sistema — inmobiliaria de demostración. Escritorio, 1280px." />
        <CapturaPendiente que="Las mismas tareas vistas en el calendario del teléfono." />
      </Bloque>

      <Bloque kicker="Quién ve qué" titulo="Cada uno ve lo suyo, sin pedir permiso." fondo>
        <div className="mt-2">
          <Rol rol="Vendedor" ve="Sus tareas, en el sistema y en su calendario." />
          <Rol rol="Team leader" ve="Las de su equipo, y qué quedó sin hacer." />
          <Rol rol="Dirección" ve="Todas, cuando quiere mirar." />
        </div>
      </Bloque>

      <Bloque kicker="Con franqueza" titulo="Este es el módulo más simple de los cuatro.">
        <p>
          No va a comprar el sistema por la lista de tareas. Está porque el ciclo lo pedía: el
          Protocolo genera trabajo con fecha, y ese trabajo tiene que terminar en algún lado donde
          la persona lo vea.
        </p>
        <p>
          Preferimos decirlo así y no inflarlo. Lo que sostiene el sistema es lo otro.
        </p>
      </Bloque>
    </PaginaModulo>
  );
}
