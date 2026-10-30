import { describe, expect, it } from 'vitest';
import { bs, formatearBs, validarMonto } from './dinero.ts';

describe('dinero', () => {
  it('convierte Bs a centavos sin errores de redondeo', () => {
    expect(bs(15)).toBe(1500);
    expect(bs(11.5)).toBe(1150);
    expect(bs(0.1) + bs(0.2)).toBe(bs(0.3));
  });

  it('formatea montos al estilo boliviano', () => {
    expect(formatearBs(1500)).toBe('Bs 15,00');
    expect(formatearBs(210050)).toBe('Bs 2.100,50');
    expect(formatearBs(-250)).toBe('-Bs 2,50');
    expect(formatearBs(0)).toBe('Bs 0,00');
  });

  it('rechaza montos negativos o con fracción de centavo', () => {
    expect(() => validarMonto(-1, 'Precio')).toThrow(/Precio/);
    expect(() => validarMonto(10.5, 'Precio')).toThrow();
    expect(() => bs(Number.NaN)).toThrow();
  });
});
