import { describe, expect, it } from 'vitest';
import { bs, formatearBs, parsearBs, validarMonto } from './dinero.ts';

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

  it('lee montos escritos por el cajero', () => {
    expect(parsearBs('150')).toBe(15000);
    expect(parsearBs('150,5')).toBe(15050);
    expect(parsearBs('1.234,50')).toBe(123450);
    expect(parsearBs('Bs 20')).toBe(2000);
    expect(parsearBs('12.5')).toBe(1250);
    expect(parsearBs('1.200')).toBe(120000);
  });

  it('rechaza montos vacíos, negativos o con letras', () => {
    expect(() => parsearBs('')).toThrow(/Ingrese/);
    expect(() => parsearBs('-5')).toThrow(/inválido/);
    expect(() => parsearBs('veinte')).toThrow(/inválido/);
    expect(() => parsearBs('1,234,5')).toThrow(/inválido/);
  });
});
