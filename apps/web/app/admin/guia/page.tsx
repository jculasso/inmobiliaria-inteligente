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

      <Seccion titulo="Revisar los datos antes de dar por abierta la inmobiliaria">
        <Aviso tono="peligro" titulo="Este paso decide si el equipo confía en el sistema o no">
          <p>
            El primer día, el equipo va a mirar el tablero y compararlo con lo que ellos saben. Si los
            números no cierran, no van a pensar “falta depurar”: van a pensar{' '}
            <strong>“esto no sirve”</strong>. Y esa impresión no se recupera.
          </p>
          <p>
            Recorré las tres listas <strong>antes</strong> de la reunión de onboarding, no después.
          </p>
        </Aviso>

        <Tarjeta titulo="Ventas y Alquileres">
          <p>
            <strong>Datos de prueba.</strong> Buscá <em>test</em>, <em>prueba</em>, <em>asd</em> y
            direcciones sin sentido. Suelen quedar de las pruebas de carga y son lo primero que salta a la
            vista.
          </p>
          <p>
            <strong>Precios o comisiones en cero.</strong> Una operación en 0 no rompe nada, pero baja el
            ticket promedio y ensucia el ranking.
          </p>
          <p>
            <strong>Operaciones sin punta asignada.</strong> Si no tiene vendedor, no le suma a nadie: no
            aparece en el ranking ni en el seguimiento de objetivos.
          </p>
          <p>
            <strong>Estado contra fecha de firma.</strong> Una escriturada sin fecha de firma, o una
            señada con fecha de firma, casi siempre es un error de carga.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Tasaciones">
          <p>
            <strong>Cliente o dirección sin sentido</strong>, y <strong>valor recomendado en cero</strong>.
          </p>
          <p>
            <strong>Captadas sin exclusividad.</strong> Si figura captada pero no se registró si era
            exclusiva y por cuántos días, el protocolo no va a poder calcular el vencimiento.
          </p>
          <p>
            <strong>No captadas sin motivo.</strong> El motivo es lo que después explica por qué se
            pierden captaciones. Sin él, esa parte del reporte queda vacía.
          </p>
        </Tarjeta>

        <Aviso tono="atencion" titulo="Las listas muestran hasta 500 registros, y te avisan">
          <p>
            Si hay más de 500, arriba de la lista aparece un cartel:{' '}
            <em>“Se están mostrando 500 ventas, y hay más”</em>. Mientras no aparezca, lo que ves es
            todo — podés auditar recorriendo la lista con tranquilidad.
          </p>
          <p>
            Si aparece, <strong>filtrá por año o por período</strong> hasta que el resultado baje de 500 y
            revisá por tramos. No hay forma de ver más de 500 juntos todavía.
          </p>
        </Aviso>

        <Tarjeta titulo="La prueba que de verdad valida todo">
          <p>
            Pedile a la dirección de la inmobiliaria <strong>el volumen y las puntas del año</strong> según
            sus propios registros, y compará contra el tablero.
          </p>
          <p>
            Si coinciden, el sistema quedó bien cargado y el equipo lo va a creer. Si no, tenés el número
            de la diferencia para ir a buscar qué falta — que es mucho más fácil que revisar operación por
            operación.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Cómo se limpia">
          <p>
            Desde <strong>Ventas</strong>, <strong>Alquileres</strong> o <strong>Tasaciones</strong>, con el
            botón <strong>Borrar</strong> de cada fila. Antes de confirmar, el sistema muestra qué se va a
            borrar —código, dirección, precio, comisión y puntas— justamente para esto.
          </p>
          <p>
            En <strong>Ventas y Alquileres</strong> necesitás rol de <strong>dirección o admin</strong>:
            son los únicos que cargan, editan y borran operaciones. Al vendedor y al team leader no les
            aparece ninguno de los tres botones. En <strong>Tasaciones</strong>, en cambio, el team
            leader sí puede borrar.
          </p>
          <p>
            <strong>El borrado es definitivo</strong> y hoy la base no tiene copias de seguridad
            automáticas. Revisá dos veces.
          </p>
        </Tarjeta>
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
            <p>
              Ve lo suyo. Carga y edita <strong>tasaciones</strong>, pero en Ventas y Alquileres es
              solo lectura.
            </p>
          </Tarjeta>
          <Tarjeta titulo="Team Leader">
            <p>
              Lo mismo que el vendedor, y además puede ver a su equipo tildando{' '}
              <strong>Ver todo</strong>. Borra tasaciones, no operaciones.
            </p>
          </Tarjeta>
          <Tarjeta titulo="Dirección">
            <p>
              Ve toda la inmobiliaria con <strong>Ver todo</strong>, gestiona vendedores y objetivos, y
              es quien carga las ventas y los alquileres.
            </p>
          </Tarjeta>
          <Tarjeta titulo="Admin de la inmobiliaria">
            <p>Como dirección, más la administración interna de su propia inmobiliaria.</p>
          </Tarjeta>
        </div>
        <Aviso tono="atencion" titulo="Las ventas las carga la inmobiliaria, no el vendedor">
          <p>
            En <strong>Ventas y Alquileres</strong> solo <strong>dirección y admin</strong> dan de alta,
            editan y borran. El vendedor y el team leader entran en modo lectura: ven sus operaciones
            —que es de donde salen sus KPIs, su ranking y sus objetivos— pero no les aparece “Nueva
            venta”, ni el lápiz, ni Borrar.
          </p>
          <p>
            Es la respuesta a la consulta más común del arranque. Si alguien te dice que “no le figura
            cargar” o que “se le fue el botón”, casi siempre es esto y no un error.
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

      <Seccion titulo="Instalar la aplicación en el teléfono">
        <Tarjeta titulo="Qué es y qué no es">
          <p>
            No hay que buscarla en ninguna tienda: se instala <strong>desde la dirección web</strong>. Es la
            misma plataforma, con su ícono en la pantalla de inicio y a pantalla completa.
          </p>
          <p>
            <strong>No descarga nada ni ocupa espacio</strong>, y las actualizaciones llegan solas: no hay
            que reinstalar nunca.
          </p>
        </Tarjeta>

        <Aviso tono="peligro" titulo="Que NO abran el enlace desde WhatsApp">
          <p>
            Si les mandás la dirección por mensaje y la abren ahí, se abre el navegador interno de la
            aplicación de mensajería, <strong>que no permite instalar</strong>. Es la causa número uno de
            “a mí no me aparece el botón”.
          </p>
          <p>
            Hay que tocar los tres puntitos y elegir <strong>Abrir en Chrome</strong> (o en Safari, en
            iPhone).
          </p>
        </Aviso>

        <Tarjeta titulo="Android — es de un toque">
          <p>
            <strong>1.</strong> Abrir la dirección en <strong>Chrome</strong> (o el navegador de Samsung).
          </p>
          <p>
            <strong>2.</strong> Entrar con correo y contraseña.
          </p>
          <p>
            <strong>3.</strong> Aparece un cartel abajo: tocar{' '}
            <strong>“Agregar a la pantalla de inicio”</strong> y confirmar.
          </p>
          <p>
            Si el cartel no apareciera, se puede hacer igual desde los tres puntitos del navegador →{' '}
            <strong>Instalar aplicación</strong>.
          </p>
          <p className="text-[13px]">
            El ícono se va a ver con la forma que use ese teléfono —círculo o cuadrado redondeado—; es
            normal, hay una versión preparada para eso.
          </p>
        </Tarjeta>

        <Tarjeta titulo="iPhone — hay que hacerlo a mano">
          <p>
            Apple <strong>no permite</strong> el botón de instalar, así que acá no hay atajo: se hace a
            mano y por eso conviene acompañar a la persona.
          </p>
          <p>
            <strong>1.</strong> Abrir la dirección <strong>en Safari</strong>. Desde Chrome en iPhone{' '}
            <strong>no funciona</strong>.
          </p>
          <p>
            <strong>2.</strong> Tocar el botón <strong>Compartir</strong> (el cuadrado con la flecha hacia
            arriba, en la barra de abajo).
          </p>
          <p>
            <strong>3.</strong> Bajar en la lista y elegir <strong>Agregar a inicio</strong>.
          </p>
          <p>
            <strong>4.</strong> Confirmar con <strong>Agregar</strong>.
          </p>
          <p className="text-[13px]">
            En la app instalada no hay barra de direcciones, así que no se puede escribir una URL adentro.
            Si alguna vez hace falta, se abre desde Safari.
          </p>
        </Tarjeta>

        <Tarjeta titulo="Cómo saber que quedó bien instalada">
          <p>
            Al abrirla desde el ícono <strong>no se ve la barra del navegador</strong>. Si se ve, quedó
            como un acceso directo común: hay que borrarla y repetir los pasos.
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
