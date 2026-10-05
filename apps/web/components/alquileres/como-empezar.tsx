import Link from 'next/link';
import type { ResumenAlquileres } from '@vacker/types';

/**
 * Lo que ve una inmobiliaria que recién prendió el módulo (regla 32 de la spec):
 * los pasos para empezar, no un tablero en cero. Los pasos se marcan a medida
 * que se cumplen.
 */
export function ComoEmpezar({ resumen }: { resumen: ResumenAlquileres }) {
  const pasos = [
    {
      titulo: 'Cargá a los propietarios e inquilinos',
      detalle: 'Con su documento y un contacto. La misma persona puede ser propietaria de un contrato e inquilina de otro.',
      hecho: resumen.personas > 0,
      href: '/alquileres/personas',
    },
    {
      titulo: 'Cargá las propiedades',
      detalle: 'La unidad que se alquila: dirección, piso y departamento.',
      hecho: resumen.propiedades > 0,
      href: '/alquileres/propiedades',
    },
    {
      titulo: 'Cargá los contratos',
      detalle: 'Con sus tramos, el índice de ajuste, los honorarios y los gastos administrativos.',
      hecho: resumen.contratos > 0,
      href: null,
    },
  ];

  return (
    <section className="max-w-2xl rounded-brand border border-line bg-white p-6">
      <h2 className="text-lg font-extrabold text-ink">Empecemos por los contratos</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        Todavía no hay contratos cargados. Cuando estén, acá vas a ver la cartera: cobranza del mes,
        morosidad, vencimientos e indexaciones pendientes.
      </p>
      <ol className="mt-5 flex flex-col gap-3">
        {pasos.map((p, i) => (
          <li key={p.titulo} className="flex gap-3">
            <span
              aria-hidden
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                p.hecho ? 'bg-success text-white' : 'bg-surface text-muted'
              }`}
            >
              {p.hecho ? '✓' : i + 1}
            </span>
            <span>
              <span className="block text-sm font-bold text-ink">
                {p.href ? (
                  <Link href={p.href} className="hover:text-brand-red hover:underline">
                    {p.titulo} →
                  </Link>
                ) : (
                  p.titulo
                )}
                {p.hecho && <span className="sr-only"> (hecho)</span>}
              </span>
              <span className="block text-sm text-muted">{p.detalle}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-xs text-muted">
        La carga de contratos llega en la próxima entrega del módulo.
      </p>
    </section>
  );
}
