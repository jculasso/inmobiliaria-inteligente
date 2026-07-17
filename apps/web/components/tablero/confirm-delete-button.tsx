'use client';

import { useState } from 'react';

export function ConfirmDeleteButton({
  confirmMessage,
  onConfirm,
  label = '🗑️',
}: {
  confirmMessage: string;
  onConfirm: () => Promise<void>;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (!window.confirm(confirmMessage)) return;
    setLoading(true);
    try {
      await onConfirm();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="Borrar"
      className="rounded px-1.5 py-0.5 text-base hover:bg-surface disabled:opacity-50"
    >
      {label}
    </button>
  );
}
