"use client"

import { onAuthStateChanged, signOut, type User } from "firebase/auth"
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { auth, isFirebaseConfigured } from "@/lib/firebase"

type AuthContextValue = {
  user: User | null
  loading: boolean
  configured: boolean
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const configured = isFirebaseConfigured()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(configured)

  useEffect(() => {
    if (!configured) return
    return onAuthStateChanged(auth(), (next) => {
      setUser(next)
      setLoading(false)
    })
  }, [configured])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      configured,
      signOutUser: async () => {
        if (configured) await signOut(auth())
      },
    }),
    [user, loading, configured],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth должен вызываться внутри AuthProvider")
  return value
}
