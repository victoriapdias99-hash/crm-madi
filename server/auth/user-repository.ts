import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { UserResponse, RegisterInput } from "./schemas";

/**
 * Repositorio de Usuarios
 * Maneja todas las operaciones de base de datos relacionadas con usuarios
 */
export class UserRepository {
  /**
   * Crear un nuevo usuario
   */
  async create(
    userData: RegisterInput & { password: string },
  ): Promise<UserResponse> {
    const [newUser] = await db
      .insert(users)
      .values({
        username: userData.username,
        password: userData.password, // Ya debe venir hasheado
        email: userData.email || null,
        role: userData.role || "user",
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });

    return newUser;
  }

  /**
   * Buscar usuario por username (incluyendo password para autenticación)
   */
  async findByUsername(username: string): Promise<
    | {
        id: number;
        username: string;
        password: string;
        email: string | null;
        role: string;
        createdAt: Date | null;
      }
    | undefined
  > {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user;
  }

  /**
   * Buscar usuario por ID (sin password)
   */
  async findById(id: number): Promise<UserResponse | undefined> {
    const [user] = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user;
  }

  /**
   * Verificar si un username ya existe
   */
  async usernameExists(username: string): Promise<boolean> {
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return !!user;
  }

  /**
   * Obtener todos los usuarios (sin passwords)
   */
  async findAll(): Promise<UserResponse[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);
  }
}
