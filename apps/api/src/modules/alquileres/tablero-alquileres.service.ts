import { Injectable } from '@nestjs/common';
import {
  DIAS_TABLERO_PROXIMOS,
  type DetalleTableroQuery,
  type FiltroTipoContrato,
  type Indicador,
  type TableroAlquileresDto,
} from '@vacker/types';
import { cierreDelMes } from '@vacker/domain';
import { TenantPrismaService } from '../../prisma/tenant-prisma.service';
import { hoyArgentina } from '../protocolo/protocolo.calc';
import { IndexacionesService } from './indexaciones.service';
import { LiquidacionesService } from './liquidaciones.service';
import { carteraAl, carteraDelTablero, cierresDelAnio, contratosNuevos } from './tablero/cartera';
import { cobranzaDelMes, evolucionDelAnio } from './tablero/cobranza';
import { mesesDe } from './tablero/comun';
import { detalleDeUnNumero } from './tablero/detalle';
import { fichas } from './tablero/fichas';
import { ingresosPorMes } from './tablero/ingresos';
import { leerTablero, type DatosTablero } from './tablero/lectura';
import { moraAl, morosidadDe } from './tablero/morosidad';
import { tareasDelTablero } from './tablero/tareas';

// Lo que otros archivos importan de acá sigue saliendo de acá: el informe al
// propietario lee la misma deuda que el Dashboard (regla 89).
export { vigenteAl } from './tablero/cartera';
export { unirFinales } from './tablero/cobranza';
export { sqlSaldosAlCierre, type FilaMora } from './tablero/morosidad';

/**
 * El tablero del módulo Alquileres (spec alquileres-fase-1.md, reglas 26 a 32
 * y 74 a 82).
 *
 * Lo que crece con la historia se calcula en la base: la morosidad trae solo
 * los conceptos con saldo, y los ingresos vienen agregados por mes. Los
 * alquileres del año llegan uno por fila —son los del año, no la historia— y
 * se suman acá, con las mismas definiciones con que el detalle los lista. En
 * todos los casos, las consultas son las mismas tenga la inmobiliaria 10
 * contratos o 1.000.
 *
 * Este archivo orquesta: lee (`tablero/lectura.ts`), filtra por el corte y
 * arma cada sección con su archivo de `tablero/` —cartera y cierres,
 * cobranza y evolución, morosidad, ingresos, tareas y el detalle de un número—.
 */
@Injectable()
export class TableroAlquileresService {
  constructor(
    private readonly db: TenantPrismaService,
    private readonly indexaciones: IndexacionesService,
    private readonly liquidaciones: LiquidacionesService,
  ) {}

  /**
   * `anio` elige el año de los meses que la pantalla suma (regla 74), como el
   * Tablero Comercial. Lo que viaja con sus listas —cartera, morosidad y
   * tareas— es a hoy.
   */
  async tablero(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
    tipo: FiltroTipoContrato = 'todos',
  ): Promise<TableroAlquileresDto> {
    return (await this.tableros(hoy, anio))[tipo];
  }

  /**
   * Los tres cortes —todos, particulares y comerciales— de una sola lectura.
   * El filtro tardaba cinco o seis segundos por toque porque cada uno volvía a
   * leer todo (Javier, 6/10/2026: «parece que no está funcionando»); ahora la
   * pantalla los trae juntos y cambiar de filtro no pide nada. Lo que se
   * agrega en la base viene separado por tipo y se suma acá.
   */
  async tableros(
    hoy = hoyArgentina(),
    anio = Number(hoy.slice(0, 4)),
  ): Promise<Record<FiltroTipoContrato, TableroAlquileresDto>> {
    const mes = hoy.slice(0, 7);
    const [datos, bandeja, aLiquidar] = await Promise.all([
      this.db.withTenant((tx) => leerTablero(tx, hoy, mes, anio)),
      this.indexaciones.bandeja(hoy, DIAS_TABLERO_PROXIMOS),
      this.liquidaciones.pendientes(),
    ]);
    const armar = (tipo: FiltroTipoContrato) =>
      this.armar(datos, bandeja, aLiquidar, hoy, mes, anio, tipo);
    return { todos: armar('todos'), vivienda: armar('vivienda'), comercial: armar('comercial') };
  }

  /**
   * La lista de un número del período (regla 79), pedida al abrir su tarjeta.
   * Sale de la misma consulta y de la misma definición que el número que el
   * tablero sumó para ese período: la lista suma exactamente la tarjeta.
   *
   * Los flujos son de los meses `desde`…`hasta`; las fotos, al cierre de
   * `hasta` (regla 77). Dos consultas como mucho, haya los contratos que haya.
   */
  async detalle(q: DetalleTableroQuery, hoy = hoyArgentina()): Promise<Indicador> {
    const cierre = cierreDelMes(q.hasta, hoy);
    return this.db.withTenant((tx) => detalleDeUnNumero(tx, q, cierre, hoy));
  }

  /** Un corte del tablero, armado sección por sección con lo ya leído: ninguna consulta más. */
  private armar(
    datos: DatosTablero,
    bandejaTodas: Awaited<ReturnType<IndexacionesService['bandeja']>>,
    aLiquidarTodos: Awaited<ReturnType<LiquidacionesService['pendientes']>>,
    hoy: string,
    mes: string,
    anio: number,
    tipo: FiltroTipoContrato,
  ): TableroAlquileresDto {
    const { contratos: todos } = datos;
    const delTipoSql = <T extends { tipo_contrato: string | null }>(xs: T[]) =>
      tipo === 'todos' ? xs : xs.filter((x) => x.tipo_contrato === tipo);
    const alquileres = delTipoSql(datos.alquileres);
    const mora = delTipoSql(datos.mora);

    // El filtro Particulares / Comerciales (punto 8 de Javier) mira todo el
    // tablero: lo leído se filtra acá, sobre los contratos de la inmobiliaria.
    const contratos = tipo === 'todos' ? todos : todos.filter((c) => c.tipo === tipo);
    const delTipo = new Set(contratos.map((c) => c.id));
    const bandeja =
      tipo === 'todos'
        ? bandejaTodas
        : {
            ...bandejaTodas,
            tramos: bandejaTodas.tramos.filter((t) => delTipo.has(t.contrato.id)),
          };
    const aLiquidar =
      tipo === 'todos'
        ? aLiquidarTodos
        : aLiquidarTodos.filter((p) => p.contratos.some((c) => delTipo.has(c.id)));

    const f = fichas(todos, hoy);
    const meses = mesesDe(anio);
    // --- Cartera a hoy (regla 27) ---
    // Sus vigentes son también los de las tareas (vencen, sin firmar, escalones).
    const cartera = carteraAl(contratos, hoy, hoy);
    // --- Morosidad a hoy (regla 29) y la foto de cada cierre (regla 77) ---
    // La deuda de hoy se calcula una vez: la usan la morosidad y los deudores.
    const filasMora = moraAl(mora, hoy, f);

    return {
      hoy,
      mes,
      anio,
      tipo,
      nuevos: contratosNuevos(contratos, meses, anio, f),
      cartera: carteraDelTablero(todos, cartera, f),
      cobranza: cobranzaDelMes(alquileres, mes, f, hoy),
      morosidad: morosidadDe(filasMora).map(({ inquilinos: _i, ...m }) => m),
      evolucion: evolucionDelAnio(alquileres, meses),
      cierres: cierresDelAnio(contratos, mora, meses, hoy, f),
      ingresos: ingresosPorMes(delTipoSql(datos.ingresos)),
      tareas: tareasDelTablero({
        hoy,
        tipo,
        f,
        contratos,
        vigentes: cartera.vigentes,
        delTipo,
        bandeja,
        aLiquidar,
        finales: delTipoSql(datos.finales),
        filasMora,
        reclamos: datos.reclamos,
        polizas: datos.polizas,
        boletas: datos.boletas,
        reservas: datos.reservas,
      }),
    };
  }
}
