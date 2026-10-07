import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputImporteNumero } from './input-importe';

describe('InputImporte', () => {
  // Prueba en producción, 6/10/2026: el informe de garantía nuevo venía en
  // «0,00», el cursor quedaba al final y «30000» terminaba en «0,0030000» = 0.
  it('en cero, entrar al campo lo selecciona entero y lo escrito lo reemplaza', async () => {
    const onValor = vi.fn();
    render(<InputImporteNumero aria-label="Importe" valor={0} onValor={onValor} />);
    const campo = screen.getByLabelText('Importe') as HTMLInputElement;
    expect(campo).toHaveValue('0,00');
    await userEvent.click(campo);
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([0, 4]);
    await userEvent.keyboard('30000');
    expect(campo).toHaveValue('30000');
    expect(onValor).toHaveBeenLastCalledWith(30_000);
  });

  it('con un importe, entrar no lo selecciona: se corrige donde se toca', () => {
    render(<InputImporteNumero aria-label="Importe" valor={1500} onValor={vi.fn()} />);
    const campo = screen.getByLabelText('Importe') as HTMLInputElement;
    campo.setSelectionRange(2, 2);
    fireEvent.focus(campo);
    expect([campo.selectionStart, campo.selectionEnd]).toEqual([2, 2]);
  });
});
