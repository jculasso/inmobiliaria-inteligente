import type { ReactNode } from 'react';
import { MarcoModulo, principalDelModulo } from '../../components/marco-modulo';

export default async function TodoLayout({ children }: { children: ReactNode }) {
  const r = await principalDelModulo('todo', 'To Do List');
  if (!r) return null;
  if ('pantalla' in r) return r.pantalla;
  const { principal } = r;
  /* Alto fijo a la pantalla: el calendario tiene que entrar entero, y lo que
     scrollea es la grilla de horas por dentro, no la página. `dvh` y no `vh`
     porque en el celular la barra del navegador cambia el alto real. */
  return (
    <MarcoModulo
      principal={principal}
      titulo="To Do List"
      className="mx-auto flex h-dvh max-w-4xl flex-col px-4 py-4 sm:px-6 sm:py-10"
      contenido="mt-6 flex min-h-0 flex-1 flex-col"
    >
      {children}
    </MarcoModulo>
  );
}
