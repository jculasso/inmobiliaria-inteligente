import { getKpisResumen, getResumenRango } from '../../lib/tablero-api';
import { sesionServidor } from '../../lib/server-principal';
import { puedeVerTodo } from '../../lib/rbac';
import { puedeVerAlquileres } from '@vacker/types';
import { FiltroPeriodo } from '../../components/tablero/filtro-periodo';
import { ToggleVerTodo } from '../../components/tablero/toggle-ver-todo';
import { DashboardKpis } from '../../components/tablero/dashboard-kpis';
import { ResumenAcumulado } from '../../components/tablero/resumen-acumulado';
import { AlquileresSeccion } from '../../components/tablero/alquileres-seccion';
import { TotalesVendedores } from '../../components/tablero/totales-vendedores';
import { EncabezadoPagina, TituloSeccion } from '../../components/piezas';

export default async function TableroDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string; mes?: string; verTodo?: string }>;
}) {
  const s = await sesionServidor();
  if (!s) return null;

  const hoy = new Date();
  const params = await searchParams;
  const anio = params.anio ? Number(params.anio) : hoy.getFullYear();
  // El mes siempre está seleccionado (como el prototipo): "año completo" se
  // elige con el tab "Acumulado Anual" del Resumen, no con "todos los meses".
  const mes = params.mes ? Number(params.mes) : hoy.getMonth() + 1;
  const verTodo = params.verTodo === '1';

  // Se piden en paralelo: el resumen del mes seleccionado (KPIs de arriba) y
  // el acumulado anual (año completo), que es el tab por defecto de
  // ResumenAcumulado — evita que lo vuelva a pedir al montar con los valores
  // por defecto (mismo dato, un round-trip menos en el hop más lento del
  // stack). Y en paralelo con `/me`: el rol solo decide qué se MUESTRA (el
  // interruptor «ver todo», la sección de alquileres), no qué se pide.
  const [principal, resumen, resumenAnual] = await Promise.all([
    s.principal,
    getKpisResumen(s.accessToken, { anio, mes, verTodo }),
    getResumenRango(s.accessToken, anio, 1, 12, verTodo),
  ]);
  if (!principal) return null;
  const verAlquileres = puedeVerAlquileres(principal.roles);
  // Los componentes de abajo guardan su propio estado (qué pestaña, qué
  // trimestre) y lo que pidieron. Con la clave, un cambio de año o de «ver
  // todo» los vuelve a montar con lo que trajo el servidor, en vez de quedarse
  // con lo viejo o volver a pedir lo mismo.
  const clave = `${anio}-${verTodo ? 'todo' : 'propio'}`;

  return (
    <div className="flex flex-col gap-4">
      <EncabezadoPagina titulo="Dashboard">
        {puedeVerTodo(principal.roles) && <ToggleVerTodo />}
        <FiltroPeriodo anio={anio} mes={mes} />
      </EncabezadoPagina>

      <DashboardKpis
        resumen={resumen}
        anio={anio}
        mes={mes}
        verTodo={verTodo}
        verAlquileres={verAlquileres}
      />

      <section className="flex flex-col gap-2">
        <TituloSeccion icono="📊">Resumen acumulado</TituloSeccion>
        <ResumenAcumulado
          key={clave}
          anio={anio}
          mesSeleccionado={mes}
          verTodo={verTodo}
          inicial={resumenAnual}
        />
      </section>

      {/*
        Una sola tabla de totales por vendedor, con su selector de período
        encima, pegada al resumen de ventas porque es de ventas. Reemplaza a
        la vez al «Ranking de vendedores» y a la tabla que vivía dentro del
        Resumen: eran el mismo dato dos veces. Ver `TotalesVendedores`.
      */}
      <TotalesVendedores
        key={clave}
        anio={anio}
        mesSeleccionado={mes}
        verTodo={verTodo}
        inicial={resumenAnual}
      />

      {/*
        Solo para quien ve los alquileres de toda la inmobiliaria: ver
        `puedeVerAlquileres`. Para los demás no se monta —ni siquiera pide los
        datos—, en vez de mostrarse vacía.
      */}
      {verAlquileres && (
        <section className="flex flex-col gap-2">
          <TituloSeccion icono="🔑" detalle="de toda la inmobiliaria, por fecha de firma">
            Alquileres
          </TituloSeccion>
          <AlquileresSeccion anio={anio} mesSeleccionado={mes} />
        </section>
      )}
    </div>
  );
}
