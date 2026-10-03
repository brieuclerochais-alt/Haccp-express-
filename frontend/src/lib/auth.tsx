/*
  Contexte d'authentification du gérant / responsable (email + mot de passe).
  L'authentification employé par PIN sur appareil appairé arrive au Lot 1.
*/
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import { api, tokenStore, type Tokens } from '@/lib/api'

export interface Organization {
  id: string
  name: string
  siret: string
  billing_address: string
  created_at: string
}

export interface Membership {
  id: string
  organization: Organization
  role: 'owner' | 'manager'
}

export interface User {
  id: string
  email: string
  full_name: string
  memberships: Membership[]
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  organization_name: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: RegisterPayload) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(() => tokenStore.get() !== null)

  const refreshUser = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      return
    }
    try {
      setUser(await api.get<User>('/auth/me/'))
    } catch {
      tokenStore.clear()
      setUser(null)
    }
  }, [])

  useEffect(() => {
    if (!tokenStore.get()) return
    let cancelled = false
    refreshUser().finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [refreshUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await api.post<Tokens>('/auth/login/', { email, password }, { auth: false })
      tokenStore.set(tokens)
      await refreshUser()
    },
    [refreshUser],
  )

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await api.post<Tokens & { user: User }>('/auth/register/', payload, {
      auth: false,
    })
    tokenStore.set({ access: data.access, refresh: data.refresh })
    setUser(data.user)
  }, [])

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return context
}
