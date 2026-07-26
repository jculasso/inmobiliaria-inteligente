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
            Tocá <strong>Activar acceso</strong> y escribí vos la contraseña temporal.
          </p>
          <p>
            El detalle está en la sección de abajo: conviene leerla antes de activar a quince personas
            seguidas.
          </p>
        </Paso>

        <Paso n={4} titulo="Cargar los objetivos del año">
          <p>
            Desde el Tablero Comercial, en <strong>Vendedores</strong>. Sin objetivos cargados, el
            seguimiento del año queda vacío y el tablero pierde la mitad de su sentido.
          </p>
        </Paso>
      </Seccion>

      <Seccion titulo="Contraseñas: cómo funciona hoy">
        <Aviso tono="atencion" titulo="La contraseña temporal la escribís vos, no la genera el sistema">
          <p>
            Tanto al <strong>activar acceso</strong> como al <strong>restablecer</strong>, el panel te pide
            que escribas la contraseña. Mínimo <strong>8 caracteres</strong>. El campo se muestra en texto
            visible a propósito, para que puedas leerla o dictarla sin equivocarte.
          </p>
          <p>
            <strong>No uses la misma para todo el equipo.</strong> Si activás quince personas con la misma
            clave, cualquiera que la conozca entra como cualquier otro hasta que cada uno la cambie — y
            alguno va a tardar días.
          </p>
        </Aviso>

        <Tarjeta titulo="Qué pasa después, automáticamente">
          <p>
            Al activar o restablecer, el usuario queda marcado como <strong>“debe cambiar la contraseña”</strong>.
            La próxima vez que entre, la plataforma lo lleva a elegir una propia y{' '}
            <strong>no lo deja usar ningún módulo hasta que lo haga</strong>. No es un cartel que se pueda
            saltear.
          </p>
          <p>
            Una vez que eligió la suya, vos ya no la sabés ni la podés ver. Si la olvida, la única salida
            desde el panel es <strong>Restablecer contraseña</strong>, que arranca el circuito de nuevo.
          </p>
        </Tarjeta>

        <Tarjeta titulo="“¿Olvidaste tu contraseña?” de la pantalla de ingreso">
          <p>
            Ese enlace existe, pero hoy <strong>no manda ningún correo</strong>: le explica a la persona que
            tiene que pedirle el restablecimiento a quien administra la plataforma. Es a propósito, no es
            un error.
          </p>
          <p>
            El recupero por correo <strong>está construido y apagado</strong>. Para encenderlo hacen falta
            dos cosas: configurar el envío de correo en Supabase y prender la variable{' '}
            <code className="rounded bg-surface px-1 py-0.5 text-[11px]">NEXT_PUBLIC_RECUPERO_POR_EMAIL</code>.
            Sin lo primero, prender lo segundo deja a la gente esperando un correo que nunca llega.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Cómo conviene manejarlo en la práctica">
          <p>
            <strong>Una contraseña distinta por persona</strong>, aunque sea sencilla — se va a usar una
            sola vez.
          </p>
          <p>
            <strong>Activá el acceso con la persona presente</strong>, o justo antes de la reunión de
            onboarding. Que entre y elija la suya en el momento; así no queda una clave temporal dando
            vueltas por semanas.
          </p>
          <p>
            <strong>Mandala por un canal directo</strong> y no en un grupo. Con que la persona la cambie en
            el primer ingreso, deja de servirle a nadie.
          </p>
        </Tarjeta>
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
            Si <strong>nunca entró</strong>, fijate que el usuario no figure “Sin acceso”: sin activarlo no
            existe la cuenta todavía.
          </p>
          <p>
            Si <strong>ya había entrado</strong>, usá <strong>Restablecer contraseña</strong>: escribís una
            nueva temporal y el sistema vuelve a exigirle que elija la suya al ingresar.
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
