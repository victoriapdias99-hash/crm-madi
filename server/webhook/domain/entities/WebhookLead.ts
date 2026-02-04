/**
 * Entidad de dominio para leads recibidos via webhook
 */
export class WebhookLead {
  constructor(
    public readonly id: number,
    public readonly nombre: string,
    public readonly telefono: string,
    public readonly auto?: string | null,
    public readonly localidad?: string | null,
    public readonly cliente?: string | null, //  Nuevo campo
    public readonly comentarios?: string | null,
    public readonly source: string = "webhook",
    public readonly createdAt?: Date,
    public readonly updatedAt?: Date,
    public readonly fechaCreacion?: Date,
  ) {}

  /**
   * Valida que el lead tenga los datos mínimos requeridos
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.nombre || this.nombre.trim().length === 0) {
      errors.push("El nombre es requerido");
    }

    if (!this.telefono || this.telefono.trim().length === 0) {
      errors.push("El teléfono es requerido");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Normaliza el número de teléfono removiendo caracteres especiales
   */
  static normalizePhone(phone: string): string {
    return phone.replace(/[^\d]/g, "");
  }
}
