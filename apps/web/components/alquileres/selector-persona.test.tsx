import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { CandidatoDto } from '@vacker/types';
import { SelectorPersona } from './selector-persona';

const c = (id: string, nombre: string, papel: CandidatoDto['papel'], codigo: string, propiedad: string, deuda = 0): CandidatoDto => ({
  persona: { id, nombre },
  papel,
  contratos: [{ id: `c-${id}`, codigo, propiedad }],
  pendiente: deuda ? [{ moneda: 'ARS', importe: deuda }] : [],
});
const INQUILINOS = [c('1', 'Romina Inquilina', 'inquilino', 'ALT-0005', 'Mendoza 3340', 650_000), c('2', 'Pedro Al Día', 'inquilino', 'ALT-0002', 'Paraguay 925')];
const PROPIETARIOS = [c('3', 'Juan Dueño', 'propietario', 'ALT-0005', 'Mendoza 3340')];

describe('SelectorPersona (punto 6 de Javier)', () => {
  it('muestra INQ, los contratos y lo que deben; busca por dirección o número', () => {
    render(<SelectorPersona etiqueta="Quién paga" opciones={INQUILINOS} pendienteRotulo="debe" value="" onChange={vi.fn()} />);
    const lista = within(screen.getByRole('listbox', { name: 'Quién paga' }));
    expect(lista.getAllByRole('option')).toHaveLength(2);
    expect(lista.getAllByText('INQ')).toHaveLength(2);
    expect(lista.getByText('$ 650.000')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Nombre, dirección/), { target: { value: 'paraguay' } });
    expect(lista.getAllByRole('option')).toHaveLength(1);
    expect(lista.getByText('Pedro Al Día')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Nombre, dirección/), { target: { value: '0005' } });
    expect(lista.getByText('Romina Inquilina')).toBeInTheDocument();
  });

  it('los propietarios solo aparecen si se piden', () => {
    render(<SelectorPersona etiqueta="Quién paga" opciones={INQUILINOS} otros={PROPIETARIOS} textoOtros="Incluir propietarios" pendienteRotulo="debe" value="" onChange={vi.fn()} />);
    expect(screen.queryByText('Juan Dueño')).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Incluir propietarios'));
    expect(screen.getByText('Juan Dueño')).toBeInTheDocument();
    expect(screen.getByText('PROP')).toBeInTheDocument();
  });

  it('elegir deja a la persona a la vista, con «Cambiar»', () => {
    const onChange = vi.fn();
    const { rerender } = render(<SelectorPersona etiqueta="Quién paga" opciones={INQUILINOS} pendienteRotulo="debe" value="" onChange={onChange} />);
    fireEvent.click(screen.getByText('Romina Inquilina'));
    expect(onChange).toHaveBeenCalledWith('1');
    rerender(<SelectorPersona etiqueta="Quién paga" opciones={INQUILINOS} pendienteRotulo="debe" value="1" onChange={onChange} />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
  });
});
