import { Aviso, DocHeader, Paso, Seccion, Tarjeta } from '../../../components/admin/doc-ui';
import { FlujoTasacionProtocolo } from '../../../components/admin/flujo-tasacion-protocolo';

export const metadata = { title: 'Onboarding · Administración' };

/**
 * Material para presentarle la plataforma al equipo de una inmobiliaria.
 *
 * Está escrito para leerse EN VOZ ALTA en la primera reunión, no para que el
 * vendedor lo lea solo: el orden es el de la charla, y cada módulo arranca por
 * el problema que le resuelve a esa persona, no por la lista de funciones.
 */
export default function OnboardingPage() {
  return (
    <>
      <DocHeader
        titulo="Onboarding del equipo"
        bajada="Guion para la primera reunión con una inmobiliaria. Media hora alcanza. El orden importa: cada módulo se presenta por el problema que resuelve, no por lo que hace."
      />

      <Aviso tono="atencion" titulo="La regla de oro de esta reunión">
        <p>
          Nadie adopta un sistema porque tenga funciones. Lo adopta cuando le saca un trabajo de encima.
          Mostrá primero <strong>el informe que el cliente recibe</strong>: es lo único que un vendedor
          reconoce al instante como algo que hoy no puede dar.
        </p>
      </Aviso>

      <Seccion titulo="Cómo abrir">
        <Paso n={1} titulo="Empezá por el final: mostrá el informe">
          <p>
            Abrí un informe de tasación ya hecho y otro de protocolo. Dejalos en pantalla unos segundos
            sin explicar nada.
          </p>
          <p>
            La pregunta que aparece sola es <em>“¿esto se lo puedo dejar al cliente?”</em>. Ahí ya
            ganaste la reunión; todo lo demás es explicar cómo se llega.
          </p>
        </Paso>

        <Paso n={2} titulo="Después mostrá que cada uno ve lo suyo">
          <p>
            Entrá con un vendedor y después con dirección, en la misma pantalla. Que vean con sus ojos que
            el vendedor no ve los números del resto.
          </p>
          <p>
            Es la objeción número uno en un equipo, y se responde mucho mejor mostrando que explicando.
          </p>
        </Paso>

        <Paso n={3} titulo="Recién ahí, el recorrido de los módulos">
          <p>Con el porqué ya instalado, el cómo se entiende en diez minutos.</p>
        </Paso>
      </Seccion>

      <Seccion titulo="Cómo se conectan el Tasador y el Protocolo">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">
          Es la pregunta que aparece sola: “¿y esto con lo otro cómo se conecta?”. Mostrá este recorrido
          antes de entrar en cada módulo — con el camino claro, lo demás se entiende en la mitad de
          tiempo.
        </p>
        <FlujoTasacionProtocolo />
      </Seccion>

      <Seccion titulo="Qué decir de cada módulo">
        <Tarjeta titulo="Tasador · “dejá de tirar un número al aire”">
          <p>
            <strong>El problema:</strong> la pregunta más importante del negocio —cuánto vale— hoy se
            contesta de memoria y sin respaldo.
          </p>
          <p>
            <strong>Qué hace:</strong> cargás la propiedad y comparables reales, y el sistema propone un
            rango: mínimo, recomendado y aspiracional. Sale un informe con la marca de la inmobiliaria.
          </p>
          <p>
            <strong>Qué mostrar:</strong> cargá un comparable en vivo y que vean cómo se mueve la
            referencia.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Protocolo de 5 semanas · “el método deja de vivir en la cabeza de cada uno”">
          <p>
            <strong>El problema:</strong> a las tres semanas nadie se acuerda de qué se hizo con una
            propiedad, y el propietario llama a preguntar.
          </p>
          <p>
            <strong>Qué hace:</strong> desde la exclusividad, marca qué corresponde cada semana y quién lo
            hizo. Al final sale el informe para el propietario.
          </p>
          <p>
            <strong>Qué mostrar:</strong> marcá una acción como hecha y que vean que el avance se mueve
            solo.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Tablero Comercial · “nadie más pide un número por mensaje”">
          <p>
            <strong>El problema:</strong> los números se arman a mano, tarde y distinto según quién los
            arme.
          </p>
          <p>
            <strong>Qué hace:</strong> volumen, comisiones, puntas y ranking salen de las operaciones
            cargadas. Cada rol ve su altura.
          </p>
          <p>
            <strong>Qué mostrar:</strong> tocá un número del tablero y que vean aparecer las operaciones
            que hay detrás.
          </p>
        </Tarjeta>

        <Tarjeta titulo="To Do List · “tu agenda, sin cargar nada dos veces”">
          <p>
            <strong>Qué hace:</strong> muestra el calendario de Google de cada uno, de solo lectura. No
            modifica nada de la agenda.
          </p>
          <p>
            <strong>Aclará siempre:</strong> cada persona ve <strong>únicamente su propio calendario</strong>,
            y hay que conectarlo una vez desde el módulo.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Cerrar la reunión">
        <Paso n={1} titulo="Que entren desde el teléfono, ahí mismo">
          <p>
            Que abran la dirección en el teléfono e instalen la aplicación antes de irse. El que sale de
            la reunión sin instalarla, no la instala.
          </p>
          <p>
            En Android es un botón. En iPhone hay que hacerlo a mano desde Safari: <strong>Compartir →
            Agregar a inicio</strong>, y solo funciona desde Safari.
          </p>
        </Paso>

        <Paso n={2} titulo="Que cada uno cambie su clave delante tuyo">
          <p>
            Entran con la clave temporal y eligen la propia. Si no lo hacen en la reunión, la semana
            siguiente vas a estar restableciendo claves de a una.
          </p>
        </Paso>

        <Paso n={3} titulo="Dejá una sola tarea para la primera semana">
          <p>
            <strong>Cargar las operaciones del mes.</strong> Nada más. Un tablero vacío no convence a
            nadie, y con un mes cargado el equipo ve por primera vez su propio ranking.
          </p>
        </Paso>
      </Seccion>

      <Seccion titulo="Preguntas que siempre aparecen">
        <Tarjeta titulo="“¿Mis compañeros van a ver mis operaciones?”">
          <p>
            Un vendedor ve solo lo suyo. El líder ve su equipo; dirección ve todo. Es la pregunta más
            frecuente y conviene contestarla mostrando, no afirmando.
          </p>
        </Tarjeta>
        <Tarjeta titulo="“¿Ocupa lugar en el teléfono?”">
          <p>No descarga nada: es la misma plataforma, y las actualizaciones llegan solas.</p>
        </Tarjeta>
        <Tarjeta titulo="“¿Y si me equivoco al cargar algo?”">
          <p>
            Las <strong>tasaciones</strong> las corregís vos mismo. Las <strong>ventas y alquileres</strong>{' '}
            los carga la inmobiliaria —dirección o el administrador—, así que un error ahí se avisa y se
            corrige en el momento.
          </p>
          <p>
            Antes de borrar cualquier cosa, el sistema muestra exactamente qué se va a borrar.
          </p>
        </Tarjeta>
      </Seccion>
    </>
  );
}
