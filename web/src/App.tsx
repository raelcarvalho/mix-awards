import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider } from '@/hooks/useAuth'
import AppLayout from '@/components/layout/AppLayout'
import HomePage from '@/pages/HomePage'
import DashboardPage from '@/pages/DashboardPage'
import RankingPage from '@/pages/RankingPage'
import ShopPage from '@/pages/ShopPage'
import AlbumPage from '@/pages/AlbumPage'
import AlbumStickersPage from '@/pages/AlbumStickersPage'
import { PartidasPage, ImportarPage } from '@/pages/PartidasPage'
import TirarTimePage from '@/pages/TirarTimePage'
import CopaDoMundoPage from '@/pages/CopaDoMundoPage'
import MixAwardsPage from '@/pages/MixAwardsPage'

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
  | 'mix-awards'

const PAGE_STORAGE_KEY = 'mixawards:last-page'

const PAGE_VALUES: Page[] = [
  'home',
  'dashboard',
  'partidas',
  'tirar-time',
  'ranking',
  'album',
  'album-stickers',
  'shop',
  'importar',
  'copa-do-mundo',
  'mix-awards',
]

const PAGE_TO_PATH: Record<Page, string> = {
  home: '/',
  dashboard: '/dashboard',
  partidas: '/partidas',
  'tirar-time': '/tirar-time',
  ranking: '/ranking',
  album: '/album',
  'album-stickers': '/album-stickers',
  shop: '/shop',
  importar: '/importar',
  'copa-do-mundo': '/copa-do-mundo',
  'mix-awards': '/mix-awards',
}

function isValidPage(value: unknown): value is Page {
  return typeof value === 'string' && PAGE_VALUES.includes(value as Page)
}

function normalizePathname(pathname: string): string {
  const decoded = decodeURIComponent(String(pathname || '').trim())
  if (!decoded || decoded === '/') return '/'
  return decoded.endsWith('/') ? decoded.slice(0, -1) : decoded
}

function readPageFromPathname(pathname: string): Page | null {
  const normalizedPath = normalizePathname(pathname)
  for (const [page, path] of Object.entries(PAGE_TO_PATH)) {
    if (path === normalizedPath) return page as Page
  }
  return null
}

function readInitialPage(): Page {
  if (typeof window === 'undefined') return 'home'

  const fromPath = readPageFromPathname(window.location.pathname)
  if (fromPath) return fromPath

  const fromHash = decodeURIComponent(String(window.location.hash || '').replace(/^#/, '').trim())
  if (isValidPage(fromHash)) {
    const targetPath = PAGE_TO_PATH[fromHash]
    const nextUrl = `${targetPath}${window.location.search}`
    window.history.replaceState(null, '', nextUrl)
    return fromHash
  }

  const fromStorage = String(localStorage.getItem(PAGE_STORAGE_KEY) || '').trim()
  if (isValidPage(fromStorage)) return fromStorage

  return 'home'
}

function renderPage(page: Page, setPage: (p: Page) => void, dashboardPlayerId: number | null) {
  switch (page) {
    case 'home':           return <HomePage setPage={setPage} />
    case 'dashboard':      return <DashboardPage setPage={setPage} dashboardPlayerId={dashboardPlayerId} />
    case 'ranking':        return <RankingPage />
    case 'partidas':       return <PartidasPage setPage={setPage} />
    case 'tirar-time':     return <TirarTimePage />
    case 'album':          return <AlbumPage setPage={setPage} />
    case 'album-stickers': return <AlbumStickersPage setPage={setPage} />
    case 'shop':           return <ShopPage setPage={setPage} />
    case 'importar':       return <ImportarPage />
    case 'copa-do-mundo':  return <CopaDoMundoPage setPage={setPage} />
    case 'mix-awards':     return <MixAwardsPage />
    default:               return <HomePage setPage={setPage} />
  }
}

function Router({
  page,
  setPage,
  dashboardPlayerId,
}: {
  page: Page
  setPage: (p: Page) => void
  dashboardPlayerId: number | null
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={page}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {renderPage(page, setPage, dashboardPlayerId)}
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  const [page, setPage] = useState<Page>(() => readInitialPage())
  const [dashboardPlayerId, setDashboardPlayerId] = useState<number | null>(null)
  const setPagePersisted = useMemo(
    () => (next: Page) => {
      setPage(next)
    },
    []
  )

  useEffect(() => {
    localStorage.setItem(PAGE_STORAGE_KEY, page)

    const targetPath = PAGE_TO_PATH[page] || '/'
    if (normalizePathname(window.location.pathname) !== targetPath) {
      const nextUrl = `${targetPath}${window.location.search}`
      window.history.replaceState(null, '', nextUrl)
    }
  }, [page])

  useEffect(() => {
    const onPopState = () => {
      const fromPath = readPageFromPathname(window.location.pathname)
      if (!fromPath) return
      setPage((current) => (current === fromPath ? current : fromPath))
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return (
    <AuthProvider>
      <AppLayout
        page={page}
        setPage={setPagePersisted}
        onOpenPlayerDashboard={(playerId) => setDashboardPlayerId(playerId)}
      >
        <Router
          page={page}
          setPage={setPagePersisted}
          dashboardPlayerId={dashboardPlayerId}
        />
      </AppLayout>
    </AuthProvider>
  )
}
