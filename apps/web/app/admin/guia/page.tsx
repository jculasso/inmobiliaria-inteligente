import { Aviso, DocHeader, Paso, Seccion, Tarjeta } from '../../../components/admin/doc-ui';

export const metadata = { title: 'Guía del implementador · Administración' };

/**
 * Manual de quien da de alta inmobiliarias y usuarios.
 *
 * Vive acá dentro y no en un PDF a propósito: un manual suelto queda
 * desactualizado sin que nadie se entere, y este cambia cada vez que se toca el
 * panel. Acá está al lado de las pantallas que explica.
 */
export default function GuiaPage() {
  return (
    <>
      <DocHeader
        titulo="Guía del implementador"
        bajada="Cómo dar de alta una inmobiliaria y dejar a su equipo trabajando. Seguí los pasos en orden: cada uno depende del anterior."
      />

      <Seccion titulo="Alta de una inmobiliaria nueva">
        <Paso n={1} titulo="Crear la inmobiliaria">
          <p>
            En <strong>Inmobiliarias → Nueva inmobiliaria</strong>. El <em>slug</em> es el identificador
            interno, en minúsculas y sin espacios (por ejemplo <code>vacker</code>): no se muestra a los
            usuarios pero no conviene cambiarlo después.
          </p>
          <p>
            Marcá <strong>solo los módulos contratados</strong>. Lo que no marques no aparece, y si alguien
            intenta entrar por la dirección directa, el servidor lo rechaza.
          </p>
        </Paso>

        <Paso n={2} titulo="Crear los usuarios">
          <p>
            Entrá a la inmobiliaria y usá <strong>Nuevo usuario</strong>. Nombre, correo y roles. El
            teléfono es opcional pero aparece en el informe de tasación, así que conviene cargarlo.
          </p>
        </Paso>

        <Paso n={3} titulo="Activar el acceso">
          <p>
            Crear el usuario <strong>no le da acceso todavía</strong>: queda con la marca “Sin acceso”.
            Tocá <strong>Activar acceso</strong> y el sistema genera una clave temporal al azar.
          </p>
          <p>
            Pasale esa clave a la persona. La primera vez que entre, la plataforma le va a exigir elegir
            una propia; hasta que lo haga no puede usar ningún módulo.
          </p>
        </Paso>

        <Paso n={4} titulo="Cargar los objetivos del año">
          <p>
            Desde el Tablero Comercial, en <strong>Vendedores</strong>. Sin objetivos cargados, el
            seguimiento del año queda vacío y el tablero pierde la mitad de su sentido.
          </p>
        </Paso>
      </Seccion>

      <Seccion titulo="Los cuatro roles">
        <div className="grid gap-3 sm:grid-cols-2">
          <Tarjeta titulo="Vendedor">
            <p>Ve y carga lo suyo. No ve el equipo ni la inmobiliaria completa.</p>
          </Tarjeta>
          <Tarjeta titulo="Team Leader">
            <p>Ve lo suyo y lo de su equipo. Puede borrar operaciones y tasaciones.</p>
          </Tarjeta>
          <Tarjeta titulo="Dirección">
            <p>Ve toda la inmobiliaria y gestiona vendedores y objetivos.</p>
          </Tarjeta>
          <Tarjeta titulo="Admin de la inmobiliaria">
            <p>Como dirección, más la administración interna de su propia inmobiliaria.</p>
          </Tarjeta>
        </div>
        <Aviso tono="atencion" titulo="El rol decide qué se puede borrar">
          <p>
            Un <strong>vendedor no puede borrar</strong> operaciones ni tasaciones — no le aparece el
            botón. Si alguien te dice que “no le figura Borrar”, casi siempre es esto y no un error.
          </p>
        </Aviso>
      </Seccion>

      <Seccion titulo="Problemas frecuentes">
        <Aviso tono="peligro" titulo="Nunca cambies un correo directamente en la base de datos">
          <p>
            El correo vive en <strong>dos lugares</strong>: la tabla de usuarios y el sistema de
            identidad. Si cambiás solo uno, la persona queda sin poder entrar y el problema es difícil de
            ver.
          </p>
          <p>
            Cambialo siempre <strong>desde la aplicación</strong> —el panel o la edición de vendedores—,
            que actualiza los dos.
          </p>
        </Aviso>

        <Tarjeta titulo="“Entré pero no veo ningún módulo”">
          <p>
            La inmobiliaria no tiene módulos marcados, o el usuario no tiene rol. Revisá los dos: el
            módulo se habilita en la inmobiliaria y el rol en el usuario.
          </p>
        </Tarjeta>

        <Tarjeta titulo="“No puedo entrar con mi clave”">
          <p>
            Si nunca entró, fijate que el usuario no figure <strong>Sin acceso</strong>. Si ya había
            entrado, usá <strong>Restablecer contraseña</strong>: genera una nueva temporal y vuelve a
            pedirle que elija la suya.
          </p>
        </Tarjeta>

        <Tarjeta titulo="“La primera vez del día tarda un montón”">
          <p>
            Es el servidor despertándose: hoy se apaga por inactividad y el primer pedido tarda entre 30 y
            60 segundos. No es un error ni algo que se pueda arreglar del panel; se resuelve pagando el
            plan del servidor (ver <strong>Inversión</strong>).
          </p>
        </Tarjeta>

        <Tarjeta titulo="El módulo Protocolo no aparece">
          <p>
            Nace apagado en toda inmobiliaria nueva. Se habilita marcándolo en la ficha de la
            inmobiliaria.
          </p>
        </Tarjeta>
      </Seccion>

      <Seccion titulo="Antes de dar por terminada un alta">
        <Tarjeta>
          <p>Entrá con un usuario de prueba de esa inmobiliaria y comprobá que:</p>
          <p>· Ve exactamente los módulos contratados, ni más ni menos.</p>
          <p>· Le pide cambiar la clave la primera vez.</p>
          <p>· El logo y el nombre que se ven arriba son los correctos.</p>
          <p>· Un vendedor no ve datos de otro vendedor.</p>
        </Tarjeta>
      </Seccion>
    </>
  );
}
