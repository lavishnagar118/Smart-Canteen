import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  currentUserRequest,
  firebaseLoginRequest,
  loginRequest,
  logoutRequest,
  registerRequest,
} from "../services/authService";
import {
  emailRegister,
  emailSignIn,
  firebaseConfigured,
  firebaseLogout,
  getFirebaseIdToken,
  googleSignIn,
  observeFirebaseAuth,
} from "../services/firebaseAuthService";
import { TOKEN_KEY } from "../services/api";
import { connectSocket, disconnectSocket } from "../services/socket";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyApplicationSession = useCallback((data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const syncFirebaseUser = useCallback(async (firebaseUser) => {
    const idToken = await getFirebaseIdToken(firebaseUser);
    const response = await firebaseLoginRequest(idToken);
    return applyApplicationSession(response.data);
  }, [applyApplicationSession]);

  const logout = useCallback(async () => {
    try {
      if (localStorage.getItem(TOKEN_KEY)) {
        await logoutRequest();
      }
    } catch {
      // The client state is still cleared if the session has already expired.
    } finally {
      if (firebaseConfigured) {
        await firebaseLogout().catch(() => {});
      }
      disconnectSocket();
      localStorage.removeItem(TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const response = await currentUserRequest();
    setUser(response.data.user);
    return response.data.user;
  }, []);

  useEffect(() => {
    let unsubscribe;
    if (firebaseConfigured) {
      unsubscribe = observeFirebaseAuth((firebaseUser) => {
        if (firebaseUser) {
          syncFirebaseUser(firebaseUser)
            .catch(() => logout())
            .finally(() => setLoading(false));
          return;
        }
        if (!localStorage.getItem(TOKEN_KEY)) {
          disconnectSocket();
          setUser(null);
          setLoading(false);
        }
      });
    }

    if (!token) {
      if (!firebaseConfigured) setLoading(false);
      return () => unsubscribe?.();
    }

    connectSocket(token);
    refreshUser()
      .catch(() => logout())
      .finally(() => setLoading(false));
    return () => unsubscribe?.();
  }, [token, refreshUser, logout, syncFirebaseUser]);

  const login = useCallback(async (credentials) => {
    if (firebaseConfigured) {
      try {
        const firebaseUser = await emailSignIn(credentials.email, credentials.password);
        return syncFirebaseUser(firebaseUser);
      } catch (error) {
        const localFallbackCodes = [
          "auth/operation-not-allowed",
          "auth/invalid-credential",
          "auth/user-not-found",
          "auth/wrong-password",
          "auth/invalid-login-credentials",
        ];
        if (!localFallbackCodes.includes(error.code)) {
          throw error;
        }
      }
    }
    const response = await loginRequest(credentials);
    return applyApplicationSession(response.data);
  }, [applyApplicationSession, syncFirebaseUser]);

  const register = useCallback(async (payload) => {
    if (firebaseConfigured) {
      try {
        const firebaseUser = await emailRegister(payload);
        return syncFirebaseUser(firebaseUser);
      } catch (error) {
        if (error.code !== "auth/operation-not-allowed") {
          throw error;
        }
      }
    }
    const response = await registerRequest(payload);
    return applyApplicationSession(response.data);
  }, [applyApplicationSession, syncFirebaseUser]);

  const loginWithGoogle = useCallback(async () => {
    const firebaseUser = await googleSignIn();
    return syncFirebaseUser(firebaseUser);
  }, [syncFirebaseUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      loginWithGoogle,
      register,
      logout,
      refreshUser,
      isAuthenticated: Boolean(token && user),
    }),
    [user, token, loading, login, loginWithGoogle, register, logout, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
