'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  ComparableInput,
  AptoCredito,
  Aspecto,
  Disposicion,
  Documentacion,
  Escenario,
  EstadoInmueble,
  EstrategiaAccion,
  Fortaleza,
  Nivel,
  Orientacion,
  PerfilComprador,
  PlazoEstimado,
  TasacionDto,
  TasacionFotoDto,
  TipoOperacion,
  TipoPropiedad,
} from '@vacker/types';
import {
  AptoCreditoSchema,
  AspectoSchema,
  DisposicionSchema,
  DocumentacionSchema,
  EscenarioSchema,
  EstadoInmuebleSchema,
  EstrategiaAccionSchema,
  FortalezaSchema,
  NivelSchema,
  OrientacionSchema,
  PerfilCompradorSchema,
  PlazoEstimadoSchema,
  TipoPropiedadSchema,
} from '@vacker/types';
import { z } from 'zod';
import { analizarComparables, superficieTotal, valoresSugeridos, type ComparableCalc, type PropiedadCalc } from '@vacker/domain';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { createTasacion, generarInforme, updateTasacion } from '../../lib/tasador-api';
import { Seccion1Datos } from './wizard/seccion-1-datos';
import { Seccion2Caracteristicas } from './wizard/seccion-2-caracteristicas';
import { Seccion3Analisis } from './wizard/seccion-3-analisis';
import { Seccion4Comparables } from './wizard/seccion-4-comparables';
import { Seccion5Valores } from './wizard/seccion-5-valores';
import { Seccion6Estrategia } from './wizard/seccion-6-estrategia';
import { SECCIONES, WizardSidebar } from './wizard/wizard-sidebar';

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
function opcionesValidas<T extends string>(schema: z.ZodType<T>, values: readonly string[] | null | undefined): T[] {
  return (values ?? []).filter((v): v is T => schema.safeParse(v).success);
}

interface Props {
  tasacion?: TasacionDto;
}

export function TasacionWizard({ tasacion }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasacionId, setTasacionId] = useState<string | null>(tasacion?.id ?? null);
  const seccionInicial = Number(searchParams.get('seccion'));
  const [seccionActiva, setSeccionActiva] = useState(
    seccionInicial >= 1 && seccionInicial <= SECCIONES.length ? seccionInicial : 1,
  );
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  // El `?seccion=` sólo sirve para sobrevivir el remount tras crear (router.replace
  // navega de /nueva a /[id]/editar, una página distinta) — se limpia una vez leído
  // para que recargar la página no quede pegado en esa sección.
  useEffect(() => {
    if (searchParams.get('seccion') && tasacionId) {
      router.replace(`/tasador/tasaciones/${tasacionId}/editar`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [generandoInforme, setGenerandoInforme] = useState(false);

  // Sección 1
  const [cliente, setCliente] = useState(tasacion?.cliente ?? '');
  const [fecha, setFecha] = useState(tasacion?.fecha ?? new Date().toISOString().slice(0, 10));
  const [direccion, setDireccion] = useState(tasacion?.direccion ?? '');
  const [barrio, setBarrio] = useState(tasacion?.barrio ?? '');
  const [ciudad, setCiudad] = useState(tasacion?.ciudad ?? '');
  const [tipoOperacion, setTipoOperacion] = useState<TipoOperacion>(tasacion?.tipoOperacion ?? 'venta');

  // Sección 2
  const [tipoPropiedad, setTipoPropiedad] = useState<TipoPropiedad>(
    opcionValida(TipoPropiedadSchema, tasacion?.tipoPropiedad) || 'Departamento',
  );
  const [supCubierta, setSupCubierta] = useState(String(tasacion?.supCubierta ?? ''));
  const [supSemicubierta, setSupSemicubierta] = useState(String(tasacion?.supSemicubierta ?? ''));
  const [supDescubierta, setSupDescubierta] = useState(String(tasacion?.supDescubierta ?? ''));
  const [supTerreno, setSupTerreno] = useState(String(tasacion?.supTerreno ?? ''));
  const [dormitorios, setDormitorios] = useState(String(tasacion?.dormitorios ?? ''));
  const [banos, setBanos] = useState(String(tasacion?.banos ?? ''));
  const [toilette, setToilette] = useState(String(tasacion?.toilette ?? ''));
  const [ambientes, setAmbientes] = useState(String(tasacion?.ambientes ?? ''));
  const [antiguedad, setAntiguedad] = useState(String(tasacion?.antiguedad ?? ''));
  const [estadoInmueble, setEstadoInmueble] = useState<EstadoInmueble | ''>(
    opcionValida(EstadoInmuebleSchema, tasacion?.estadoInmueble),
  );
  const [disposicion, setDisposicion] = useState<Disposicion | ''>(opcionValida(DisposicionSchema, tasacion?.disposicion));
  const [orientacion, setOrientacion] = useState<Orientacion | ''>(opcionValida(OrientacionSchema, tasacion?.orientacion));
  const [cochera, setCochera] = useState(tasacion?.cochera ?? false);
  const [balcon, setBalcon] = useState(tasacion?.balcon ?? false);
  const [terraza, setTerraza] = useState(tasacion?.terraza ?? false);
  const [patio, setPatio] = useState(tasacion?.patio ?? false);
  const [lavadero, setLavadero] = useState(tasacion?.lavadero ?? false);
  const [piscina, setPiscina] = useState(tasacion?.piscina ?? false);
  const [amenities, setAmenities] = useState(tasacion?.amenities.join(', ') ?? '');
  const [detalleAmenities, setDetalleAmenities] = useState(tasacion?.detalleAmenities ?? '');
  const [expensas, setExpensas] = useState(String(tasacion?.expensas ?? ''));
  const [aptoCredito, setAptoCredito] = useState<AptoCredito | ''>(opcionValida(AptoCreditoSchema, tasacion?.aptoCredito));
  const [documentacion, setDocumentacion] = useState<Documentacion | ''>(
    opcionValida(DocumentacionSchema, tasacion?.documentacion),
  );
  const [fotos, setFotos] = useState<TasacionFotoDto[]>(tasacion?.fotos ?? []);

  // Sección 3
  const [fortalezas, setFortalezas] = useState<string[]>(
    opcionesValidas(FortalezaSchema, tasacion?.analisisComercial?.fortalezas),
  );
  const [aspectos, setAspectos] = useState<string[]>(
    opcionesValidas(AspectoSchema, tasacion?.analisisComercial?.aspectos),
  );
  const [demanda, setDemanda] = useState<Nivel | ''>(opcionValida(NivelSchema, tasacion?.analisisComercial?.demanda));
  const [competencia, setCompetencia] = useState<Nivel | ''>(
    opcionValida(NivelSchema, tasacion?.analisisComercial?.competencia),
  );
  const [perfilComprador, setPerfilComprador] = useState<PerfilComprador | ''>(
    opcionValida(PerfilCompradorSchema, tasacion?.analisisComercial?.perfilComprador),
  );
  const [observacionesComerciales, setObservacionesComerciales] = useState(
    tasacion?.analisisComercial?.observacionesComerciales ?? '',
  );

  // Sección 4
  const [comparables, setComparables] = useState<ComparableInput[]>(
    tasacion?.comparables.map(({ usdM2: _usdM2, ...c }) => c) ?? [],
  );

  // Sección 5
  const [valorMinimo, setValorMinimo] = useState(String(tasacion?.valorMinimo ?? ''));
  const [valorRecomendado, setValorRecomendado] = useState(String(tasacion?.valorRecomendado ?? ''));
  const [valorAspiracional, setValorAspiracional] = useState(String(tasacion?.valorAspiracional ?? ''));
  const [margenNegociacion, setMargenNegociacion] = useState(String(tasacion?.margenNegociacion ?? ''));
  const [escenarioRecomendado, setEscenarioRecomendado] = useState<Escenario | ''>(
    opcionValida(EscenarioSchema, tasacion?.escenarioRecomendado),
  );
  const [plazoEstimado, setPlazoEstimado] = useState<PlazoEstimado | ''>(
    opcionValida(PlazoEstimadoSchema, tasacion?.plazoEstimado),
  );

  // Sección 6
  const [estrategia, setEstrategia] = useState<string[]>(
    opcionesValidas(EstrategiaAccionSchema, tasacion?.estrategiaComercial?.estrategia),
  );
  const [observacionesEstrategia, setObservacionesEstrategia] = useState(
    tasacion?.estrategiaComercial?.observacionesEstrategia ?? '',
  );

  const superficieTotalPreview = superficieTotal({
    cubierta: Number(supCubierta) || 0,
    semicubierta: Number(supSemicubierta) || 0,
    descubierta: Number(supDescubierta) || 0,
  });

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
    const comps: ComparableCalc[] = comparables.map((c) => ({ ...c, cocheraComp: c.cochera ? 'Sí' : 'No' }));
    return analizarComparables(comps, propiedad);
  }, [comparables, tipoPropiedad, supCubierta, supSemicubierta, supDescubierta, supTerreno, dormitorios, banos, estadoInmueble, cochera]);

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
    setValorMinimo(String(Math.round(sugerencia.minimo)));
    setValorRecomendado(String(Math.round(sugerencia.recomendado)));
    setValorAspiracional(String(Math.round(sugerencia.aspiracional)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerencia]);

  function datosSeccion1() {
    return { cliente, fecha, direccion, barrio: barrio || null, ciudad: ciudad || null, tipoOperacion };
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
      amenities: amenities
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      detalleAmenities: detalleAmenities || null,
      expensas: expensas ? Number(expensas) : null,
      aptoCredito: aptoCredito || null,
      documentacion: documentacion || null,
    };
  }

  function datosSeccion3() {
    return {
      analisisComercial: {
        fortalezas: fortalezas as Fortaleza[],
        aspectos: aspectos as Aspecto[],
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
    return {
      valorMinimo: valorMinimo ? Number(valorMinimo) : null,
      valorRecomendado: valorRecomendado ? Number(valorRecomendado) : null,
      valorAspiracional: valorAspiracional ? Number(valorAspiracional) : null,
      margenNegociacion: margenNegociacion ? Number(margenNegociacion) : null,
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
   * importar cuál sea la sección activa (si el usuario saltó de "Comparables"
   * directo a "Estrategia", por ejemplo, "Valores" nunca se guardó porque
   * `guardarSeccionActiva` solo manda los datos de la sección activa).
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

  /**
   * Guarda la sección activa: crea la tasación en la sección 1 (primer guardado) o
   * hace un PATCH parcial. `destino` es la sección a la que se quiere navegar después —
   * si esta llamada crea la tasación, `router.replace` cambia de página (/nueva → /[id]/editar)
   * y el componente se remonta, así que el destino viaja en la URL (`?seccion=`) para
   * sobrevivir el remount; si ya existía la tasación, no hay remount y el destino se
   * aplica localmente en el caller.
   */
  async function guardarSeccionActiva(destino: number): Promise<boolean> {
    if (seccionActiva === 1 && (!cliente.trim() || !fecha || !direccion.trim())) {
      setError('Completá cliente, fecha y dirección antes de continuar.');
      return false;
    }

    setError(null);
    setGuardando(true);
    try {
      const accessToken = await getAccessToken();
      if (!tasacionId) {
        const creada = await createTasacion(accessToken, { ...datosSeccion1(), ...datosSeccion2() });
        setTasacionId(creada.id);
        router.replace(`/tasador/tasaciones/${creada.id}/editar?seccion=${destino}`);
      } else {
        await updateTasacion(accessToken, tasacionId, datosDeSeccion(seccionActiva));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la sección.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  /** Guarda TODAS las secciones en un solo PATCH — ver `datosCompletos()`. */
  async function guardarTodo(): Promise<boolean> {
    if (!cliente.trim() || !fecha || !direccion.trim()) {
      setError('Completá cliente, fecha y dirección antes de continuar.');
      return false;
    }

    setError(null);
    setGuardando(true);
    try {
      const accessToken = await getAccessToken();
      if (!tasacionId) {
        const creada = await createTasacion(accessToken, datosCompletos());
        setTasacionId(creada.id);
        router.replace(`/tasador/tasaciones/${creada.id}/editar`);
      } else {
        await updateTasacion(accessToken, tasacionId, datosCompletos());
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar la tasación.');
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function irA(seccion: number) {
    if (seccion === seccionActiva) return;
    const habiaId = !!tasacionId;
    const ok = await guardarSeccionActiva(seccion);
    if (ok && habiaId) setSeccionActiva(seccion);
  }

  async function handleSiguiente() {
    if (seccionActiva >= SECCIONES.length) return;
    const habiaId = !!tasacionId;
    const ok = await guardarSeccionActiva(seccionActiva + 1);
    if (ok && habiaId) setSeccionActiva(seccionActiva + 1);
  }

  function handleAnterior() {
    setError(null);
    if (seccionActiva > 1) setSeccionActiva(seccionActiva - 1);
  }

  async function handleGenerarInforme() {
    const ok = await guardarTodo();
    if (!ok || !tasacionId) return;
    setGenerandoInforme(true);
    try {
      const accessToken = await getAccessToken();
      const { url } = await generarInforme(accessToken, tasacionId);
      window.open(url, '_blank', 'noopener,noreferrer');
      router.push('/tasador/tasaciones');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el informe.');
    } finally {
      setGenerandoInforme(false);
    }
  }

  async function handleFinalizar() {
    const ok = await guardarTodo();
    if (ok) router.push('/tasador/tasaciones');
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-brand border border-line bg-white lg:min-h-[calc(100vh-8rem)] lg:flex-row">
      <WizardSidebar activa={seccionActiva} onCambiar={irA} error={error} />

      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
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
            />
          )}
          {seccionActiva === 3 && (
            <Seccion3Analisis
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
            <Seccion4Comparables comparables={comparables} setComparables={setComparables} analisis={analisisComparables} />
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

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-4 py-3 sm:px-6">
          <Button type="button" variant="secondary" onClick={() => router.push('/tasador/tasaciones')}>
            Cancelar
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            {seccionActiva > 1 && (
              <Button type="button" variant="secondary" onClick={handleAnterior} disabled={guardando}>
                ← Anterior
              </Button>
            )}
            {seccionActiva < SECCIONES.length ? (
              <Button type="button" variant="primary" onClick={handleSiguiente} disabled={guardando}>
                {guardando ? 'Guardando…' : 'Siguiente →'}
              </Button>
            ) : (
              <>
                <Button type="button" variant="secondary" onClick={handleFinalizar} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar y salir'}
                </Button>
                <Button type="button" variant="primary" onClick={handleGenerarInforme} disabled={generandoInforme}>
                  {generandoInforme ? 'Generando…' : 'Generar informe (PDF)'}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
