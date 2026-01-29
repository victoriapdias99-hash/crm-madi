import { db } from "../db";
import { users } from "../../shared/schema";
import { eq } from "drizzle-orm";
import type { UserResponse, RegisterInput } from "./schemas";

interface CreateUserData {
  username: string;
  password: string;
  email?: string | null;
  role: string;
  createdBy?: number | null;
  parentGerenteId?: number | null;
}
/**
 * Repositorio de Usuarios
 * Maneja todas las operaciones de base de datos relacionadas con usuarios
 */
export class UserRepository {
  /**
   * Crear un nuevo usuario (gerente o asesor)
   */
  async create(userData: CreateUserData): Promise<UserResponse> {
    const [newUser] = await db
      .insert(users)
      .values({
        username: userData.username,
        password: userData.password,
        email: userData.email || null,
        role: userData.role,
        createdBy: userData.createdBy || null,
        parentGerenteId: userData.parentGerenteId || null,
      })
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
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
        createdBy: number | null;
        parentGerenteId: number | null;
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
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
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
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
        createdAt: users.createdAt,
      })
      .from(users);
  }

  /**
   * NUEVO: Buscar usuarios por rol
   */
  async findByRole(role: string): Promise<UserResponse[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.role, role))
      .orderBy(users.username);
  }

  /**
   * NUEVO: Buscar gerentes creados por un admin
   */
  async findGerentesByAdminId(adminId: number): Promise<UserResponse[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.role, "gerente"), eq(users.createdBy, adminId)))
      .orderBy(users.username);
  }

  /**
   * NUEVO: Buscar asesores de un gerente
   */
  async findAsesorsByGerenteId(gerenteId: number): Promise<UserResponse[]> {
    return db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.parentGerenteId, gerenteId))
      .orderBy(users.username);
  }

  /**
   * NUEVO: Obtener estadísticas de usuarios
   */
  async getUserStats(): Promise<{
    totalUsers: number;
    admins: number;
    gerentes: number;
    asesores: number;
  }> {
    const allUsers = await this.findAll();

    return {
      totalUsers: allUsers.length,
      admins: allUsers.filter((u) => u.role === "admin").length,
      gerentes: allUsers.filter((u) => u.role === "gerente").length,
      asesores: allUsers.filter((u) => u.role === "asesor").length,
    };
  }

  /**
   * NUEVO: Eliminar usuario
   */
  async deleteUser(id: number): Promise<boolean> {
    const result = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });

    return result.length > 0;
  }

  /**
   * NUEVO: Actualizar usuario
   */
  async updateUser(
    id: number,
    data: Partial<{
      username: string;
      email: string | null;
      password: string;
    }>,
  ): Promise<UserResponse | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning({
        id: users.id,
        username: users.username,
        email: users.email,
        role: users.role,
        createdBy: users.createdBy,
        parentGerenteId: users.parentGerenteId,
        createdAt: users.createdAt,
      });

    return updatedUser;
  }

  /**
   * NUEVO: Contar asesores de un gerente
   */
  async countAsesorsByGerenteId(gerenteId: number): Promise<number> {
    const asesores = await this.findAsesorsByGerenteId(gerenteId);
    return asesores.length;
  }

  /**
   * NUEVO: Verificar si un usuario puede crear otro
   */
  async canCreateUser(
    creatorId: number,
    targetRole: string,
  ): Promise<{ valid: boolean; error?: string }> {
    const creator = await this.findById(creatorId);

    if (!creator) {
      return { valid: false, error: "Usuario creador no encontrado" };
    }

    // Admin puede crear gerentes
    if (creator.role === "admin" && targetRole === "gerente") {
      return { valid: true };
    }

    // Gerente puede crear asesores
    if (creator.role === "gerente" && targetRole === "asesor") {
      return { valid: true };
    }

    return {
      valid: false,
      error: `Rol ${creator.role} no puede crear usuarios de tipo ${targetRole}`,
    };
  }
}
