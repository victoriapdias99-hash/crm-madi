import { z } from "zod";

/**
 * Schema de validación para registro de usuarios
 */
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "El nombre de usuario debe tener al menos 3 caracteres")
    .max(50, "El nombre de usuario no puede exceder 50 caracteres")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "El nombre de usuario solo puede contener letras, números y guiones bajos",
    ),
  password: z
    .string()
    .min(6, "La contraseña debe tener al menos 6 caracteres")
    .max(100, "La contraseña no puede exceder 100 caracteres"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  role: z.enum(["admin", "user"]).default("user"),
});

/**
 * Schema de validación para login de usuarios
 */
export const loginSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

/**
 * Tipos TypeScript derivados de los schemas
 */
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Tipo de usuario sin el password (para respuestas)
 */
export interface UserResponse {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
}
