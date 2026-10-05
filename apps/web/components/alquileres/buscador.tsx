import { inputClass } from '../form-ui';

/**
 * Normaliza para buscar: sin mayúsculas, sin acentos y sin puntos ni guiones,
 * así «perez» encuentra a «Pérez» y «20123456» encuentra «20.123.456».
 */
export function paraBuscar(texto: string | null | undefined): string {
  return (texto ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[.-]/g, '');
}

export function Buscador({
  valor,
  onChange,
  placeholder,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="search"
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`${inputClass} sm:max-w-sm`}
    />
  );
}
