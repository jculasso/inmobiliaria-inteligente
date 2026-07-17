'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OperacionDto, TipoOperacion, VendedorDto } from '@vacker/types';
import { Button } from '@vacker/ui';
import { getAccessToken } from '../../lib/supabase/client';
import { deleteOperacion } from '../../lib/tablero-api';
import { fmtUSD } from '../../lib/format';
import { ConfirmDeleteButton } from './confirm-delete-button';
import { OperacionFormModal } from './operacion-form-modal';

function estadoClass(estado: string): string {
  return estado === 'escriturada' || estado === 'firmado'
    ? 'bg-success/10 text-success'
    : 'bg-brand-red/10 text-brand-red';
}

interface Props {
  tipo: TipoOperacion;
  operaciones: OperacionDto[];
  vendedores: VendedorDto[];
  puedeBorrar: boolean;
}

export function OperacionesTable({ tipo, operaciones, vendedores, puedeBorrar }: Props) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useState('');
  const [modal, setModal] = useState<'create' | OperacionDto | null>(null);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return operaciones;
    return operaciones.filter((op) => {
      const nombresPuntas = op.puntas.map((p) => p.nombre.toLowerCase()).join(' ');
      return (
        op.direccion.toLowerCase().includes(q) ||
        op.estado.toLowerCase().includes(q) ||
        nombresPuntas.includes(q)
      );
    });
  }, [operaciones, busqueda]);

  async function handleDelete(id: string) {
    const accessToken = await getAccessToken();
    await deleteOperacion(accessToken, id);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder={tipo === 'venta' ? 'Buscar por dirección, vendedor o estado…' : 'Buscar por dirección…'}
          className="h-9 w-full max-w-sm rounded-brand border border-line px-3 text-sm text-ink outline-none focus:border-brand-red"
        />
        <div className="flex items-center gap-3">
          <span className="whitespace-nowrap text-xs text-muted">
            {filtradas.length} de {operaciones.length} operaciones
          </span>
          <Button variant="primary" size="sm" onClick={() => setModal('create')}>
            ＋ {tipo === 'venta' ? 'Nueva venta' : 'Nuevo alquiler'}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-brand border border-line bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-2">Código</th>
              <th className="px-4 py-2">Firma</th>
              <th className="px-4 py-2">Dirección</th>
              {tipo === 'venta' ? (
                <>
                  <th className="px-4 py-2">Precio</th>
                  <th className="px-4 py-2">Ptas</th>
                  <th className="px-4 py-2">Vendedora</th>
                  <th className="px-4 py-2">Compradora</th>
                </>
              ) : (
                <th className="px-4 py-2">Valor/mes</th>
              )}
              <th className="px-4 py-2">Comisión</th>
              <th className="px-4 py-2">Estado</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {filtradas.length === 0 ? (
              <tr>
                <td colSpan={tipo === 'venta' ? 10 : 7} className="px-4 py-6 text-center text-muted">
                  Sin operaciones para mostrar.
                </td>
              </tr>
            ) : (
              filtradas.map((op) => {
                const vend = op.puntas.find((p) => p.lado === 'vendedora');
                const comp = op.puntas.find((p) => p.lado === 'compradora');
                return (
                  <tr key={op.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-2 text-muted">{op.codigo}</td>
                    <td className="px-4 py-2">{op.fechaFirma ?? '—'}</td>
                    <td className="px-4 py-2">{op.direccion}</td>
                    {tipo === 'venta' ? (
                      <>
                        <td className="px-4 py-2">{fmtUSD(op.precio)}</td>
                        <td className="px-4 py-2">{op.cantPuntas}</td>
                        <td className="px-4 py-2">{vend?.nombre ?? '—'}</td>
                        <td className="px-4 py-2">{comp?.nombre ?? '—'}</td>
                      </>
                    ) : (
                      <td className="px-4 py-2">{fmtUSD(op.valorMensual)}</td>
                    )}
                    <td className="px-4 py-2">{fmtUSD(op.comTotal)}</td>
                    <td className="px-4 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${estadoClass(op.estado)}`}>
                        {op.estado}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModal(op)}
                          aria-label="Editar"
                          className="rounded px-1.5 py-0.5 text-base hover:bg-surface"
                        >
                          ✏️
                        </button>
                        {puedeBorrar && (
                          <ConfirmDeleteButton
                            confirmMessage={`¿Borrar la operación ${op.codigo}?`}
                            onConfirm={() => handleDelete(op.id)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <OperacionFormModal
          tipo={tipo}
          vendedores={vendedores}
          operacion={modal === 'create' ? undefined : modal}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
