import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

/**
 * Servicio de Autenticación
 * Maneja hashing de passwords y verificación
 *
 * NOTA: Para producción, se recomienda usar bcryptjs:
 * npm install bcryptjs @types/bcryptjs
 *
 * Esta implementación usa scrypt de Node.js que es seguro
 * pero bcrypt es el estándar de la industria.
 */
export class AuthService {
  /**
   * Hash de una contraseña usando scrypt
   * @param password - Contraseña en texto plano
   * @returns Password hasheado con salt incluido
   */
  static async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex");
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString("hex")}`;
  }

  /**
   * Verifica una contraseña contra un hash
   * @param password - Contraseña en texto plano
   * @param hashedPassword - Password hasheado (formato: salt:hash)
   * @returns true si la contraseña es correcta
   */
  static async verifyPassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    try {
      const [salt, hash] = hashedPassword.split(":");
      if (!salt || !hash) {
        return false;
      }

      const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
      const hashBuffer = Buffer.from(hash, "hex");

      return timingSafeEqual(derivedKey, hashBuffer);
    } catch (error) {
      console.error("Error verifying password:", error);
      return false;
    }
  }
}

/**
 * ALTERNATIVA CON BCRYPTJS (recomendado para producción):
 *
 * import bcrypt from 'bcryptjs';
 *
 * export class AuthService {
 *   static async hashPassword(password: string): Promise<string> {
 *     const salt = await bcrypt.genSalt(10);
 *     return bcrypt.hash(password, salt);
 *   }
 *
 *   static async verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
 *     return bcrypt.compare(password, hashedPassword);
 *   }
 * }
 */
