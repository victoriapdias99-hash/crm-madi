import { Request, Response, NextFunction } from "express";

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

  if (req.session.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Acceso denegado. Se requieren permisos de administrador.",
    });
  }

  next();
}

/**
 * Middleware para verificar que el usuario esté autenticado
 * (cualquier rol es válido)
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
 * Helper para verificar si un usuario es admin
 */
export function isAdmin(req: Request): boolean {
  return req.session?.role === "admin";
}

/**
 * Helper para obtener el rol del usuario actual
 */
export function getUserRole(req: Request): string | undefined {
  return req.session?.role;
}
