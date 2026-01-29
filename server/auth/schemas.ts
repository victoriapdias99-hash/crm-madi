import { z } from "zod";

export const UserRole = {
  ADMIN: "admin",
  GERENTE: "gerente",
  ASESOR: "asesor",
} as const;

/**
 * Schema de validación para registro de usuarios
 */
export const baseUserSchema = z.object({
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
});

// SCHEMA PARA CREAR GERENTE (por Admin)
export const createGerenteSchema = baseUserSchema.extend({
  role: z.literal(UserRole.GERENTE).default(UserRole.GERENTE),
  // Se agrega automáticamente en el backend:
  // - createdBy (ID del admin)
});

// SCHEMA PARA CREAR ASESOR (por Gerente)
export const createAsesorSchema = baseUserSchema.extend({
  role: z.literal(UserRole.ASESOR).default(UserRole.ASESOR),
  // Se agrega automáticamente en el backend:
  // - createdBy (ID del gerente)
  // - parentGerenteId (ID del gerente)
});

//export const registerSchema = z.object({
//username: z
//.string()
//.min(3, "El nombre de usuario debe tener al menos 3 caracteres")
//.max(50, "El nombre de usuario no puede exceder 50 caracteres")
//.regex(
///^[a-zA-Z0-9_]+$/,
//"El nombre de usuario solo puede contener letras, números y guiones bajos",
//),
//password: z
//.string()
//.min(6, "La contraseña debe tener al menos 6 caracteres")
//.max(100, "La contraseña no puede exceder 100 caracteres"),
//email: z.string().email("Email inválido").optional().or(z.literal("")),
//role: z.enum(["admin", "user"]).default("user"),
//});

/**
 * Schema de validación para login de usuarios
 */
export const loginSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

// Ya NO se usa, pero lo dejamos por compatibilidad
export const registerSchema = baseUserSchema.extend({
  role: z
    .enum([UserRole.ADMIN, UserRole.GERENTE, UserRole.ASESOR])
    .default(UserRole.GERENTE),
});

/**
 * Tipos TypeScript derivados de los schemas
 */
export type CreateGerenteInput = z.infer<typeof createGerenteSchema>;
export type CreateAsesorInput = z.infer<typeof createAsesorSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Tipo de usuario sin el password (para respuestas)
 */
export interface UserResponse {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdBy: number | null;
  parentGerenteId: number | null;
  createdAt: Date;
}

// TIPO EXTENDIDO CON INFO DEL CREADOR
export interface UserResponseWithCreator extends UserResponse {
  createdByUser?: {
    id: number;
    username: string;
    role: string;
  } | null;
  parentGerente?: {
    id: number;
    username: string;
  } | null;
}

// VALIDACIONES ADICIONALES
/**
 * Valida si un usuario puede crear otro usuario
 */
export function validateCanCreateUser(
  creatorRole: string,
  targetRole: string,
): { valid: boolean; error?: string } {
  // Admin puede crear gerentes
  if (creatorRole === UserRole.ADMIN && targetRole === UserRole.GERENTE) {
    return { valid: true };
  }

  // Gerente puede crear asesores
  if (creatorRole === UserRole.GERENTE && targetRole === UserRole.ASESOR) {
    return { valid: true };
  }

  return {
    valid: false,
    error: `Rol ${creatorRole} no puede crear usuarios de tipo ${targetRole}`,
  };
}

/**
 * Valida si un usuario puede acceder a los leads de otro
 */
export function validateCanAccessLeads(
  userRole: string,
  userId: number,
  leadGerenteId: number | null,
  userParentGerenteId: number | null,
): boolean {
  // Admin ve todo
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Gerente ve sus propios leads
  if (userRole === UserRole.GERENTE && leadGerenteId === userId) {
    return true;
  }

  // Asesor ve los leads de su gerente
  if (
    userRole === UserRole.ASESOR &&
    userParentGerenteId &&
    leadGerenteId === userParentGerenteId
  ) {
    return true;
  }

  return false;
}
