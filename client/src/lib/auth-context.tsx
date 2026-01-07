import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: number;
  username: string;
  email: string | null;
  role: string;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<{ role: string }>;
  register: (
    username: string,
    password: string,
    email?: string,
  ) => Promise<{ role: string }>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar si hay una sesión activa al cargar la app
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch("/api/auth/check", {
        credentials: "include",
      });
      const data = await response.json();

      if (data.authenticated && data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Error verificando autenticación:", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    username: string,
    password: string,
  ): Promise<{ role: string }> => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Error al iniciar sesión");
    }

    setUser(data.user);

    // Retornar el rol para que el componente pueda redirigir apropiadamente
    return { role: data.user.role };
  };

  const register = async (
    username: string,
    password: string,
    email?: string,
  ): Promise<{ role: string }> => {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ username, password, email: email || "" }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Error al registrar usuario");
    }

    setUser(data.user);

    // Retornar el rol para que el componente pueda redirigir apropiadamente
    return { role: data.user.role };
  };

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });

    setUser(null);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isLoading,
    login,
    register,
    logout,
    checkAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe ser usado dentro de un AuthProvider");
  }
  return context;
}

/**
 * Helper para determinar la ruta inicial según el rol
 */
export function getHomeRoute(role: string): string {
  return role === "admin" ? "/" : "/user-home";
}
