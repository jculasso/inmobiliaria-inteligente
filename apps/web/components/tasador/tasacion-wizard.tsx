'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  ComparableInput,
  AptoCredito,
  Disposicion,
  Documentacion,
  Escenario,
  EstadoInmueble,
  EstrategiaAccion,
  Nivel,
  Orientacion,
  PerfilComprador,
  PlazoEstimado,
  Servicio,
  TasacionDto,
  TasacionFotoDto,
  TipoOperacion,
  TipoPropiedad,
} from '@vacker/types';
import {
  AptoCreditoSchema,
  DisposicionSchema,
  DocumentacionSchema,
  EscenarioSchema,
  EstadoInmuebleSchema,
  EstrategiaAccionSchema,
  NivelSchema,
  OrientacionSchema,
  PerfilCompradorSchema,
  PlazoEstimadoSchema,
  SERVICIOS,
  TipoPropiedadSchema,
  UpdateTasacionSchema,
} from '@vacker/types';
import { z } from 'zod';
import {
  analizarComparables,
  valoresSugeridos,
  valuationSurface,
  type Coeficientes,
  type ComparableCalc,
  type PropiedadCalc,
} from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTasacion, generarInforme, updateTasacion } from '../../lib/tasador-api';
import { abrirPdfEnPestana, abrirPestanaEnEspera } from '../../lib/abrir-pdf';
import { hoyIso } from '../../lib/format';
import { escribirImporte, leerImporte, leerNumero } from '../../lib/importe';
import { MensajeError } from '../piezas';
import { Seccion1Datos } from './wizard/seccion-1-datos';
import { Seccion2Caracteristicas } from './wizard/seccion-2-caracteristicas';
import { Seccion3Analisis } from './wizard/seccion-3-analisis';
import { Seccion4Comparables } from './wizard/seccion-4-comparables';
import { Seccion5Valores } from './wizard/seccion-5-valores';
import { Seccion6Estrategia } from './wizard/seccion-6-estrategia';
import { SECCIONES, WizardSidebar } from './wizard/wizard-sidebar';
import {
  borrarBorrador,
  guardarBorrador,
  leerBorrador,
  type BorradorTasacion,
} from './wizard/borrador';

/**
 * Cuánto se espera desde el último cambio para guardar solo. Corto como para
 * que un iPhone que descarga la pestaña al abrir la cámara no se lleve casi
 * nada; largo como para no mandar un pedido por cada letra.
 */
export const AUTOGUARDADO_MS = 2500;

const MENSAJE_SALIR = 'Hay cambios sin guardar en la tasación. ¿Salir y descartarlos?';

/**
 * Un valor de enum "legacy" que ya no existe en el schema (p.ej. estadoInmueble
 * 'Impecable', de una versión vieja del vocabulario) haría que el <select> no lo
 * encuentre y muestre "Seleccionar…", pero el estado seguiría con el valor viejo
 * y al guardar la API lo rechazaría con un error técnico. Se sanea al cargar: si
 * no es una opción válida, arranca vacío (y al guardar se manda null).
 */
function opcionValida<T extends string>(schema: z.ZodType<T>, value: unknown): T | '' {
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : '';
}
/** Igual, para multiselects: descarta los valores que ya no son válidos. */
function opcionesValidas<T extends string>(
  schema: z.ZodType<T>,
  values: readonly string[] | null | undefined,
): T[] {
  return (values ?? []).filter((v): v is T => schema.safeParse(v).success);
}

/** Un importe escrito («185.000,00») como número; lo ilegible no se manda. */
function importe(texto: string): number | null {
  const n = leerImporte(texto);
  return n == null || Number.isNaN(n) ? null : n;
}

interface Props {
  tasacion?: TasacionDto;
  /**
   * Cuánto pesa cada metro semicubierto y descubierto.
   *
   * Al crear vienen de la inmobiliaria; al editar, de la tasación —que los
   * tiene congelados desde el día que se hizo—. La página decide cuál pasa, y
   * por eso la prop es obligatoria: si tuviera un valor por defecto, una
   * inmobiliaria con otro criterio vería en pantalla el total de Vacker
   * mientras el servidor guarda el suyo, y los dos números no coincidirían.
   */
  coeficientes: Coeficientes;
  /** Al crear: de quién es el borrador local (ver `wizard/borrador.ts`). */
  usuarioId?: string;
}

/**
 * El wizard de tasación. Esta capa solo recupera el borrador de una tasación
 * nueva: `sessionStorage` no existe en el servidor, así que se lee después de
 * montar y el formulario se vuelve a montar con lo recuperado.
 */
export function TasacionWizard(props: Props) {
  const { tasacion, usuarioId } = props;
  const [borrador, setBorrador] = useState<BorradorTasacion | null>(null);

  useEffect(() => {
    if (tasacion || !usuarioId) return;
    setBorrador(leerBorrador(usuarioId));
  }, [tasacion, usuarioId]);

  return (
    <FormularioTasacion
      key={borrador ? 'borrador' : 'nueva'}
      {...props}
      borrador={borrador}
      onDescartarBorrador={() => {
        borrarBorrador();
        setBorrador(null);
      }}
    />
  );
}

function FormularioTasacion({
  tasacion,
  coeficientes,
  usuarioId,
  borrador,
  onDescartarBorrador,
}: Props & { borrador: BorradorTasacion | null; onDescartarBorrador: () => void }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Lo que se carga: la tasación guardada o, en una nueva, el borrador recuperado.
  const ini: Partial<TasacionDto> | undefined = tasacion ?? borrador?.datos;
  const [tasacionId, setTasacionId] = useState<string | null>(tasacion?.id ?? null);
  /** El id para el código asíncrono: el estado de un render viejo todavía no lo tiene. */
  const idRef = useRef<string | null>(tasacion?.id ?? null);
  const seccionInicial = Number(searchParams.get('seccion')) || borrador?.seccion || 1;
  const [seccionActiva, setSeccionActiva] = useState(
    seccionInicial >= 1 && seccionInicial <= SECCIONES.length ? seccionInicial : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  // Sección 1
  const [cliente, setCliente] = useState(ini?.cliente ?? '');
  // `hoyIso` y no `toISOString`: después de las 21 h, en UTC ya es mañana.
  const [fecha, setFecha] = useState(ini?.fecha ?? hoyIso());
  const [direccion, setDireccion] = useState(ini?.direccion ?? '');
  const [barrio, setBarrio] = useState(ini?.barrio ?? '');
  const [ciudad, setCiudad] = useState(ini?.ciudad ?? '');
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>(ini?.tipoOperacion ?? 'venta');

  // Sección 2
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad>(
    opcionValida(TipoPropiedadSchema, ini?.tipoPropiedad) || 'Departamento',
  );
  // `|| ''` en las tres primeras: el guardado manda 0 cuando están vacías, y
  // un borrador recuperado no tiene que mostrar «0» donde no se escribió nada.
  const [supCubierta, setSupCubierta] = useState(String(ini?.supCubierta || ''));
  const [supSemicubierta, setSupSemicubierta] = useState(String(ini?.supSemicubierta || ''));
  const [supDescubierta, setSupDescubierta] = useState(String(ini?.supDescubierta || ''));
  const [supTerreno, setSupTerreno] = useState(String(ini?.supTerreno ?? ''));
  const [dormitorios, setDormitorios] = useState(String(ini?.dormitorios ?? ''));
  const [banos, setBanos] = useState(String(ini?.banos ?? ''));
  const [toilette, setToilette] = useState(String(ini?.toilette ?? ''));
  const [ambientes, setAmbientes] = useState(String(ini?.ambientes ?? ''));
  const [antiguedad, setAntiguedad] = useState(String(ini?.antiguedad ?? ''));
  const [estadoInmueble, setEstadoInmueble] = useState<EstadoInmueble | ''>(
    opcionValida(EstadoInmuebleSchema, ini?.estadoInmueble),
  );
  const [disposicion, setDisposicion] = useState<Disposicion | ''>(
    opcionValida(DisposicionSchema, ini?.disposicion),
  );
  const [orientacion, setOrientacion] = useState<Orientacion | ''>(
    opcionValida(OrientacionSchema, ini?.orientacion),
  );
  const [cochera, setCochera] = useState(ini?.cochera ?? false);
  const [balcon, setBalcon] = useState(ini?.balcon ?? false);
  const [terraza, setTerraza] = useState(ini?.terraza ?? false);
  const [patio, setPatio] = useState(ini?.patio ?? false);
  const [lavadero, setLavadero] = useState(ini?.lavadero ?? false);
  const [piscina, setPiscina] = useState(ini?.piscina ?? false);
  const [altillo, setAltillo] = useState(ini?.altillo ?? false);
  const [baulera, setBaulera] = useState(ini?.baulera ?? false);
  const [biblioteca, setBiblioteca] = useState(ini?.biblioteca ?? false);
  const [escritorio, setEscritorio] = useState(ini?.escritorio ?? false);
  const [jardin, setJardin] = useState(ini?.jardin ?? false);
  const [vestidor, setVestidor] = useState(ini?.vestidor ?? false);
  const [servicios, setServicios] = useState<string[]>(ini?.servicios ?? []);
  const [tieneAmenities, setTieneAmenities] = useState(ini?.tieneAmenities ?? false);
  const [amenities, setAmenities] = useState<string[]>(ini?.amenities ?? []);
  const [detalleAmenities, setDetalleAmenities] = useState(ini?.detalleAmenities ?? '');
  const [expensas, setExpensas] = useState(String(ini?.expensas ?? ''));
  const [aptoCredito, setAptoCredito] = useState<AptoCredito | ''>(
    opcionValida(AptoCreditoSchema, ini?.aptoCredito),
  );
  const [documentacion, setDocumentacion] = useState<Documentacion | ''>(
    opcionValida(DocumentacionSchema, ini?.documentacion),
  );
  const [fotos, setFotos] = useState<TasacionFotoDto[]>(ini?.fotos ?? []);

  // Sección 3
  // Sin `opcionesValidas` a propósito, a diferencia del resto de la pantalla.
  // Acá el tasador puede escribir la suya, y filtrar contra una lista cerrada
  // borraría en silencio lo que escribió la primera vez que reabra la tasación.
  // También conserva las de una tipología que después se cambió.
  const [fortalezas, setFortalezas] = useState<string[]>(ini?.analisisComercial?.fortalezas ?? []);
  const [aspectos, setAspectos] = useState<string[]>(ini?.analisisComercial?.aspectos ?? []);
  const [demanda, setDemanda] = useState<Nivel | ''>(
    opcionValida(NivelSchema, ini?.analisisComercial?.demanda),
  );
  const [competencia, setCompetencia] = useState<Nivel | ''>(
    opcionValida(NivelSchema, ini?.analisisComercial?.competencia),
  );
  const [perfilComprador, setPerfilComprador] = useState<PerfilComprador | ''>(
    opcionValida(PerfilCompradorSchema, ini?.analisisComercial?.perfilComprador),
  );
  const [observacionesComerciales, setObservacionesComerciales] = useState(
    ini?.analisisComercial?.observacionesComerciales ?? '',
  );

  // Sección 4
  const [comparables, setComparables] = useState<ComparableInput[]>(
    (ini?.comparables ?? []).map(({ usdM2: _usdM2, ...c }) => c),
  );

  // Sección 5 — los importes viven como se escriben («185.000,00»).
  const [valorMinimo, setValorMinimo] = useState(escribirImporte(ini?.valorMinimo));
  const [valorRecomendado, setValorRecomendado] = useState(escribirImporte(ini?.valorRecomendado));
  const [valorAspiracional, setValorAspiracional] = useState(
    escribirImporte(ini?.valorAspiracional),
  );
  const [margenNegociacion, setMargenNegociacion] = useState(
    ini?.margenNegociacion == null ? '' : String(ini.margenNegociacion).replace('.', ','),
  );
  const [escenarioRecomendado, setEscenarioRecomendado] = useState<Escenario | ''>(
    opcionValida(EscenarioSchema, ini?.escenarioRecomendado),
  );
  const [plazoEstimado, setPlazoEstimado] = useState<PlazoEstimado | ''>(
    opcionValida(PlazoEstimadoSchema, ini?.plazoEstimado),
  );

  // Sección 6
  const [estrategia, setEstrategia] = useState<string[]>(
    opcionesValidas(EstrategiaAccionSchema, ini?.estrategiaComercial?.estrategia),
  );
  const [observacionesEstrategia, setObservacionesEstrategia] = useState(
    ini?.estrategiaComercial?.observacionesEstrategia ?? '',
  );

  /*
   * La superficie que manda para valuar, que NO siempre es la construida: un
   * terreno vale por su lote. Antes acá se sumaba solo lo construido, así que
   * en un terreno daba cero — y como el valor sugerido es superficie × USD/m²,
   * el valor sugerido también salía cero. Es la misma función que usa el
   * servidor al guardar y la que ya usaban los comparables.
   */
  const superficieTotalPreview = valuationSurface(
    {
      supCubierta: Number(supCubierta) || 0,
      supSemi: Number(supSemicubierta) || 0,
      supDescubierta: Number(supDescubierta) || 0,
      supTerreno: Number(supTerreno) || 0,
    },
    tipoPropiedad,
    coeficientes,
  );

  const analisisComparables = useMemo(() => {
    const propiedad: PropiedadCalc = {
      tipoPropiedad,
      supCubierta: Number(supCubierta) || 0,
      supSemi: Number(supSemicubierta) || 0,
      supDescubierta: Number(supDescubierta) || 0,
      supTerreno: Number(supTerreno) || 0,
      dormitorios: dormitorios ? Number(dormitorios) : null,
      banos: banos ? Number(banos) : null,
      estado: estadoInmueble || null,
      cochera,
    };
    const comps: ComparableCalc[] = comparables.map((c) => ({
      ...c,
      cocheraComp: c.cochera ? 'Sí' : 'No',
    }));
    return analizarComparables(comps, propiedad, coeficientes);
  }, [
    coeficientes,
    comparables,
    tipoPropiedad,
    supCubierta,
    supSemicubierta,
    supDescubierta,
    supTerreno,
    dormitorios,
    banos,
    estadoInmueble,
    cochera,
  ]);

  // La sugerencia usa la referencia PONDERADA (no el promedio simple), como el prototipo.
  const sugerencia = useMemo(() => {
    if (analisisComparables.count < 3) return null;
    return valoresSugeridos(superficieTotalPreview, analisisComparables.weightedUsdPerM2);
  }, [analisisComparables, superficieTotalPreview]);

  // El input solo mostraba la sugerencia como `placeholder` (texto gris que
  // desaparece al tipear, nunca un valor real): si el usuario no tocaba el
  // campo, se guardaba `null` y el informe mostraba "—" en vez del valor
  // sugerido. Ahora se precompletan de verdad la primera vez que hay
  // suficientes comparables — y solo esa vez, para no pisar un valor ya
  // cargado o editado a mano.
  useEffect(() => {
    if (!sugerencia) return;
    const sinTocar = valorMinimo === '' && valorRecomendado === '' && valorAspiracional === '';
    if (!sinTocar) return;
    setValorMinimo(escribirImporte(Math.round(sugerencia.minimo)));
    setValorRecomendado(escribirImporte(Math.round(sugerencia.recomendado)));
    setValorAspiracional(escribirImporte(Math.round(sugerencia.aspiracional)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerencia]);

  function datosSeccion1() {
    return {
      cliente,
      fecha,
      direccion,
      barrio: barrio || null,
      ciudad: ciudad || null,
      tipoOperacion,
    };
  }

  function datosSeccion2() {
    return {
      tipoPropiedad,
      supCubierta: Number(supCubierta) || 0,
      supSemicubierta: Number(supSemicubierta) || 0,
      supDescubierta: Number(supDescubierta) || 0,
      supTerreno: supTerreno ? Number(supTerreno) : null,
      dormitorios: dormitorios ? Number(dormitorios) : null,
      banos: banos ? Number(banos) : null,
      toilette: toilette ? Number(toilette) : null,
      ambientes: ambientes ? Number(ambientes) : null,
      antiguedad: antiguedad ? Number(antiguedad) : null,
      estadoInmueble: estadoInmueble || null,
      disposicion: disposicion || null,
      orientacion: orientacion || null,
      cochera,
      balcon,
      terraza,
      patio,
      lavadero,
      piscina,
      altillo,
      baulera,
      biblioteca,
      escritorio,
      jardin,
      vestidor,
      // La grilla trabaja con `string[]` para poder mostrar también los valores
      // viejos de amenities. Acá se estrecha al enum: la pantalla solo ofrece
      // opciones válidas, así que en la práctica no descarta nada — pero deja
      // el contrato con la API estricto en vez de castearlo.
      servicios: servicios.filter((s): s is Servicio =>
        (SERVICIOS as readonly string[]).includes(s),
      ),
      tieneAmenities,
      amenities,
      detalleAmenities: detalleAmenities || null,
      expensas: expensas ? Number(expensas) : null,
      aptoCredito: aptoCredito || null,
      documentacion: documentacion || null,
    };
  }

  function datosSeccion3() {
    return {
      analisisComercial: {
        fortalezas,
        aspectos,
        demanda: demanda || null,
        competencia: competencia || null,
        perfilComprador: perfilComprador || null,
        observacionesComerciales: observacionesComerciales || null,
      },
    };
  }

  function datosSeccion4() {
    return { comparables: comparables.length > 0 ? comparables : undefined };
  }

  function datosSeccion5() {
    const margen = leerNumero(margenNegociacion);
    return {
      // `leerImporte` y no `Number`: «185.000» son ciento ochenta y cinco mil, no 185.
      valorMinimo: importe(valorMinimo),
      valorRecomendado: importe(valorRecomendado),
      valorAspiracional: importe(valorAspiracional),
      margenNegociacion: margen == null || Number.isNaN(margen) ? null : margen,
      escenarioRecomendado: escenarioRecomendado || null,
      plazoEstimado: plazoEstimado || null,
    };
  }

  function datosSeccion6() {
    return {
      estrategiaComercial: {
        estrategia: estrategia as EstrategiaAccion[],
        observacionesEstrategia: observacionesEstrategia || null,
      },
    };
  }

  function datosDeSeccion(n: number) {
    if (n === 1) return datosSeccion1();
    if (n === 2) return datosSeccion2();
    if (n === 3) return datosSeccion3();
    if (n === 4) return datosSeccion4();
    if (n === 5) return datosSeccion5();
    return datosSeccion6();
  }

  /**
   * Todas las secciones juntas — se usa al generar el informe o finalizar,
   * momentos en los que hace falta que TODO lo cargado esté guardado sin
   * importar cuál sea la sección activa.
   */
  function datosCompletos() {
    return {
      ...datosSeccion1(),
      ...datosSeccion2(),
      ...datosSeccion3(),
      ...datosSeccion4(),
      ...datosSeccion5(),
      ...datosSeccion6(),
    };
  }

  // --- Qué falta guardar ---------------------------------------------------
  //
  // Cada sección tiene su «firma» (lo que mandaría a la API, en texto). Una
  // sección está sin guardar si su firma no es la del último guardado que
  // salió bien. Así el autoguardado manda solo lo que cambió, y lo que se
  // escribió MIENTRAS volvía la respuesta sigue marcado como pendiente.
  const firmas = SECCIONES.map((s) => JSON.stringify(datosDeSeccion(s.id)));
  const guardadas = useRef<string[] | null>(null);
  if (guardadas.current === null) guardadas.current = firmas;
  const [, setGuardadoN] = useState(0);
  const sucias = SECCIONES.map((s) => s.id).filter(
    (n) => firmas[n - 1] !== guardadas.current![n - 1],
  );
  // En una nueva, «sin guardar» es haber escrito algo (o traer un borrador).
  const firmaTotal = firmas.join('|');
  const firmaVacia = useRef(borrador ? '' : firmaTotal);
  const hayCambios = tasacionId ? sucias.length > 0 : firmaTotal !== firmaVacia.current;

  function marcarGuardadas(secciones: number[], firmasEnviadas: string[]) {
    const g = [...guardadas.current!];
    for (const n of secciones) g[n - 1] = firmasEnviadas[n - 1]!;
    guardadas.current = g;
    setGuardadoN((v) => v + 1);
  }

  type Modo = 'paso' | 'todo' | 'auto';

  /**
   * Guarda. `paso`: lo pendiente, al cambiar de sección. `todo`: todas las
   * secciones en un PATCH, al terminar (si alguien saltó de «Comparables» a
   * «Estrategia», «Valores» también tiene que quedar). `auto`: lo pendiente,
   * en silencio y solo si la API lo va a aceptar — dos comparables de seis
   * no son un error mientras se están cargando.
   *
   * Tira el error de la API; quien llama decide cómo mostrarlo.
   */
  async function persistir(modo: Modo): Promise<boolean> {
    const id = idRef.current;
    const enviadas = firmas;
    if (!id) {
      // Sin tasación todavía no hay dónde guardar: el borrador local cubre.
      if (modo === 'auto') return false;
      if (!cliente.trim() || !fecha || !direccion.trim()) {
        setError('Completá cliente, fecha y dirección antes de continuar.');
        return false;
      }
      const datos = modo === 'todo' ? datosCompletos() : { ...datosSeccion1(), ...datosSeccion2() };
      const creada = await createTasacion(await getAccessToken(), datos);
      idRef.current = creada.id;
      setTasacionId(creada.id);
      marcarGuardadas(modo === 'todo' ? SECCIONES.map((s) => s.id) : [1, 2], enviadas);
      borrarBorrador();
      return true;
    }

    const pendientes = SECCIONES.map((s) => s.id).filter(
      (n) => enviadas[n - 1] !== guardadas.current![n - 1],
    );
    const secciones = modo === 'todo' ? SECCIONES.map((s) => s.id) : pendientes;
    if (secciones.includes(1) && (!cliente.trim() || !fecha || !direccion.trim())) {
      if (modo === 'auto') return false;
      setError('Completá cliente, fecha y dirección antes de continuar.');
      return false;
    }
    if (secciones.length === 0) return true;
    const datos =
      modo === 'todo'
        ? datosCompletos()
        : Object.assign({}, ...secciones.map((n) => datosDeSeccion(n)));
    if (modo === 'auto' && !UpdateTasacionSchema.safeParse(datos).success) return false;
    await updateTasacion(await getAccessToken(), id, datos);
    marcarGuardadas(secciones, enviadas);
    return true;
  }

  // --- Un guardado a la vez ------------------------------------------------
  //
  // Un toque doble en «Siguiente» (o en el número de paso) con la red lenta
  // mandaba dos pedidos, y en una tasación nueva la creaba dos veces. La ref
  // corta el segundo en el mismo instante, antes de que React vuelva a pintar
  // el botón deshabilitado.
  const manualEnCurso = useRef(false);
  const autoEnCurso = useRef<Promise<void> | null>(null);
  const [estadoAuto, setEstadoAuto] = useState<'quieto' | 'guardando' | 'error'>('quieto');
  const [errorAuto, setErrorAuto] = useState<string | null>(null);

  async function accionManual<T>(fn: () => Promise<T>): Promise<T | undefined> {
    if (manualEnCurso.current) return undefined;
    manualEnCurso.current = true;
    setGuardando(true);
    try {
      // Si el autoguardado está en vuelo, se espera: lo que ya mandó no se manda otra vez.
      if (autoEnCurso.current) await autoEnCurso.current;
      return await fn();
    } finally {
      manualEnCurso.current = false;
      setGuardando(false);
    }
  }

  /** El guardado de un botón: el error se muestra pegado a los botones. */
  async function guardarManual(modo: 'paso' | 'todo'): Promise<boolean> {
    setError(null);
    try {
      return await persistir(modo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tasación.');
      return false;
    }
  }

  // El autoguardado corre desde timers y eventos del documento: siempre con
  // las funciones del último render, que son las que ven el estado actual.
  const persistirRef = useRef(persistir);
  persistirRef.current = persistir;
  const autoguardar = () => {
    if (manualEnCurso.current || autoEnCurso.current || !idRef.current) return;
    setEstadoAuto('guardando');
    autoEnCurso.current = persistirRef
      .current('auto')
      .then(() => {
        setEstadoAuto('quieto');
        setErrorAuto(null);
      })
      .catch((err: unknown) => {
        setEstadoAuto('error');
        setErrorAuto(err instanceof Error ? err.message : 'No se pudo guardar.');
      })
      .finally(() => {
        autoEnCurso.current = null;
      });
  };
  const autoguardarRef = useRef(autoguardar);
  autoguardarRef.current = autoguardar;

  // Unos segundos después del último cambio, se guarda lo pendiente.
  const firmaPendiente = sucias.map((n) => firmas[n - 1]).join('|');
  useEffect(() => {
    if (!tasacionId || !firmaPendiente) return;
    const t = window.setTimeout(() => autoguardarRef.current(), AUTOGUARDADO_MS);
    return () => window.clearTimeout(t);
  }, [tasacionId, firmaPendiente]);

  // Al salir de la app (otra app, bloquear el teléfono, abrir la cámara) se
  // guarda YA: el sistema puede descargar la pestaña y no volver a cargarla.
  useEffect(() => {
    const alOcultar = () => {
      if (document.visibilityState === 'hidden') autoguardarRef.current();
    };
    document.addEventListener('visibilitychange', alOcultar);
    return () => document.removeEventListener('visibilitychange', alOcultar);
  }, []);

  // Una tasación nueva todavía no existe: lo cargado va al borrador local.
  useEffect(() => {
    if (tasacionId || !usuarioId || !hayCambios) return;
    guardarBorrador({
      usuarioId,
      seccion: seccionActiva,
      datos: datosCompletos() as unknown as Partial<TasacionDto>,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasacionId, usuarioId, hayCambios, firmaTotal, seccionActiva]);

  // Salir con cambios sin guardar pregunta: recargar o cerrar la pestaña (el
  // navegador muestra su aviso) y los links de la app (pestañas del módulo,
  // el inicio). Con el autoguardado, casi nunca llega a preguntar.
  const hayCambiosRef = useRef(hayCambios);
  hayCambiosRef.current = hayCambios;
  useEffect(() => {
    const alDescargar = (e: BeforeUnloadEvent) => {
      if (!hayCambiosRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const alClic = (e: MouseEvent) => {
      if (!hayCambiosRef.current || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const destino = new URL(a.href, window.location.href);
      if (destino.origin !== window.location.origin) return;
      if (destino.pathname === window.location.pathname) return;
      if (window.confirm(MENSAJE_SALIR)) {
        if (!idRef.current) borrarBorrador();
        hayCambiosRef.current = false;
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('beforeunload', alDescargar);
    // En captura: antes de que el <Link> de Next navegue.
    document.addEventListener('click', alClic, true);
    return () => {
      window.removeEventListener('beforeunload', alDescargar);
      document.removeEventListener('click', alClic, true);
    };
  }, []);

  // La sección va en la dirección (`?seccion=3`): recargar —o que el iPhone
  // recargue solo al volver a la app— deja en el mismo paso, no en el 1.
  // `history.replaceState` y no `router.replace`: el router volvería a pedir
  // la página al servidor en cada paso, y crear la tasación cambia /nueva por
  // /[id]/editar sin volver a montar el formulario (antes se remontaba y lo
  // escrito en el medio se perdía).
  useEffect(() => {
    const base = tasacionId
      ? `/tasador/tasaciones/${tasacionId}/editar`
      : '/tasador/tasaciones/nueva';
    const url = `${base}?seccion=${seccionActiva}`;
    if (`${window.location.pathname}${window.location.search}` !== url) {
      window.history.replaceState(null, '', url);
    }
  }, [tasacionId, seccionActiva]);

  async function irA(seccion: number) {
    if (seccion === seccionActiva) return;
    const ok = await accionManual(() => guardarManual('paso'));
    if (ok) setSeccionActiva(seccion);
  }

  async function handleSiguiente() {
    if (seccionActiva >= SECCIONES.length) return;
    const destino = seccionActiva + 1;
    const ok = await accionManual(() => guardarManual('paso'));
    if (ok) setSeccionActiva(destino);
  }

  function handleAnterior() {
    setError(null);
    if (seccionActiva > 1) setSeccionActiva(seccionActiva - 1);
    // Volver no espera al guardado, pero tampoco lo deja para después.
    autoguardar();
  }

  async function handleGenerarInforme() {
    if (manualEnCurso.current) return;
    // La pestaña se abre ANTES de guardar: para cuando termina el guardado, el
    // navegador ya no considera que la acción viene del click y la bloquearía.
    const ventana = abrirPestanaEnEspera('Generando el informe');
    let fallo = false;
    const listo = await accionManual(async () => {
      const ok = await guardarManual('todo');
      const id = idRef.current;
      if (!ok || !id) return false;
      setGenerandoInforme(true);
      try {
        await abrirPdfEnPestana(async () => generarInforme(await getAccessToken(), id), {
          titulo: 'Generando el informe',
          onError: (m) => {
            fallo = true;
            setError(m);
          },
          ventana,
        });
      } finally {
        setGenerandoInforme(false);
      }
      return true;
    });
    if (!listo) {
      ventana?.close();
      return;
    }
    // Si el PDF falló, se queda acá: yéndose, el error no lo veía nadie.
    if (!fallo) router.push('/tasador/tasaciones');
  }

  async function handleFinalizar() {
    const ok = await accionManual(() => guardarManual('todo'));
    if (ok) router.push('/tasador/tasaciones');
  }

  function handleCancelar() {
    if (hayCambios && !window.confirm(MENSAJE_SALIR)) return;
    if (!tasacionId) borrarBorrador();
    hayCambiosRef.current = false;
    router.push('/tasador/tasaciones');
  }

  const ocupado = guardando || generandoInforme;
  const estadoGuardado = !tasacionId
    ? hayCambios
      ? 'Sin guardar todavía'
      : null
    : estadoAuto === 'guardando'
      ? 'Guardando…'
      : sucias.length === 0
        ? '✓ Guardado'
        : 'Sin guardar';

  return (
    // `overflow-clip` y no `overflow-hidden`: recorta las esquinas igual, pero
    // no vuelve a la tarjeta un contenedor de scroll. Con `hidden`, la barra de
    // abajo quedaba «pegada» a una caja que no se desplaza —o sea, nunca se
    // pegaba— y en el teléfono «Siguiente» quedaba al final de la sección.
    <div className="flex flex-col overflow-clip rounded-brand border border-line bg-white lg:min-h-[calc(100vh-8rem)] lg:flex-row">
      <WizardSidebar activa={seccionActiva} onCambiar={irA} deshabilitada={ocupado} />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-x-hidden p-4 sm:p-6">
          {borrador && !tasacionId && (
            <div
              role="status"
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-brand border border-line bg-surface px-3 py-2 text-sm text-ink"
            >
              <span>Recuperamos lo que estabas cargando en esta tasación nueva.</span>
              <Button type="button" variant="secondary" size="sm" onClick={onDescartarBorrador}>
                Empezar de cero
              </Button>
            </div>
          )}
          {seccionActiva === 1 && (
            <Seccion1Datos
              cliente={cliente}
              setCliente={setCliente}
              fecha={fecha}
              setFecha={setFecha}
              tipoOperacion={tipoOperacion}
              setTipoOperacion={setTipoOperacion}
              direccion={direccion}
              setDireccion={setDireccion}
              barrio={barrio}
              setBarrio={setBarrio}
              ciudad={ciudad}
              setCiudad={setCiudad}
            />
          )}
          {seccionActiva === 2 && (
            <Seccion2Caracteristicas
              tipoPropiedad={tipoPropiedad}
              setTipoPropiedad={setTipoPropiedad}
              supCubierta={supCubierta}
              setSupCubierta={setSupCubierta}
              supSemicubierta={supSemicubierta}
              setSupSemicubierta={setSupSemicubierta}
              supDescubierta={supDescubierta}
              setSupDescubierta={setSupDescubierta}
              superficieTotalPreview={superficieTotalPreview}
              supTerreno={supTerreno}
              coeficientes={coeficientes}
              setSupTerreno={setSupTerreno}
              dormitorios={dormitorios}
              setDormitorios={setDormitorios}
              banos={banos}
              setBanos={setBanos}
              toilette={toilette}
              setToilette={setToilette}
              ambientes={ambientes}
              setAmbientes={setAmbientes}
              antiguedad={antiguedad}
              setAntiguedad={setAntiguedad}
              disposicion={disposicion}
              setDisposicion={setDisposicion}
              orientacion={orientacion}
              setOrientacion={setOrientacion}
              estadoInmueble={estadoInmueble}
              setEstadoInmueble={setEstadoInmueble}
              cochera={cochera}
              setCochera={setCochera}
              balcon={balcon}
              setBalcon={setBalcon}
              terraza={terraza}
              setTerraza={setTerraza}
              patio={patio}
              setPatio={setPatio}
              lavadero={lavadero}
              setLavadero={setLavadero}
              piscina={piscina}
              setPiscina={setPiscina}
              altillo={altillo}
              setAltillo={setAltillo}
              baulera={baulera}
              setBaulera={setBaulera}
              biblioteca={biblioteca}
              setBiblioteca={setBiblioteca}
              escritorio={escritorio}
              setEscritorio={setEscritorio}
              jardin={jardin}
              setJardin={setJardin}
              vestidor={vestidor}
              setVestidor={setVestidor}
              servicios={servicios}
              setServicios={setServicios}
              tieneAmenities={tieneAmenities}
              setTieneAmenities={setTieneAmenities}
              amenities={amenities}
              setAmenities={setAmenities}
              detalleAmenities={detalleAmenities}
              setDetalleAmenities={setDetalleAmenities}
              expensas={expensas}
              setExpensas={setExpensas}
              aptoCredito={aptoCredito}
              setAptoCredito={setAptoCredito}
              documentacion={documentacion}
              setDocumentacion={setDocumentacion}
              tasacionId={tasacionId}
              fotos={fotos}
              setFotos={setFotos}
              onAntesDeElegirFoto={autoguardar}
            />
          )}
          {seccionActiva === 3 && (
            <Seccion3Analisis
              tipoPropiedad={tipoPropiedad}
              fortalezas={fortalezas}
              setFortalezas={setFortalezas}
              aspectos={aspectos}
              setAspectos={setAspectos}
              demanda={demanda}
              setDemanda={setDemanda}
              competencia={competencia}
              setCompetencia={setCompetencia}
              perfilComprador={perfilComprador}
              setPerfilComprador={setPerfilComprador}
              observacionesComerciales={observacionesComerciales}
              setObservacionesComerciales={setObservacionesComerciales}
            />
          )}
          {seccionActiva === 4 && (
            <Seccion4Comparables
              comparables={comparables}
              setComparables={setComparables}
              analisis={analisisComparables}
              coeficientes={coeficientes}
            />
          )}
          {seccionActiva === 5 && (
            <Seccion5Valores
              valorMinimo={valorMinimo}
              setValorMinimo={setValorMinimo}
              valorRecomendado={valorRecomendado}
              setValorRecomendado={setValorRecomendado}
              valorAspiracional={valorAspiracional}
              setValorAspiracional={setValorAspiracional}
              margenNegociacion={margenNegociacion}
              setMargenNegociacion={setMargenNegociacion}
              escenarioRecomendado={escenarioRecomendado}
              setEscenarioRecomendado={setEscenarioRecomendado}
              plazoEstimado={plazoEstimado}
              setPlazoEstimado={setPlazoEstimado}
              analisis={analisisComparables}
              superficieTotal={superficieTotalPreview}
            />
          )}
          {seccionActiva === 6 && (
            <Seccion6Estrategia
              estrategia={estrategia}
              setEstrategia={setEstrategia}
              observacionesEstrategia={observacionesEstrategia}
              setObservacionesEstrategia={setObservacionesEstrategia}
            />
          )}
        </div>

        {/* El error va ACÁ, pegado al botón que lo provoca, y no arriba en la
            barra lateral: en una sección larga —comparables con tres cargados—
            hacías click en "Siguiente" abajo, el mensaje aparecía fuera de
            pantalla y la pantalla parecía no hacer nada. Reportado el
            30/07/2026: "no me dejaba pasar, no daba ningún mensaje". El mensaje
            estaba; no se veía. */}
        <div className="sticky bottom-0 z-10 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
          {error && (
            <div className="border-b border-danger/20 bg-danger/5 px-4 py-2.5 sm:px-6">
              <MensajeError className="text-xs font-semibold">{error}</MensajeError>
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <Button type="button" variant="secondary" onClick={handleCancelar} disabled={ocupado}>
                Cancelar
              </Button>
              {estadoAuto === 'error' && sucias.length > 0 ? (
                <MensajeError className="text-xs">No se guardó solo: {errorAuto}</MensajeError>
              ) : (
                estadoGuardado && (
                  <span aria-live="polite" className="text-xs text-muted">
                    {estadoGuardado}
                  </span>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {seccionActiva > 1 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAnterior}
                  disabled={ocupado}
                >
                  ← Anterior
                </Button>
              )}
              {seccionActiva < SECCIONES.length ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSiguiente}
                  disabled={ocupado}
                >
                  {guardando ? 'Guardando…' : 'Siguiente →'}
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleFinalizar}
                    disabled={ocupado}
                  >
                    {guardando && !generandoInforme ? 'Guardando…' : 'Guardar y salir'}
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    onClick={handleGenerarInforme}
                    disabled={ocupado}
                  >
                    {generandoInforme ? 'Generando…' : '📄 Generar informe (PDF)'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
