import type { CuentaCorrienteDto, EventoDto, PersonaDto, PersonaFichaDto } from '@vacker/types';
import { NOMBRE_CONDICION_IVA, NOMBRE_ESTADO_CIVIL, NOMBRE_TIPO_CONTRATO } from '@vacker/types';
import Link from 'next/link';
import { Button, KpiCard } from '@vacker/ui';
import { fmtFecha, fmtMoneda } from '../../lib/format';
import { EstadoContratoBadge } from './estado-contrato';
import { Historial } from './historial';
import { documentoLegible } from './personas-lista';
import { Bloque, Panel } from './piezas';

export type Solapa = 'resumen' | 'basica' | 'administrativa' | 'complementarios' | 'cuenta';

const SOLAPAS: [Solapa, string][] = [
  ['resumen', '📋 Resumen'],
  ['basica', '🪪 Información básica'],
  ['administrativa', '🏦 Gestión administrativa'],
  ['complementarios', '📇 Datos complementarios'],
  ['cuenta', '📒 Cuenta corriente'],
];

/** Las solapas de la ficha, como las de «Clientes» en Gexion y las pestañas del Tablero Comercial. */
export function Solapas({ actual, onCambiar }: { actual: Solapa; onCambiar: (s: Solapa) => void }) {
  return (
    <div role="tablist" className="flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {SOLAPAS.map(([s, texto]) => (
        <button
          key={s}
          role="tab"
          type="button"
          aria-selected={actual === s}
          onClick={() => onCambiar(s)}
          className={`shrink-0 whitespace-nowrap rounded-brand px-3 py-2 text-sm font-semibold ${actual === s ? 'bg-brand-red text-white' : 'bg-white text-muted hover:text-ink'}`}
        >
          {texto}
        </button>
      ))}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-extrabold uppercase tracking-wide text-muted">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm text-ink">{children || '—'}</dd>
    </div>
  );
}

const cuitLegible = (c: string | null) => (c ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : null);

/** El resumen: lo que debe o se le debe, sus contratos y lo último que pasó. */
export function ResumenPersona({ cuenta, ficha, historial }: { cuenta: CuentaCorrienteDto; ficha: PersonaFichaDto; historial: EventoDto[] }) {
  const vigentes = ficha.contratos.filter((c) => c.estado === 'vigente');
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cuenta.monedas.map((m) => (
          <div key={m.moneda} className="col-span-2 sm:col-span-1">
            <KpiCard
              label={`Saldo en ${m.moneda === 'ARS' ? 'pesos' : 'dólares'}`}
              value={Math.abs(m.saldo) < 0.005 ? 'Al día' : fmtMoneda(Math.abs(m.saldo), m.moneda)}
              sub={m.saldo >= 0.005 ? 'debe' : m.saldo <= -0.005 ? 'a su favor' : undefined}
              icon="💰"
              tone={m.saldo > 0 ? 'warning' : 'success'}
            />
          </div>
        ))}
        <KpiCard label="Contratos vigentes" value={String(vigentes.length)} sub={`${ficha.contratos.length} en total`} icon="📄" />
        <KpiCard label="Cuentas bancarias" value={String(ficha.cuentas.length)} sub={ficha.cuentas.find((c) => c.principal)?.banco ?? 'sin cargar'} icon="🏦" />
      </div>
      <Bloque icono="📄" titulo="Contratos" detalle={`${ficha.contratos.length}`}>
        {ficha.contratos.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">No aparece en ningún contrato.</p>
        ) : (
          <ul className="divide-y divide-line text-sm">
            {ficha.contratos.map((c) => (
              <li key={`${c.id}-${c.papel}`}>
                <Link href={`/alquileres/contratos/${c.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface/60">
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">
                      <span className="mr-1.5 rounded bg-ink/5 px-1.5 py-0.5 text-[10px] font-extrabold text-muted">{c.papel === 'inquilino' ? 'INQ' : c.papel === 'propietario' ? 'PROP' : 'GAR'}</span>
                      {c.codigo} · {c.propiedad}
                    </span>
                    <span className="block text-xs text-muted">
                      {NOMBRE_TIPO_CONTRATO[c.tipo]} · {fmtFecha(c.inicio)} al {fmtFecha(c.fin)}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {c.importeVigente != null && <span className="whitespace-nowrap font-semibold tabular-nums text-ink">{fmtMoneda(c.importeVigente, c.moneda)}</span>}
                    <EstadoContratoBadge estado={c.estado} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Bloque>
      <Historial eventos={historial} />
    </>
  );
}

/** Información básica: identidad fiscal, IVA, domicilio y contacto. */
export function InformacionBasica({ persona: p, onEditar }: { persona: PersonaDto; onEditar: () => void }) {
  return (
    <Panel
      icono="🪪"
      titulo="Información básica"
      derecha={
        <Button variant="secondary" size="sm" onClick={onEditar}>
          ✏️ Editar
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <Dato etiqueta="Tipo">{p.tipo === 'juridica' ? 'Empresa' : 'Persona física'}</Dato>
        <Dato etiqueta={p.tipo === 'juridica' ? 'CUIT' : 'DNI'}>{p.documento ? documentoLegible(p.documento) : null}</Dato>
        <Dato etiqueta="CUIT / CUIL">{cuitLegible(p.cuit)}</Dato>
        <Dato etiqueta="Condición de IVA">{p.condicionIva ? NOMBRE_CONDICION_IVA[p.condicionIva] : null}</Dato>
        <Dato etiqueta="Domicilio">{p.domicilio}</Dato>
        <Dato etiqueta="Localidad">{[p.localidad, p.provincia].filter(Boolean).join(', ')}</Dato>
        <Dato etiqueta="Código postal">{p.codigoPostal}</Dato>
        <Dato etiqueta="Email">{p.email}</Dato>
        <Dato etiqueta="Teléfono">{p.telefono}</Dato>
      </dl>
      {p.obs && <p className="mt-3 whitespace-pre-line text-sm text-muted">{p.obs}</p>}
    </Panel>
  );
}

/** Datos personales de una persona física (Gexion, «Datos complementarios»). */
export function DatosPersonales({ persona: p, onEditar }: { persona: PersonaDto; onEditar: () => void }) {
  if (p.tipo === 'juridica') return null;
  return (
    <Panel
      icono="👤"
      titulo="Datos personales"
      derecha={
        <Button variant="secondary" size="sm" onClick={onEditar}>
          ✏️ Editar
        </Button>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Dato etiqueta="Fecha de nacimiento">{p.fechaNacimiento ? fmtFecha(p.fechaNacimiento) : null}</Dato>
        <Dato etiqueta="Nacionalidad">{p.nacionalidad}</Dato>
        <Dato etiqueta="Estado civil">{p.estadoCivil ? NOMBRE_ESTADO_CIVIL[p.estadoCivil] : null}</Dato>
      </dl>
    </Panel>
  );
}
