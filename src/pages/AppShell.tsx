import { Header } from '../components/Header'
import { TaskModal } from '../components/modals/TaskModal'
import { useUi } from '../context/UiContext'
import { DashboardPage } from './DashboardPage'
import { EquipePage } from './EquipePage'
import { RemuneracaoPage } from './RemuneracaoPage'
import { LembretesPage } from './LembretesPage'
import { CarteiraPage } from './CarteiraPage'
import { HotListPage } from './HotListPage'

export function AppShell() {
  const { screen } = useUi()

  return (
    <div className="min-h-screen bg-bg">
      <Header />
      <main className="px-4 sm:px-7 py-6 max-w-[1400px] mx-auto pb-16">
        {screen === 'dashboard' && <DashboardPage />}
        {screen === 'equipe' && <EquipePage />}
        {screen === 'remuneracao' && <RemuneracaoPage />}
        {screen === 'lembretes' && <LembretesPage />}
        {screen === 'carteira' && <CarteiraPage />}
        {screen === 'hotlist' && <HotListPage />}
      </main>
      <TaskModal />
    </div>
  )
}
