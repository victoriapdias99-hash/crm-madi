import { z } from 'zod';

/**
 * DTO para crear un lead desde webhook
 */
export const CreateWebhookLeadDto = z.object({
  nombre: z.string().min(1, 'El nombre es requerido'),
  telefono: z.string().min(1, 'El teléfono es requerido'),
  auto: z.string().optional().nullable(),
  localidad: z.string().optional().nullable(),
  comentarios: z.string().optional().nullable(),
  source: z.string().default('webhook')
});

export type CreateWebhookLeadDto = z.infer<typeof CreateWebhookLeadDto>;

/**
 * DTO de respuesta para un lead creado
 */
export interface WebhookLeadResponseDto {
  id: number;
  nombre: string;
  telefono: string;
  auto?: string | null;
  localidad?: string | null;
  comentarios?: string | null;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * DTO de respuesta exitosa
 */
export interface WebhookSuccessResponseDto {
  success: true;
  leadId: number;
  message: string;
  data: WebhookLeadResponseDto;
}

/**
 * DTO de respuesta de error
 */
export interface WebhookErrorResponseDto {
  success: false;
  error: string;
  details?: any;
}
