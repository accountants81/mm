import { useCallback, useEffect, useState } from "react";
import { localList } from "@/lib/localDb";
import { getActiveLocalRole, logoutLocalSession } from "@/lib/localPermissions";

type LocalAuthUser = {
  id: string;
  name?: string;
  email?: string;
  role?: string;
};

function readActiveUser(): LocalAuthUser | null {
  if (typeof window === "undefined") return null;
  const id = localStorage.getItem("local-active-user-id");
  const sessionId = sessionStorage.getItem("local-active-user-id");
  const email = localStorage.getItem("local-active-user-email");
  if (!id || !sessionId || id !== sessionId || !email) return null;
  return {
    id,
    email,
    name: id === "system-manager" ? "مدير النظام" : email,
    role: getActiveLocalRole(),
  };
}

export function useAuth() {
  const [user, setUser] = useState<LocalAuthUser | null>(() => readActiveUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void localList<{ id: string; name?: string; email?: string; role?: string; updatedAt: string }>("users")
      .then(users => {
        if (!active) return;
        const current = readActiveUser();
        const stored = current ? users.find(item => item.id === current.id) : undefined;
        setUser(current ? { ...current, name: stored?.name ?? current.name, role: current.role } : null);
      })
      .catch(() => {
        if (active) setUser(readActiveUser());
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const logout = useCallback(() => {
    logoutLocalSession();
    setUser(null);
    window.location.replace("/local-access");
  }, []);

  return { user, loading, logout };
}
