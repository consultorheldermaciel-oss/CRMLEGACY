import { Navigate, Route, BrowserRouter, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CrmProvider } from './context/CrmContext'
import { UiProvider } from './context/UiContext'
import LoginPage from './pages/LoginPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import { AppShell } from './pages/AppShell'

function ProtectedApp() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted text-sm">
        Carregando…
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted text-sm px-4 text-center">
        Sua conta ainda não tem um perfil configurado. Peça ao líder de unidade para verificar seu convite.
      </div>
    )
  }

  return (
    <CrmProvider>
      <UiProvider>
        <AppShell />
      </UiProvider>
    </CrmProvider>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/convite/:token" element={<AcceptInvitePage />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
