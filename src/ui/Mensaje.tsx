import type { ReactNode } from 'react';

export function Mensaje({ tipo, children }: { tipo: 'error' | 'ok' | 'aviso'; children: ReactNode }) {
  return (
    <p className={`mensaje mensaje-${tipo}`} role={tipo === 'error' ? 'alert' : 'status'}>
      {children}
    </p>
  );
}
