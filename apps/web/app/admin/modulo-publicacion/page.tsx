import { Aviso, DocHeader, Paso, Seccion, Tarjeta } from '../../../components/admin/doc-ui';
import { FlujoPublicacionTokko } from '../../../components/admin/flujo-publicacion-tokko';

export const metadata = { title: 'Módulo de publicación · Administración' };

/**
 * Alcance del primer módulo de integración con Tokko, para presentar a la
 * dirección de Vacker.
 *
 * Es un documento de DECISIÓN, no de documentación: está para leerlo en una
 * reunión y salir con un sí o un no. Por eso dice con la misma claridad qué
 * incluye y qué no — un alcance que solo enumera lo bueno no se puede aprobar,
 * porque nadie sabe qué está aprobando.
 *
 * Los números del caso de negocio quedan EN BLANCO a propósito: los completa
 * Vacker en la reunión. Una estimación inventada de nuestro lado sería lo
 * primero que alguien discute, y discutiría con razón.
 */

const PREPARADO = 'Julio de 2026';

export default function ModuloPublicacionPage() {
  return (
    <>
      <DocHeader
        titulo="Módulo 1 · Ficha de propiedad y publicación en Tokko"
        bajada={`Propuesta de alcance para Vacker Negocios Inmobiliarios · ${PREPARADO}. Qué se construye, qué no, qué hace falta de su lado y cómo se mide si funcionó.`}
      />

      <Seccion titulo="El problema, en una frase">
        <Tarjeta>
          <p>
            La propiedad se carga <strong>dos veces</strong>. Una en el sistema, cuando se la tasa y se
            la capta. Otra en Tokko, cuando hay que publicarla — y esa segunda carga la hace a mano una
            persona del equipo administrativo.
          </p>
          <p>
            Los datos son casi los mismos. Lo que cambia es quién los escribe y en qué pantalla.
          </p>
        </Tarjeta>

        <Aviso tono="atencion" titulo="Estos números los completa Vacker en la reunión">
          <p>
            No los estimamos nosotros a propósito: es su operación, y el caso de negocio tiene que
            cerrar con sus datos, no con los nuestros.
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>¿Cuántas propiedades se publican por semana?</li>
            <li>¿Cuánto lleva cargar una en Tokko, de punta a punta?</li>
            <li>¿Cuántas veces hay que volver a entrar a corregir o actualizar algo?</li>
          </ul>
          <p>
            Con esas tres respuestas queda claro en dos minutos si el módulo se paga solo o no.
          </p>
        </Aviso>
      </Seccion>

      <Seccion titulo="Cómo quedaría el circuito">
        <FlujoPublicacionTokko />
      </Seccion>

      <Seccion titulo="Qué se construye">
        <Paso n={1} titulo="La ficha de propiedad">
          <p>
            Una ficha nueva que <strong>nace precargada</strong> desde la tasación: tipo, superficies,
            ambientes, dormitorios, baños, antigüedad, estado, orientación, amenities, barrio y ciudad ya
            vienen puestos. Nadie los vuelve a escribir.
          </p>
          <p>
            Se completa lo que hoy no existe en el sistema y sí hace falta para publicar:{' '}
            <strong>descripción de venta, expensas, disponibilidad, qué fotos salen y en qué orden</strong>.
          </p>
        </Paso>

        <Paso n={2} titulo="La publicación automática">
          <p>
            El sistema expone el listado de propiedades publicables en el formato que Tokko espera, y
            Tokko lo va a buscar por su cuenta. No hay que apretar nada ni copiar nada.
          </p>
          <p>
            Se publica <strong>solo lo que se marcó como publicable</strong>. Los datos del propietario
            —nombre, teléfono, mail— nunca salen del sistema.
          </p>
        </Paso>

        <Paso n={3} titulo="El estado “Publicada en Tokko”">
          <p>
            La propiedad muestra si está publicada y desde cuándo. Deja de ser algo que alguien recuerda
            o anota aparte.
          </p>
        </Paso>

        <Paso n={4} titulo="La acción del protocolo se marca sola">
          <p>
            <strong>Publicación en portales</strong>, de la semana 1, queda registrada con su fecha real
            cuando la publicación se confirma. Una tarea menos que tildar a mano, y una fecha que ya no
            depende de la memoria de nadie.
          </p>
        </Paso>
      </Seccion>

      <Seccion titulo="Qué NO incluye este módulo">
        <Aviso tono="peligro" titulo="Un alcance que solo dice lo que sí hace no se puede aprobar">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong>No publica en los portales.</strong> Zonaprop, Argenprop y MercadoLibre los sigue
              manejando Tokko, exactamente como hoy.
            </li>
            <li>
              <strong>No reemplaza a Tokko</strong> ni propone dejar de pagarlo.
            </li>
            <li>
              <strong>No incluye sitio web propio de la inmobiliaria.</strong> Es un módulo aparte, con
              su propia decisión.
            </li>
            <li>
              <strong>No incluye gestión de contactos</strong> —consultas por web, mail o WhatsApp—. Ese
              es el módulo 2 y es bastante más grande que este.
            </li>
          </ul>
        </Aviso>
      </Seccion>

      <Seccion titulo="Reposicionamiento en portales (semana 4)">
        <Tarjeta>
          <p>
            El reposicionamiento propiamente dicho —subir la propiedad en el listado de un portal— lo
            resuelve Tokko, y ahí no nos metemos.
          </p>
          <p>Lo que sí puede aportar este módulo, sin depender de nadie:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Avisar cuándo conviene reposicionar</strong>: tantos días publicada con pocas
              consultas es exactamente el dato que ya vive en el protocolo.
            </li>
            <li>
              <strong>Actualizar el precio publicado</strong> desde la ficha, para que el cambio viaje a
              Tokko en la siguiente pasada en vez de retocarse en los dos lados.
            </li>
          </ul>
          <p className="font-semibold text-ink">
            Esto queda como segunda etapa, después de que la publicación básica funcione.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Qué necesitamos de Vacker">
        <Tarjeta titulo="1 · La clave de API de Tokko">
          <p>
            La saca un administrador desde Tokko, en <strong>MI EMPRESA → PERMISOS</strong>. Es privada
            de la inmobiliaria y sin ella no hay integración posible.
          </p>
        </Tarjeta>
        <Tarjeta titulo="2 · Una hora con la persona que carga las propiedades">
          <p>
            Es lo más valioso de todo. Necesitamos verla cargar una propiedad real de principio a fin:
            qué datos junta, de dónde los saca, qué campos de Tokko completa y cuáles deja vacíos.
          </p>
          <p>
            Sin eso, el módulo se construye sobre lo que suponemos que hace, y siempre falta algo.
          </p>
        </Tarjeta>
        <Tarjeta titulo="3 · Una propiedad de prueba en Tokko">
          <p>
            Para publicar contra ella sin tocar las que están al aire.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Los riesgos, dichos de frente">
        <Tarjeta titulo="El trabajo real no es la integración, es la traducción">
          <p>
            Conectarse a Tokko es lo fácil. Lo que lleva tiempo es que <strong>sus catálogos y los
            nuestros coincidan</strong>: tipos de propiedad, ubicaciones, características. Cada valor
            nuestro tiene que corresponder a uno de ellos, y esa tabla se arma a mano una vez.
          </p>
        </Tarjeta>
        <Tarjeta titulo="Dependemos de que Tokko mantenga su interfaz">
          <p>
            Es una integración con un tercero. Si Tokko cambia su formato, hay que acompañarlo. Es el
            costo normal de integrarse, pero conviene decirlo antes y no después.
          </p>
        </Tarjeta>
        <Tarjeta titulo="El servidor tiene que estar despierto cuando Tokko pase a buscar">
          <p>
            Hoy la API está en un plan gratuito que se duerme por inactividad. Si Tokko consulta en ese
            momento, la publicación de esa pasada falla y se reintenta más tarde.
          </p>
          <p>
            No frena el módulo, pero es una razón más —además de las copias de seguridad— para cerrar el
            plan pago de infraestructura antes de ponerlo en producción.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Cómo sabremos si funcionó">
        <Aviso tono="ok" titulo="Tres señales, todas verificables">
          <ul className="ml-4 list-disc space-y-1.5">
            <li>
              <strong>Nadie vuelve a tipear una propiedad en Tokko.</strong> Es la señal principal y no
              admite matices: o pasa o no pasa.
            </li>
            <li>
              <strong>El tiempo por propiedad</strong> del equipo administrativo, medido antes y después
              con los números que Vacker aporte en esta reunión.
            </li>
            <li>
              <strong>La acción de publicación de la semana 1</strong> deja de marcarse a mano en todos
              los protocolos nuevos.
            </li>
          </ul>
        </Aviso>
      </Seccion>

      <Seccion titulo="La decisión de fondo">
        <Tarjeta>
          <p>
            Hay una pregunta que conviene contestar en esta reunión y no más adelante:{' '}
            <strong>¿dónde vive el dato de la propiedad?</strong>
          </p>
          <p>
            Esta propuesta asume que vive <strong>en el sistema de la inmobiliaria</strong>, y que Tokko
            es el canal hacia los portales. Es lo que hace que la información sea de Vacker y que
            mañana se pueda publicar en otro lado sin volver a cargar nada.
          </p>
          <p>
            La alternativa —que el dato viva en Tokko y nosotros lo leamos— también funciona y es más
            corta de construir, pero deja la información del negocio en manos de un proveedor.
          </p>
        </Tarjeta>
      </Seccion>
    </>
  );
}
