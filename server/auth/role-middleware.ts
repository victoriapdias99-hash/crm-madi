import { Request, Response, NextFunction } from "express";

export const UserRole = {
  ADMIN: "admin",
  GERENTE: "gerente",
  ASESOR: "asesor",
} as const;

/**
 * Middleware para verificar que el usuario esté autenticado
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Debes iniciar sesión.",
    });
  }
  next();
}

/**
 * Middleware para verificar que el usuario tenga rol de administrador
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Debes iniciar sesión.",
    });
  }

  if (req.session.role !== UserRole.ADMIN) {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado. Se requieren permisos de administrador.",
    });
  }

  next();
}

/**
 * Middleware para verificar que el usuario sea gerente
 */
export function requireGerente(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Debes iniciar sesión.",
    });
  }

  if (req.session.role !== UserRole.GERENTE) {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado. Se requieren permisos de gerente.",
    });
  }

  next();
}

/**
 * Middleware para verificar que el usuario sea admin o gerente
 */
export function requireAdminOrGerente(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({
      success: false,
      message: "No autorizado. Debes iniciar sesión.",
    });
  }

  const role = req.session.role;
  if (role !== UserRole.ADMIN && role !== UserRole.GERENTE) {
    return res.status(403).json({
      success: false,
      message:
        "Acceso denegado. Se requieren permisos de administrador o gerente.",
    });
  }

  next();
}

// HELPERS: Verificación de Roles
// ============================================================

/**
 * Helper para verificar si un usuario es admin
 */
export function isAdmin(req: Request): boolean {
  return req.session?.role === UserRole.ADMIN;
}

/**
 * Helper para verificar si un usuario es gerente
 */
export function isGerente(req: Request): boolean {
  return req.session?.role === UserRole.GERENTE;
}

/**
 * Helper para verificar si un usuario es asesor
 */
export function isAsesor(req: Request): boolean {
  return req.session?.role === UserRole.ASESOR;
}

/**
 * Helper para obtener el rol del usuario actual
 */
export function getUserRole(req: Request): string | undefined {
  return req.session?.role;
}

/**
 * Helper para obtener el ID del usuario actual
 */
export function getUserId(req: Request): number | undefined {
  return req.session?.userId;
}

/**
 * Helper para verificar si el usuario puede crear otros usuarios
 */
export function canCreateUsers(req: Request): boolean {
  const role = req.session?.role;
  return role === UserRole.ADMIN || role === UserRole.GERENTE;
}

// ============================================================
// MIDDLEWARE: Verificar Propiedad de Recurso
// ============================================================

/**
 * Verifica si el usuario tiene acceso a un recurso específico
 * basado en la jerarquía de roles
 */
export function checkResourceAccess(
  resourceGerenteId: number | null,
  req: Request,
): boolean {
  const userRole = req.session?.role;
  const userId = req.session?.userId;
  const parentGerenteId = req.session?.parentGerenteId;

  // Admin ve todo
  if (userRole === UserRole.ADMIN) {
    return true;
  }

  // Gerente ve sus propios recursos
  if (userRole === UserRole.GERENTE && resourceGerenteId === userId) {
    return true;
  }

  // Asesor ve los recursos de su gerente
  if (
    userRole === UserRole.ASESOR &&
    parentGerenteId &&
    resourceGerenteId === parentGerenteId
  ) {
    return true;
  }

  return false;
}

// ============================================================
// MIDDLEWARE PERSONALIZADO: Filtrar Query por Acceso
// ============================================================

/**
 * Middleware que agrega filtros automáticos a las queries
 * basándose en el rol del usuario
 */
export function addAccessFilters(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const userRole = req.session?.role;
  const userId = req.session?.userId;
  const parentGerenteId = req.session?.parentGerenteId;

  // Agregar filtros a la request para uso posterior
  req.accessFilters = {
    role: userRole,
    userId,
    parentGerenteId,
    canSeeAll: userRole === UserRole.ADMIN,
    gerenteId: userRole === UserRole.GERENTE ? userId : parentGerenteId,
  };

  next();
}

// ============================================================
// EXTENDER TIPOS DE EXPRESS
// ============================================================

declare global {
  namespace Express {
    interface Request {
      accessFilters?: {
        role?: string;
        userId?: number;
        parentGerenteId?: number;
        canSeeAll: boolean;
        gerenteId?: number;
      };
    }
  }
}
