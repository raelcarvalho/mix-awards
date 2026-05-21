import { useState } from 'react'
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
  const [page, setPage] = useState<Page>('home')
  const [dashboardPlayerId, setDashboardPlayerId] = useState<number | null>(null)

  return (
    <AuthProvider>
      <AppLayout
        page={page}
        setPage={setPage}
        onOpenPlayerDashboard={(playerId) => setDashboardPlayerId(playerId)}
      >
        <Router
          page={page}
          setPage={setPage}
          dashboardPlayerId={dashboardPlayerId}
        />
      </AppLayout>
    </AuthProvider>
  )
}
