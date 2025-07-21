// Utilidad global para manejar CPL storage
export const CPLStorage = {
  get: (cliente: string, numeroCampana: string): number => {
    const key = `${cliente}-${numeroCampana}`;
    const stored = localStorage.getItem(`cpl_${key}`);
    return stored ? parseFloat(stored) : 0;
  },
  
  set: (cliente: string, numeroCampana: string, cpl: number): void => {
    const key = `${cliente}-${numeroCampana}`;
    localStorage.setItem(`cpl_${key}`, cpl.toString());
  },
  
  has: (cliente: string, numeroCampana: string): boolean => {
    const key = `${cliente}-${numeroCampana}`;
    return localStorage.getItem(`cpl_${key}`) !== null;
  }
};