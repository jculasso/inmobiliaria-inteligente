'use client';

import { useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Un estado local que arranca con lo que mandó el servidor y se vuelve a
 * alinear cuando el servidor manda otra cosa.
 *
 * `useState(inicial)` mira la prop una sola vez, al montar. Después de un
 * `router.refresh()` el componente sigue montado, recibe la prop nueva y la
 * ignora: la firma del contrato seguía diciendo «Todavía no se cargó el PDF»
 * después de generarlo desde la plantilla, hasta recargar la página (prueba
 * en producción, 6/10/2026).
 *
 * Compara por contenido, no por identidad: cada refresh trae objetos nuevos
 * aunque digan lo mismo, y realinear por eso borraría lo que se está
 * editando cada vez que otro panel de la página guarda algo.
 */
export function useEstadoDelServidor<T>(delServidor: T): [T, Dispatch<SetStateAction<T>>] {
  const firma = JSON.stringify(delServidor);
  const [valor, setValor] = useState(delServidor);
  const [firmaVista, setFirmaVista] = useState(firma);
  if (firma !== firmaVista) {
    // Durante el render, como recomienda React para derivar de una prop: sin
    // un render intermedio con el dato viejo.
    setFirmaVista(firma);
    setValor(delServidor);
  }
  return [valor, setValor];
}
