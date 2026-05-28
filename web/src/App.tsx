import { useEffect, useMemo, useState } from 'react'
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
]

function isValidPage(value: unknown): value is Page {
  return typeof value === 'string' && PAGE_VALUES.includes(value as Page)
}

function readInitialPage(): Page {
  if (typeof window === 'undefined') return 'home'

  const fromHash = decodeURIComponent(String(window.location.hash || '').replace(/^#/, '').trim())
  if (isValidPage(fromHash)) return fromHash

  const fromStorage = String(localStorage.getItem(PAGE_STORAGE_KEY) || '').trim()
  if (isValidPage(fromStorage)) return fromStorage

  return 'home'
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
    default:               return <HomePage setPage={setPage} />
  }
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

    const hash = `#${encodeURIComponent(page)}`
    if (window.location.hash !== hash) {
      const nextUrl = `${window.location.pathname}${window.location.search}${hash}`
      window.history.replaceState(null, '', nextUrl)
    }
  }, [page])

  useEffect(() => {
    const onHashChange = () => {
      const fromHash = decodeURIComponent(
        String(window.location.hash || '').replace(/^#/, '').trim()
      )
      if (!isValidPage(fromHash)) return
      setPage((current) => (current === fromHash ? current : fromHash))
    }

    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
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
