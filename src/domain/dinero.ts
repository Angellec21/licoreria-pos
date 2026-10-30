/**
 * Los montos se manejan en centavos (enteros) para evitar errores de
 * redondeo de punto flotante. Solo se convierten a Bs al mostrarlos.
 */
export type Centavos = number;

export function bs(monto: number): Centavos {
  if (!Number.isFinite(monto)) throw new Error('Monto inválido');
  return Math.round(monto * 100);
}

export function formatearBs(centavos: Centavos): string {
  const signo = centavos < 0 ? '-' : '';
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimales = (abs % 100).toString().padStart(2, '0');
  return `${signo}Bs ${enteros},${decimales}`;
}

export function validarMonto(centavos: Centavos, campo: string): void {
  if (!Number.isInteger(centavos) || centavos < 0) {
    throw new Error(`${campo} debe ser un monto entero en centavos y no negativo`);
  }
}
