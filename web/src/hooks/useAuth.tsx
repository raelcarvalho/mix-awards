import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import * as api from '@/services/api'

interface User {
  id: number
  nome: string
  email: string
  usuario_admin?: boolean
  gold?: number
  jogador_id?: number
  imagem?: string
  jogador_imagem?: string
  avatar?: string
  avatar_url?: string
  steam_avatar?: string
}

interface AuthCtx {
  user: User | null
  gold: number
  jogadorId: number | null
  isAdmin: boolean
  isLogged: boolean
  loading: boolean
  login: (email: string, senha: string) => Promise<void>
  logout: () => Promise<void>
  refreshGold: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({} as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(api.getUser() as User | null)
  const [gold, setGold] = useState(0)
  const [loading, setLoading] = useState(false)

  const refreshGold = useCallback(async () => {
    if (!api.getToken()) return
    try {
      const data = await api.meuGold(api.getUser()?.id)
      setGold(data.gold ?? 0)
      setUser((prev) =>
        prev
          ? {
              ...prev,
              gold: data.gold ?? prev.gold ?? 0,
              jogador_id:
                data.jogador_id ?? prev.jogador_id ?? undefined,
              imagem: data.imagem ?? prev.imagem,
              jogador_imagem: data.imagem ?? prev.jogador_imagem,
            }
          : prev
      )
      const u = api.getUser()
      if (u) {
        api.setAuth(localStorage.getItem('auth_token')!, {
          ...u,
          gold: data.gold,
          jogador_id: data.jogador_id ?? u.jogador_id,
          imagem: data.imagem ?? u.imagem,
          jogador_imagem: data.imagem ?? u.jogador_imagem,
        })
      }
    } catch {}
  }, [])

  useEffect(() => {
    if (api.getToken() && api.getUser()) refreshGold()
  }, [refreshGold])

  const login = async (email: string, senha: string) => {
    setLoading(true)
    try {
      const data = await api.login(email, senha)
      const rawToken = data?.resultados?.token
      const token =
        (rawToken && typeof rawToken === 'object' ? rawToken.token : rawToken) ||
        data?.token?.token ||
        data?.token
      const usuario = data?.resultados?.usuario || data?.usuario
      if (token && usuario) {
        api.setAuth(token, usuario)
        setUser(usuario)
        await refreshGold()
      }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await api.logout()
    api.clearAuth()
    setUser(null)
    setGold(0)
  }

  return (
    <Ctx.Provider value={{
      user, gold,
      jogadorId: user?.jogador_id ?? null,
      isAdmin: !!user?.usuario_admin,
      isLogged: !!user && !!api.getToken(),
      loading, login, logout, refreshGold,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
