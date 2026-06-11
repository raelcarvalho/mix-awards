import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { Btn } from '@/components/ui/Card'
import * as api from '@/api/api'

type Page =
  | 'home'
  | 'dashboard'
  | 'partidas'
  | 'tirar-time'
  | 'ranking'
  | 'album'
  | 'album-stickers'
  | 'shop'
  | 'importar'
  | 'copa-do-mundo'

interface Props {
  page: Page
  setPage: (p: Page) => void
  onOpenPlayerDashboard?: (playerId: number | null) => void
  children: ReactNode
}

type HeaderSearchPlayer = {
  id: number
  nome: string
  imagem?: string
  kda: number
  adr: number
}

const NAV: { id: Page; icon: string; label: string; adminOnly?: boolean; neon?: boolean }[] = [
  { id: 'home', icon: '▦', label: 'Início' },
  { id: 'dashboard', icon: '◈', label: 'Meu Dashboard' },
  { id: 'partidas', icon: '⚔', label: 'Partidas' },
  { id: 'tirar-time', icon: '🎲', label: 'Tirar Time' },
  { id: 'album', icon: '📋', label: 'Álbum' },
  { id: 'copa-do-mundo', icon: '🏆', label: 'Copa do Mundo', neon: true },
  { id: 'shop', icon: '🛒', label: 'Shop' },
  { id: 'ranking', icon: '🥇', label: 'Ranking' },
  { id: 'album-stickers', icon: '✨', label: 'Álbum Stickers' },
  { id: 'importar', icon: '⬆', label: 'Importar', adminOnly: true },
]

const PAGE_TITLES: Record<Page, string> = {
  home: 'Início',
  dashboard: 'Meu Dashboard',
  partidas: 'Partidas',
  'tirar-time': 'Tirar Time',
  ranking: 'Ranking',
  album: 'Álbum',
  'album-stickers': 'Álbum Stickers',
  shop: 'Shop',
  importar: 'Importar Partida',
  'copa-do-mundo': 'Copa do Mundo',
}

function normalizeAvatarMedia(raw?: string | null): string | null {
  const src = String(raw || '').trim()
  if (!src) return null
  if (/^data:/i.test(src)) return src
  if (src.startsWith('/')) return src
  if (/^https?:\/\//i.test(src)) return src
  return `/${src.replace(/^\/+/, '')}`
}

export default function AppLayout({ page, setPage, onOpenPlayerDashboard, children }: Props) {
  const { user, gold, isAdmin, isLogged, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [time, setTime] = useState(new Date())
  const [searchPlayer, setSearchPlayer] = useState('')
  const [isMobile, setIsMobile] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchPlayers, setSearchPlayers] = useState<HeaderSearchPlayer[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchCacheLoaded, setSearchCacheLoaded] = useState(false)
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false)
  const profileRef = useRef<HTMLDivElement | null>(null)
  const searchRef = useRef<HTMLDivElement | null>(null)

  const normalizeSearch = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const loadSearchPlayers = useCallback(async () => {
    if (searchCacheLoaded || searchLoading) return
    setSearchLoading(true)
    try {
      const list = await api.listarJogadores()
      const normalized = (Array.isArray(list) ? list : [])
        .map((item: any, index: number) => {
          const nome = String(item?.nome || item?.nickname || '').trim()
          if (!nome) return null
          return {
            id: Number(item?.id || item?.jogador_id || index + 1),
            nome,
            imagem:
              String(
                item?.imagem ||
                  item?.jogador_imagem ||
                  item?.avatar ||
                  ''
              ).trim() || undefined,
            kda: Number(item?.kda_player || item?.kda || 0) || 0,
            adr: Number(item?.adr || item?.average_damage || 0) || 0,
          } as HeaderSearchPlayer
        })
        .filter(Boolean) as HeaderSearchPlayer[]
      setSearchPlayers(normalized)
      setSearchCacheLoaded(true)
    } catch {
      setSearchPlayers([])
      setSearchCacheLoaded(true)
    } finally {
      setSearchLoading(false)
    }
  }, [searchCacheLoaded, searchLoading])

  const filteredSearchPlayers = useMemo(() => {
    const query = normalizeSearch(searchPlayer)
    if (!query) return []
    return [...searchPlayers]
      .filter((p) => normalizeSearch(p.nome).includes(query))
      .sort((a, b) => {
        const ai = normalizeSearch(a.nome).indexOf(query)
        const bi = normalizeSearch(b.nome).indexOf(query)
        if (ai !== bi) return ai - bi
        return a.nome.localeCompare(b.nome, 'pt-BR')
      })
      .slice(0, 8)
  }, [searchPlayer, searchPlayers])

  useEffect(() => {
    const updateViewport = () => setIsMobile(window.innerWidth < 1024)
    updateViewport()
    window.addEventListener('resize', updateViewport)
    return () => window.removeEventListener('resize', updateViewport)
  }, [])

  useEffect(() => {
    if (!isMobile) setMobileNavOpen(false)
  }, [isMobile])

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const onMouseDown = (ev: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(ev.target as Node)) {
        setProfileOpen(false)
      }
      if (searchRef.current && !searchRef.current.contains(ev.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  useEffect(() => {
    setProfileOpen(false)
  }, [page])

  useEffect(() => {
    if (!searchPlayer.trim()) setSearchOpen(false)
  }, [searchPlayer])

  const visibleNav = useMemo(
    () => NAV.filter((n) => !n.adminOnly || isAdmin),
    [isAdmin]
  )

  const directUserAvatar = useMemo(
    () =>
      normalizeAvatarMedia(
        (user as any)?.imagem ||
          (user as any)?.jogador_imagem ||
          (user as any)?.avatar ||
          (user as any)?.avatar_url ||
          (user as any)?.steam_avatar
      ),
    [user]
  )

  const userAvatar = useMemo(() => {
    if (directUserAvatar) return directUserAvatar

    const jogadorId = Number((user as any)?.jogador_id || 0)
    if (jogadorId > 0) {
      const byId = searchPlayers.find((p) => Number(p.id) === jogadorId)
      const byIdImage = normalizeAvatarMedia(byId?.imagem)
      if (byIdImage) return byIdImage
    }

    const name = String(user?.nome || '').trim()
    if (name) {
      const byName = searchPlayers.find((p) => normalizeSearch(p.nome) === normalizeSearch(name))
      const byNameImage = normalizeAvatarMedia(byName?.imagem)
      if (byNameImage) return byNameImage
    }

    return null
  }, [directUserAvatar, user, searchPlayers])

  const steamLinked = useMemo(
    () => Boolean(String((user as any)?.steam_id || '').trim()),
    [user]
  )

  const openSteamAuth = useCallback(async (gcId?: number) => {
    const redirect = `${window.location.pathname}${window.location.search}`
    const safeGcId = Number.isFinite(Number(gcId)) && Number(gcId) > 0 ? Number(gcId) : undefined
    try {
      const url = await api.steamLoginUrlForLogged({
        redirect,
        ...(safeGcId ? { gc_id: safeGcId } : {}),
      })
      window.location.href = url
      return
    } catch {}
    window.location.href = api.steamLoginUrl({ redirect, ...(safeGcId ? { gc_id: safeGcId } : {}) })
  }, [])

  useEffect(() => {
    if (!isLogged) return
    if (directUserAvatar) return
    if (searchCacheLoaded || searchLoading) return
    void loadSearchPlayers()
  }, [isLogged, directUserAvatar, searchCacheLoaded, searchLoading, loadSearchPlayers])

  useEffect(() => {
    setProfileAvatarBroken(false)
  }, [userAvatar])

  const sidebarWidth = collapsed ? 68 : 216
  const isCopaPage = page === 'copa-do-mundo'

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: isCopaPage
          ? `url('/copa/background.png') center/cover no-repeat, #060d06`
          : '#09091a',
        color: '#fff',
        fontFamily: "'Rajdhani', system-ui, sans-serif",
        transition: 'background 0.4s ease',
      }}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute rounded-full"
          style={{
            top: '5%',
            left: '18%',
            width: 600,
            height: 500,
            background:
              isCopaPage
                ? 'radial-gradient(circle, rgba(255,223,0,0.08) 0%, rgba(0,156,59,0.035) 46%, transparent 74%)'
                : 'radial-gradient(circle, rgba(192,132,252,0.04) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            bottom: '10%',
            right: '10%',
            width: 400,
            height: 400,
            background:
              isCopaPage
                ? 'radial-gradient(circle, rgba(0,156,59,0.08) 0%, rgba(255,223,0,0.03) 50%, transparent 74%)'
                : 'radial-gradient(circle, rgba(34,211,238,0.03) 0%, transparent 70%)',
          }}
        />
      </div>

      {isMobile && mobileNavOpen && (
        <button
          className="fixed inset-0 z-30 cursor-default"
          style={{ background: 'rgba(5,7,16,0.6)', border: 'none' }}
          onClick={() => setMobileNavOpen(false)}
          aria-label="Fechar menu"
        />
      )}

      <aside
        className="flex flex-col flex-shrink-0 z-40 transition-all duration-300"
        style={{
          width: isMobile ? 216 : sidebarWidth,
          background: isCopaPage
            ? 'linear-gradient(180deg, rgba(4,24,10,0.88) 0%, rgba(4,22,9,0.84) 54%, rgba(4,18,8,0.56) 78%, rgba(4,16,7,0.18) 100%)'
            : 'linear-gradient(180deg, #0e0e1c 0%, #090912 100%)',
          borderRight: 'none',
          backdropFilter: isCopaPage ? 'blur(16px)' : undefined,
          position: isMobile ? 'fixed' : 'relative',
          left: 0,
          top: 0,
          bottom: 0,
          transform: isMobile
            ? mobileNavOpen
              ? 'translateX(0)'
              : 'translateX(-108%)'
            : 'translateX(0)',
          overflow: 'hidden',
          boxShadow: isCopaPage
            ? 'inset -32px 0 60px rgba(255,223,0,0.05), inset 0 -80px 120px rgba(0,0,0,0.14)'
            : undefined,
          transition:
            'background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease, box-shadow 0.4s ease',
        }}
      >
        {/* Animated neon gradient border — Copa do Mundo only */}
        {isCopaPage && (
          <>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 22,
                height: '100%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(180deg, rgba(0,156,59,0.22) 0%, rgba(255,223,0,0.42) 50%, rgba(0,156,59,0.22) 100%)',
                backgroundSize: '100% 200%',
                animation: 'sidebar-neon-flow 3s ease-in-out infinite',
                filter: 'blur(11px)',
                opacity: 0.85,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 2,
                height: '100%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(180deg, #009c3b 0%, #ffdf00 50%, #009c3b 100%)',
                backgroundSize: '100% 200%',
                animation: 'sidebar-neon-flow 3s ease-in-out infinite',
                boxShadow:
                  '0 0 6px rgba(255,223,0,0.95), 0 0 14px rgba(0,156,59,0.8), 0 0 26px rgba(255,223,0,0.4)',
              }}
            />
          </>
        )}
        {isCopaPage && (
          <>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                background:
                  'linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 22%, rgba(255,255,255,0.01) 48%, rgba(255,255,255,0.0) 72%)',
                opacity: 0.55,
              }}
            />
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: 0,
                height: '34%',
                pointerEvents: 'none',
                background:
                  'linear-gradient(180deg, rgba(4,22,9,0) 0%, rgba(4,22,9,0.08) 25%, rgba(4,22,9,0.18) 48%, rgba(4,22,9,0.04) 100%)',
              }}
            />
          </>
        )}
        <div
          className="flex items-center gap-3 overflow-hidden"
          style={{
            padding: '22px 16px 18px',
            borderBottom: isCopaPage
              ? '1px solid rgba(255,223,0,0.18)'
              : '1px solid rgba(255,255,255,0.05)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div
            className="flex-shrink-0 flex items-center justify-center rounded-xl overflow-hidden"
            style={{
              width: 38,
              height: 38,
              background: isCopaPage
                ? 'linear-gradient(135deg, rgba(0,156,59,0.22), rgba(255,223,0,0.2))'
                : 'linear-gradient(135deg,rgba(192,132,252,0.22),rgba(129,140,248,0.18))',
              boxShadow: isCopaPage
                ? '0 0 20px rgba(255,223,0,0.18), 0 0 28px rgba(0,156,59,0.14)'
                : '0 0 20px rgba(192,132,252,0.3)',
              border: isCopaPage
                ? '1px solid rgba(255,223,0,0.42)'
                : '1px solid rgba(192,132,252,0.35)',
            }}
          >
            <img
              src="/logo/logo-mixawards.png"
              alt="Logo MixAwards"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
          </div>
          {(!collapsed || isMobile) && (
            <div>
              <div
                className="font-orbitron font-bold text-white leading-none"
                style={{ fontSize: 13, letterSpacing: 2 }}
              >
                MIX
                <span
                  style={{
                    color: isCopaPage ? '#ffdf00' : '#c084fc',
                    textShadow: isCopaPage ? '0 0 10px rgba(255,223,0,0.18)' : undefined,
                  }}
                >
                  AWARDS
                </span>
              </div>
              <div
                className="font-rajdhani"
                style={{
                  fontSize: 9,
                  color: isCopaPage ? 'rgba(198,255,154,0.58)' : 'rgba(192,132,252,0.5)',
                  letterSpacing: 3,
                  marginTop: 2,
                }}
              >
                GAMING HUB
              </div>
            </div>
          )}
        </div>

        <nav
          className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0.5 p-2.5"
          style={{ position: 'relative', zIndex: 1 }}
        >
          {visibleNav.map((item) => {
            const active = page === item.id
            const showLabel = !collapsed || isMobile
            const isNeon = item.neon && isCopaPage

            if (isNeon) {
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setPage(item.id)
                    if (isMobile) setMobileNavOpen(false)
                  }}
                  className="flex items-center rounded-xl overflow-hidden whitespace-nowrap w-full cursor-pointer copa-neon-btn"
                  style={{
                    padding: showLabel ? '10px 12px' : '10px 8px',
                     fontWeight: active ? 700 : 600,
                     fontSize: 14,
                     fontFamily: "'Rajdhani', sans-serif",
                     lineHeight: 1.15,
                    justifyContent: showLabel ? 'flex-start' : 'center',
                    gap: showLabel ? 10 : 0,
                    textAlign: showLabel ? 'left' : 'center',
                    border: 'none',
                    background: active
                      ? 'linear-gradient(135deg,rgba(0,156,59,.28),rgba(255,223,0,.2))'
                      : 'linear-gradient(135deg,rgba(0,156,59,.1),rgba(255,223,0,.06))',
                    color: '#ffdf00',
                    position: 'relative',
                  }}
                >
                  {/* neon border glow */}
                  <span
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: 12,
                      pointerEvents: 'none',
                      boxShadow: active
                        ? '0 0 0 1.5px #009c3b, 0 0 10px 2px rgba(0,156,59,.6), 0 0 22px 4px rgba(255,223,0,.25), inset 0 0 8px rgba(255,223,0,.08)'
                        : '0 0 0 1px rgba(0,156,59,.5), 0 0 6px 1px rgba(0,156,59,.3), inset 0 0 14px rgba(255,223,0,.04)',
                      transition: 'box-shadow .25s ease',
                    }}
                  />
                  <span
                    className="flex-shrink-0"
                    style={{ width: 18, minWidth: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, lineHeight: 1 }}
                  >
                    {item.icon}
                  </span>
                  {showLabel && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        minHeight: 16,
                        letterSpacing: 0.5,
                        background: 'linear-gradient(90deg,#009c3b,#ffdf00,#009c3b)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        backgroundClip: 'text',
                        fontWeight: 700,
                      }}
                    >
                      {item.label}
                    </span>
                  )}
                </button>
              )
            }

            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === 'dashboard') onOpenPlayerDashboard?.(null)
                  setPage(item.id)
                  if (isMobile) setMobileNavOpen(false)
                }}
                className="flex items-center rounded-xl border-l-2 transition-all duration-200 overflow-hidden whitespace-nowrap w-full cursor-pointer"
                style={{
                  padding: showLabel ? '10px 12px' : '10px 8px',
                  fontWeight: active ? 700 : 500,
                  fontSize: 14,
                  fontFamily: "'Rajdhani', sans-serif",
                  lineHeight: 1.15,
                  justifyContent: showLabel ? 'flex-start' : 'center',
                  gap: showLabel ? 10 : 0,
                  textAlign: showLabel ? 'left' : 'center',
                  border: 'none',
                  borderLeft: `2px solid ${
                    active
                      ? isCopaPage
                        ? '#ffdf00'
                        : '#c084fc'
                      : 'transparent'
                  }`,
                  background: active
                    ? isCopaPage
                      ? 'linear-gradient(90deg, rgba(96,155,20,0.36) 0%, rgba(67,106,18,0.28) 62%, rgba(33,64,12,0.26) 100%)'
                      : 'rgba(192,132,252,0.15)'
                    : isCopaPage
                      ? 'linear-gradient(90deg, rgba(4,22,9,0.14) 0%, rgba(4,22,9,0.08) 100%)'
                      : 'transparent',
                  color: active
                    ? isCopaPage
                      ? '#ffdf00'
                      : '#c084fc'
                    : isCopaPage
                      ? 'rgba(250,255,225,0.72)'
                      : 'rgba(255,255,255,0.4)',
                  boxShadow:
                    active && isCopaPage
                      ? '0 0 0 1px rgba(255,223,0,0.24), inset 0 0 18px rgba(255,223,0,0.08), 0 0 24px rgba(0,156,59,0.08)'
                      : undefined,
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = isCopaPage
                      ? 'linear-gradient(90deg, rgba(67,106,18,0.3) 0%, rgba(25,57,11,0.18) 100%)'
                      : 'rgba(255,255,255,0.05)'
                    el.style.color = isCopaPage ? '#fff6b0' : 'rgba(255,255,255,0.7)'
                    el.style.borderLeftColor = isCopaPage
                      ? 'rgba(255,223,0,0.55)'
                      : 'rgba(192,132,252,0.45)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    const el = e.currentTarget as HTMLElement
                    el.style.background = isCopaPage
                      ? 'linear-gradient(90deg, rgba(4,22,9,0.14) 0%, rgba(4,22,9,0.08) 100%)'
                      : 'transparent'
                    el.style.color = isCopaPage ? 'rgba(250,255,225,0.72)' : 'rgba(255,255,255,0.4)'
                    el.style.borderLeftColor = 'transparent'
                  }
                }}
              >
                <span
                  className="flex-shrink-0"
                  style={{
                    width: 18,
                    minWidth: 18,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    lineHeight: 1,
                  }}
                >
                  {item.icon}
                </span>
                {showLabel && (
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      minHeight: 16,
                      letterSpacing: 0.2,
                    }}
                  >
                    {item.label}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ marginTop: 'auto', padding: isMobile ? '0 10px 10px' : '0 10px 12px' }}>
          {(!collapsed || isMobile) && isLogged && (
            <div
              className="rounded-xl p-3"
              style={{
                background: isCopaPage
                  ? 'linear-gradient(180deg, rgba(56,80,16,0.42) 0%, rgba(44,60,12,0.28) 100%)'
                  : 'rgba(245,200,66,0.08)',
                border: isCopaPage
                  ? '1px solid rgba(255,223,0,0.24)'
                  : '1px solid rgba(245,200,66,0.2)',
                marginBottom: 8,
                textAlign: 'center',
                boxShadow: isCopaPage ? 'inset 0 0 18px rgba(255,223,0,0.06)' : undefined,
              }}
            >
              <div
                className="text-xs tracking-widest mb-1 font-rajdhani font-bold"
                style={{
                  color: isCopaPage ? 'rgba(255,239,171,0.84)' : 'rgba(245,200,66,0.7)',
                  letterSpacing: '0.15em',
                  textAlign: 'center',
                }}
              >
                MEU GOLD
              </div>
              <div
                className="font-orbitron font-bold text-xl"
                style={{
                  color: isCopaPage ? '#ffdf00' : '#f5c842',
                  textAlign: 'center',
                  textShadow: isCopaPage ? '0 0 12px rgba(255,223,0,0.18)' : undefined,
                }}
              >
                {gold.toLocaleString('pt-BR')}
              </div>
            </div>
          )}

          {!isMobile && (
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-full rounded-lg p-2 cursor-pointer transition-colors duration-200 font-rajdhani tracking-wide"
              style={{
                background: isCopaPage ? 'rgba(20,43,9,0.4)' : 'rgba(255,255,255,0.04)',
                border: isCopaPage
                  ? '1px solid rgba(255,223,0,0.16)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: isCopaPage ? 'rgba(255,250,214,0.62)' : 'rgba(255,255,255,0.45)',
                fontSize: 11,
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = isCopaPage ? 'rgba(58,88,17,0.45)' : 'rgba(255,255,255,0.08)'
                el.style.color = isCopaPage ? '#fff4b1' : 'rgba(255,255,255,0.75)'
                el.style.borderColor = isCopaPage
                  ? 'rgba(255,223,0,0.35)'
                  : 'rgba(192,132,252,0.35)'
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLButtonElement
                el.style.background = isCopaPage ? 'rgba(20,43,9,0.4)' : 'rgba(255,255,255,0.04)'
                el.style.color = isCopaPage ? 'rgba(255,250,214,0.62)' : 'rgba(255,255,255,0.45)'
                el.style.borderColor = isCopaPage
                  ? 'rgba(255,223,0,0.16)'
                  : 'rgba(255,255,255,0.08)'
              }}
            >
              {collapsed ? '→' : '← RECOLHER'}
            </button>
          )}
        </div>
      </aside>

      <div
        className="flex flex-col flex-1 overflow-hidden relative z-10"
        style={{ marginLeft: isMobile ? 0 : undefined }}
      >
        <header
          className="flex-shrink-0 flex items-center justify-between sticky top-0 z-20"
          style={{
            height: 58,
            padding: isMobile ? '0 12px' : '0 28px',
            borderBottom: isCopaPage
              ? '1px solid rgba(255,223,0,0.12)'
              : '1px solid rgba(255,255,255,0.06)',
            background: isCopaPage
              ? 'linear-gradient(180deg, rgba(5,18,8,0.9) 0%, rgba(4,14,7,0.84) 100%)'
              : 'rgba(9,9,18,0.92)',
            backdropFilter: 'blur(24px)',
            boxShadow: isCopaPage ? 'inset 0 -8px 22px rgba(0,156,59,0.06)' : undefined,
          }}
        >
          <div className="flex items-center gap-2">
            {isMobile && (
              <button
                onClick={() => setMobileNavOpen(true)}
                className="w-9 h-9 rounded-lg cursor-pointer mr-1"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.8)',
                }}
                title="Abrir menu"
              >
                ☰
              </button>
            )}
            <span
              className="text-xs tracking-widest uppercase"
              style={{ color: isCopaPage ? 'rgba(255,244,188,0.6)' : 'rgba(255,255,255,0.25)' }}
            >
              MixAwards
            </span>
            <span style={{ color: isCopaPage ? 'rgba(150,255,118,0.46)' : 'rgba(192,132,252,0.4)' }}>›</span>
            <span
              className="text-xs font-bold tracking-wide uppercase font-rajdhani"
              style={{
                color: isCopaPage ? '#ffdf00' : '#c084fc',
                textShadow: isCopaPage ? '0 0 10px rgba(255,223,0,0.14)' : undefined,
              }}
            >
              {PAGE_TITLES[page]}
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3.5">
            <div ref={searchRef} className="hidden lg:block relative">
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>🔍</span>
                <input
                  value={searchPlayer}
                  onFocus={() => {
                    if (searchPlayer.trim()) setSearchOpen(true)
                    void loadSearchPlayers()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      const first = filteredSearchPlayers[0]
                      if (!first) return
                      setSearchPlayer(first.nome)
                      setSearchOpen(false)
                      onOpenPlayerDashboard?.(first.id)
                      setPage('dashboard')
                    }
                  }}
                  onChange={(e) => {
                    const value = e.target.value
                    setSearchPlayer(value)
                    setSearchOpen(Boolean(value.trim()))
                    if (value.trim()) void loadSearchPlayers()
                  }}
                  placeholder="Buscar jogador..."
                  style={{
                    width: 160,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#fff',
                    fontSize: 12,
                    fontFamily: "'Rajdhani', sans-serif",
                  }}
                />
              </div>

              {searchOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    left: 0,
                    width: 320,
                    maxHeight: 300,
                    overflowY: 'auto',
                    borderRadius: 12,
                    border: '1px solid rgba(192,132,252,.28)',
                    background:
                      'linear-gradient(180deg, rgba(17,25,45,.98) 0%, rgba(10,16,31,.98) 100%)',
                    boxShadow:
                      '0 14px 30px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.05)',
                    padding: 6,
                    zIndex: 60,
                  }}
                >
                  {searchLoading ? (
                    <div
                      style={{
                        padding: '10px 10px',
                        color: 'rgba(255,255,255,.55)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Carregando jogadores...
                    </div>
                  ) : filteredSearchPlayers.length === 0 ? (
                    <div
                      style={{
                        padding: '10px 10px',
                        color: 'rgba(255,255,255,.55)',
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      Nenhum jogador encontrado.
                    </div>
                  ) : (
                    filteredSearchPlayers.map((player) => (
                      <button
                        key={`header-search-${player.id}-${player.nome}`}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSearchPlayer(player.nome)
                          setSearchOpen(false)
                          onOpenPlayerDashboard?.(player.id)
                          setPage('dashboard')
                        }}
                        style={{
                          width: '100%',
                          border: '1px solid rgba(255,255,255,.08)',
                          borderRadius: 10,
                          background: 'rgba(255,255,255,.025)',
                          padding: '8px 9px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          textAlign: 'left',
                          cursor: 'pointer',
                          marginBottom: 4,
                        }}
                      >
                        {player.imagem ? (
                          <img
                            src={player.imagem}
                            alt={player.nome}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              objectFit: 'cover',
                              border: '1px solid rgba(255,255,255,.2)',
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              border: '1px solid rgba(255,255,255,.2)',
                              display: 'grid',
                              placeItems: 'center',
                              color: '#fff',
                              fontFamily: "'Orbitron',monospace",
                              fontSize: 12,
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {player.nome.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              color: '#fff',
                              fontFamily: "'Rajdhani',sans-serif",
                              fontWeight: 700,
                              fontSize: 15,
                              lineHeight: 1.1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {player.nome}
                          </div>
                          <div
                            style={{
                              marginTop: 2,
                              color: 'rgba(255,255,255,.74)',
                              fontFamily: "'Rajdhani',sans-serif",
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {`K/D/A ${player.kda.toFixed(2)} · ADR ${player.adr.toFixed(1)}`}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div
              className="font-orbitron font-bold tracking-wide"
              style={{ fontSize: 12, color: '#c084fc' }}
            >
              {time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </div>

            <button
              className="w-9 h-9 rounded-lg cursor-pointer"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.7)',
              }}
              title="Notificações"
            >
              🔔
            </button>

            {isLogged ? (
              <button
                onClick={logout}
                className="w-9 h-9 rounded-lg cursor-pointer"
                style={{
                  background: 'rgba(248,113,113,0.08)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  color: '#fda4af',
                }}
                title="Sair"
              >
                ↩
              </button>
            ) : (
              <Btn onClick={() => setShowLogin(true)} color="#c084fc" size="sm">
                ENTRAR
              </Btn>
            )}

            <div ref={profileRef} className="relative">
              <button
                onClick={() => setProfileOpen((s) => !s)}
                className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm cursor-pointer"
                style={{
                  background: isLogged
                    ? 'linear-gradient(135deg,#c084fc,#818cf8)'
                    : 'rgba(255,255,255,0.08)',
                  border: '2px solid rgba(192,132,252,0.4)',
                  boxShadow: isLogged ? '0 0 14px rgba(192,132,252,0.35)' : 'none',
                  color: '#fff',
                }}
                title="Abrir menu do perfil"
              >
                {userAvatar && !profileAvatarBroken ? (
                  <img
                    src={userAvatar}
                    alt={user?.nome || 'Avatar do jogador'}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      borderRadius: '50%',
                      display: 'block',
                    }}
                    onError={(e) => {
                      ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                      setProfileAvatarBroken(true)
                    }}
                  />
                ) : (
                  user?.nome?.[0]?.toUpperCase() ?? '?'
                )}
              </button>

              {profileOpen && (
                <div
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 10px)',
                    width: 220,
                    background: 'rgba(10,12,22,0.96)',
                    border: '1px solid rgba(192,132,252,0.2)',
                    borderRadius: 12,
                    boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
                    padding: 8,
                    zIndex: 80,
                  }}
                >
                  <div
                    style={{
                      padding: '8px 10px 10px',
                      borderBottom: '1px solid rgba(255,255,255,0.08)',
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "'Rajdhani',sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#fff',
                      }}
                    >
                      {user?.nome || 'Visitante'}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: 'rgba(255,255,255,0.45)',
                        marginTop: 2,
                      }}
                    >
                      {isLogged ? user?.email || 'Conta conectada' : 'Não autenticado'}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setPage('dashboard')
                      setProfileOpen(false)
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 'none',
                      color: 'rgba(255,255,255,0.85)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      fontSize: 13,
                      fontFamily: "'Rajdhani',sans-serif",
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background =
                        'rgba(255,255,255,0.06)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLButtonElement).style.background =
                        'transparent'
                    }}
                  >
                    Meu Dashboard
                  </button>

                  {isLogged && (
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        if (steamLinked) return
                        void openSteamAuth(Number((user as any)?.gc_id || 0))
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: steamLinked ? 'rgba(74,222,128,0.1)' : 'transparent',
                        border: 'none',
                        color: steamLinked ? '#86efac' : '#7dd3fc',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontFamily: "'Rajdhani',sans-serif",
                        cursor: steamLinked ? 'default' : 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (steamLinked) return
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'rgba(34,211,238,0.12)'
                      }}
                      onMouseLeave={(e) => {
                        if (steamLinked) return
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'transparent'
                      }}
                    >
                      {steamLinked ? 'Steam conectada' : 'Conectar Steam'}
                    </button>
                  )}

                  {isLogged ? (
                    <button
                      onClick={async () => {
                        setProfileOpen(false)
                        await logout()
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#fda4af',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontFamily: "'Rajdhani',sans-serif",
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'rgba(248,113,113,0.1)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'transparent'
                      }}
                    >
                      Sair da conta
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        setProfileOpen(false)
                        setShowLogin(true)
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        color: '#c084fc',
                        borderRadius: 8,
                        padding: '8px 10px',
                        fontSize: 13,
                        fontFamily: "'Rajdhani',sans-serif",
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'rgba(192,132,252,0.12)'
                      }}
                      onMouseLeave={(e) => {
                        ;(e.currentTarget as HTMLButtonElement).style.background =
                          'transparent'
                      }}
                    >
                      Entrar
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <main
          className="flex-1 overflow-y-auto"
          style={{ padding: isMobile ? '14px 12px 20px' : '22px 26px 32px' }}
        >
          {children}

          <div
            className="mt-7 pt-4 flex items-center justify-center"
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span
              className="text-xs font-rajdhani tracking-wide text-center"
              style={{ color: 'rgba(255,255,255,0.13)', width: '100%' }}
            >
              MIX AWARDS © 2025 — mixawards.com.br
            </span>
          </div>
        </main>
      </div>

      {showLogin && (
        <LoginModal
          onClose={() => setShowLogin(false)}
          onOpenRegister={() => {
            setShowLogin(false)
            setShowRegister(true)
          }}
        />
      )}
      {showRegister && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onOpenLogin={() => {
            setShowRegister(false)
            setShowLogin(true)
          }}
        />
      )}
    </div>
  )
}

function LoginModal({
  onClose,
  onOpenRegister,
}: {
  onClose: () => void
  onOpenRegister: () => void
}) {
  const { login, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [error, setError] = useState('')
  const [steamLoading, setSteamLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    try {
      await login(email, senha)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login')
    }
  }

  const loginWithSteam = () => {
    setError('')
    setSteamLoading(true)
    const redirect = `${window.location.pathname}${window.location.search}`
    window.location.href = api.steamLoginUrl({ redirect })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      />
      <div
        className="relative"
        style={{
          width: 'min(94vw, 470px)',
          margin: '12px',
          padding: '22px 18px 18px',
          borderRadius: 16,
          background:
            'linear-gradient(180deg, rgba(18,27,48,.96) 0%, rgba(13,21,39,.96) 100%)',
          border: '1px solid rgba(116,174,255,.34)',
          boxShadow:
            '0 18px 48px rgba(0,0,0,.5), inset 0 0 0 1px rgba(167,139,250,.18)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar login"
          className="absolute cursor-pointer"
          style={{
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid rgba(167,139,250,.42)',
            background:
              'linear-gradient(135deg, rgba(26,36,60,.95) 0%, rgba(15,24,43,.95) 100%)',
            color: 'rgba(241,245,249,.92)',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              '0 10px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(34,211,238,.16)',
            flexShrink: 0,
          }}
        >
          ×
        </button>

        <div
          className="font-orbitron font-bold text-white"
          style={{ fontSize: 18, letterSpacing: 2, paddingLeft: 5, marginBottom: 2 }}
        >
          MIX<span style={{ color: '#c084fc' }}>AWARDS</span>
        </div>
        <p
          className="text-xs font-rajdhani mb-6"
          style={{ color: 'rgba(255,255,255,0.35)', paddingLeft: 5 }}
        >
        </p>

        <form onSubmit={submit} className="flex flex-col gap-3.5 mt-0.5">
          {[
            { label: 'E-MAIL', value: email, set: setEmail, type: 'email' },
            { label: 'SENHA', value: senha, set: setSenha, type: 'password' },
          ].map((f) => (
            <label key={f.label} className="flex flex-col gap-1.5">
              <span
                className="text-xs tracking-widest font-rajdhani font-bold"
                style={{ color: 'rgba(255,255,255,0.4)', paddingLeft: 5 }}
              >
                {f.label}
              </span>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                required
                className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: 'rgba(255,255,255,0.12)',
                  paddingLeft: 8,
                }}
                onFocus={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = 'rgba(192,132,252,0.6)'
                }}
                onBlur={(e) => {
                  ;(e.target as HTMLInputElement).style.borderColor = 'rgba(255,255,255,0.12)'
                }}
              />
            </label>
          ))}

          {error && <p className="text-xs font-rajdhani" style={{ color: '#f87171' }}>{error}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Btn
              type="submit"
              disabled={loading || steamLoading}
              color="#c084fc"
              fullWidth
              size="lg"
              className="py-3.5"
            >
              {loading ? 'ENTRANDO...' : 'ENTRAR'}
            </Btn>
            <Btn
              type="button"
              onClick={onOpenRegister}
              disabled={loading || steamLoading}
              color="#22d3ee"
              fullWidth
              size="lg"
              className="py-3.5"
            >
              CADASTRAR
            </Btn>
          </div>
          <Btn
            type="button"
            onClick={loginWithSteam}
            disabled={loading || steamLoading}
            variant="outline"
            color="#7dd3fc"
            fullWidth
            size="lg"
            className="py-3"
          >
            {steamLoading ? 'REDIRECIONANDO STEAM...' : 'ENTRAR COM STEAM'}
          </Btn>
        </form>
      </div>
    </div>
  )
}

function RegisterModal({
  onClose,
  onOpenLogin,
}: {
  onClose: () => void
  onOpenLogin: () => void
}) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [nickGc, setNickGc] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const nomeValue = nome.trim()
    const emailValue = email.trim()
    const senhaValue = senha.trim()
    const confirmarSenhaValue = confirmarSenha.trim()
    const nickGcValue = nickGc.trim()

    if (!nomeValue || !emailValue || !senhaValue || !confirmarSenhaValue || !nickGcValue) {
      setError('Preencha todos os campos para criar sua conta.')
      return
    }

    if (senhaValue !== confirmarSenhaValue) {
      setError('A confirmação de senha está diferente.')
      return
    }

    setLoading(true)
    try {
      await api.cadastrar(nomeValue, emailValue, senhaValue, nickGcValue)
      setSuccess('Conta criada com sucesso! Você já pode entrar.')
      setNome('')
      setEmail('')
      setSenha('')
      setConfirmarSenha('')
      setNickGc('')
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar sua conta no momento.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      />
      <div
        className="relative"
        style={{
          width: 'min(95vw, 540px)',
          margin: '12px',
          padding: '22px 18px 18px',
          borderRadius: 16,
          background:
            'linear-gradient(180deg, rgba(18,27,48,.96) 0%, rgba(13,21,39,.96) 100%)',
          border: '1px solid rgba(116,174,255,.34)',
          boxShadow:
            '0 18px 48px rgba(0,0,0,.5), inset 0 0 0 1px rgba(167,139,250,.18)',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Fechar cadastro"
          className="absolute cursor-pointer"
          style={{
            top: 12,
            right: 12,
            width: 40,
            height: 40,
            borderRadius: 12,
            border: '1px solid rgba(167,139,250,.42)',
            background:
              'linear-gradient(135deg, rgba(26,36,60,.95) 0%, rgba(15,24,43,.95) 100%)',
            color: 'rgba(241,245,249,.92)',
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow:
              '0 10px 24px rgba(0,0,0,.35), inset 0 0 0 1px rgba(34,211,238,.16)',
            flexShrink: 0,
          }}
        >
          ×
        </button>

        <div
          className="font-orbitron font-bold text-white"
          style={{ fontSize: 22, textAlign: 'center', letterSpacing: 0.6, marginBottom: 12 }}
        >
          Criar conta
        </div>

        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span
              className="text-xs tracking-widest font-rajdhani font-bold"
              style={{ color: 'rgba(255,255,255,0.72)', paddingLeft: 2 }}
            >
              Nome
            </span>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              placeholder="Seu nome completo"
              className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                paddingLeft: 8,
              }}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-xs tracking-widest font-rajdhani font-bold"
              style={{ color: 'rgba(255,255,255,0.72)', paddingLeft: 2 }}
            >
              E-mail
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="voce@exemplo.com"
              className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                paddingLeft: 8,
              }}
            />
          </label>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <label className="flex flex-col gap-1.5">
              <span
                className="text-xs tracking-widest font-rajdhani font-bold"
                style={{ color: 'rgba(255,255,255,0.72)', paddingLeft: 2 }}
              >
                Senha
              </span>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  paddingLeft: 8,
                }}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span
                className="text-xs tracking-widest font-rajdhani font-bold"
                style={{ color: 'rgba(255,255,255,0.72)', paddingLeft: 2 }}
              >
                Confirmar senha
              </span>
              <input
                type="password"
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                required
                placeholder="••••••••"
                className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  paddingLeft: 8,
                }}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span
              className="text-xs tracking-widest font-rajdhani font-bold"
              style={{ color: 'rgba(255,255,255,0.72)', paddingLeft: 2 }}
            >
              Seu nick GC
            </span>
            <input
              value={nickGc}
              onChange={(e) => setNickGc(e.target.value)}
              required
              placeholder="O NICK TEM QUE SER IGUAL"
              className="rounded-xl px-3.5 py-2.5 text-sm font-rajdhani text-white outline-none w-full"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.12)',
                paddingLeft: 8,
              }}
            />
            <span
              style={{
                color: 'rgba(255,255,255,0.62)',
                fontFamily: "'Rajdhani',sans-serif",
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.2,
              }}
            >
              Você não poderá alterar o nick da GC enquanto rolar o Mix Awards
            </span>
          </label>

          {error && (
            <p className="text-xs font-rajdhani" style={{ color: '#f87171', marginTop: 2 }}>
              {error}
            </p>
          )}
          {success && (
            <p className="text-xs font-rajdhani" style={{ color: '#4ade80', marginTop: 2 }}>
              {success}
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 2 }}>
            <Btn type="submit" disabled={loading} color="#56c1ff" fullWidth size="lg" className="py-3">
              {loading ? 'CRIANDO...' : 'CRIAR CONTA'}
            </Btn>
            <Btn type="button" onClick={onOpenLogin} disabled={loading} variant="outline" color="#cbd5e1" fullWidth size="lg" className="py-3">
              CANCELAR
            </Btn>
          </div>
        </form>
      </div>
    </div>
  )
}
