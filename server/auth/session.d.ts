import "express-session";

/**
 * Extender los tipos de express-session para incluir campos personalizados
 */
declare module "express-session" {
  interface SessionData {
    userId?: number;
    username?: string;
    role?: string;
  }
}

export {};
