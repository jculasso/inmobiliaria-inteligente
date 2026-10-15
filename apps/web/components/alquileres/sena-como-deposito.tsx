import type { MonedaAlquiler, SenaDto } from '@vacker/types';
import { fmtMoneda } from '../../lib/format';

/**
 * Regla 170 (Florencia, Vacker, 15/10/2026): al convertir una reserva, «la
 * seña pasa a ser el depósito en garantía». La pantalla de conversión dice
 * qué pasa con la diferencia antes de guardar: si el depósito es mayor, lo
 * que falta se propone como cargo de ingreso; si es menor, lo que sobra se le
 * reintegra al inquilino. En otra moneda no se puede.
 */
export function SenaComoDeposito({
  sena,
  deposito,
  moneda,
}: {
  sena: SenaDto;
  deposito: number | null;
  moneda: MonedaAlquiler;
}) {
  if (!sena.recibida) return null;
  const s = fmtMoneda(sena.importe, sena.moneda);
  const importe = deposito ?? 0;
  const diferencia = Math.round((importe - sena.importe) * 100) / 100;
  const otraMoneda = importe > 0 && moneda !== sena.moneda;
  return (
    <p
      role="status"
      className={`rounded-brand border px-3 py-2 text-sm text-ink sm:col-span-2 ${
        otraMoneda ? 'border-danger/30 bg-danger/5' : 'border-line bg-surface/60'
      }`}
    >
      <span aria-hidden className="mr-1.5">
        🔖
      </span>
      {otraMoneda
        ? `La seña es de ${s} y el depósito está en ${moneda === 'USD' ? 'dólares' : 'pesos'}: tienen que ser de la misma moneda, porque la seña pasa a ser el depósito.`
        : diferencia > 0
          ? `La seña de ${s} pasa a ser el depósito. Faltan ${fmtMoneda(diferencia, sena.moneda)}: se proponen como cargo de ingreso al activar el contrato.`
          : diferencia < 0
            ? `La seña de ${s} pasa a ser el depósito${importe ? ` de ${fmtMoneda(importe, sena.moneda)}` : ''}. Sobran ${fmtMoneda(-diferencia, sena.moneda)}: al guardar, se le reintegran al inquilino (quedan a su favor).`
            : `La seña de ${s} pasa a ser el depósito: ya está cobrado.`}
    </p>
  );
}
