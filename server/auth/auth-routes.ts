import { Router, Request, Response, NextFunction } from "express";
import { registerSchema, loginSchema } from "./schemas";
import { AuthService } from "./auth-service";
import { UserRepository } from "./user-repository";
import { ZodError } from "zod";

const router = Router();
const userRepository = new UserRepository();

/**
 * Middleware para verificar si el usuario está autenticado
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
 * POST /api/auth/register
 * Registrar un nuevo usuario
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    // Validar datos de entrada
    const validatedData = registerSchema.parse(req.body);

    // Verificar si el usuario ya existe
    const exists = await userRepository.usernameExists(validatedData.username);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: "El nombre de usuario ya está en uso",
      });
    }

    // Hashear la contraseña
    const hashedPassword = await AuthService.hashPassword(
      validatedData.password,
    );

    // Crear el usuario
    const newUser = await userRepository.create({
      ...validatedData,
      password: hashedPassword,
    });

    // Crear sesión automáticamente después del registro
    if (req.session) {
      req.session.userId = newUser.id;
      req.session.username = newUser.username;
      req.session.role = newUser.role;
    }

    return res.status(201).json({
      success: true,
      message: "Usuario registrado exitosamente",
      user: newUser,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    console.error("Error en registro:", error);
    return res.status(500).json({
      success: false,
      message: "Error al registrar usuario",
    });
  }
});

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    // Validar datos de entrada
    const validatedData = loginSchema.parse(req.body);

    // Buscar usuario
    const user = await userRepository.findByUsername(validatedData.username);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    // Verificar contraseña
    const isPasswordValid = await AuthService.verifyPassword(
      validatedData.password,
      user.password,
    );

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas",
      });
    }

    // Crear sesión
    if (req.session) {
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.role = user.role;

      // NUEVO: Agregar parentGerenteId si es asesor
      if (user.role === "asesor" && user.parentGerenteId) {
        req.session.parentGerenteId = user.parentGerenteId;
      }
    }

    // Retornar usuario sin password
    const { password, ...userWithoutPassword } = user;
    console.log(`✅ Login exitoso: ${user.username} (${user.role})`);

    return res.status(200).json({
      success: true,
      message: "Inicio de sesión exitoso",
      user: userWithoutPassword,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos",
        errors: error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        })),
      });
    }

    console.error("Error en login:", error);
    return res.status(500).json({
      success: false,
      message: "Error al iniciar sesión",
    });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión
 */
router.post("/logout", (req: Request, res: Response) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error al cerrar sesión:", err);
        return res.status(500).json({
          success: false,
          message: "Error al cerrar sesión",
        });
      }

      res.clearCookie("connect.sid"); // Nombre por defecto de express-session
      return res.status(200).json({
        success: true,
        message: "Sesión cerrada exitosamente",
      });
    });
  } else {
    return res.status(200).json({
      success: true,
      message: "No hay sesión activa",
    });
  }
});

/**
 * GET /api/auth/me
 * Obtener usuario actual
 */
router.get("/me", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "No autorizado",
      });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Usuario no encontrado",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Error al obtener usuario:", error);
    return res.status(500).json({
      success: false,
      message: "Error al obtener información del usuario",
    });
  }
});

/**
 * GET /api/auth/check
 * Verificar si hay una sesión activa (sin requerir autenticación)
 */
router.get("/check", async (req: Request, res: Response) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(200).json({
        authenticated: false,
        user: null,
      });
    }

    const user = await userRepository.findById(userId);

    if (!user) {
      return res.status(200).json({
        authenticated: false,
        user: null,
      });
    }

    return res.status(200).json({
      authenticated: true,
      user,
    });
  } catch (error) {
    console.error("Error al verificar sesión:", error);
    return res.status(500).json({
      authenticated: false,
      user: null,
    });
  }
});

export { router as authRoutes };
