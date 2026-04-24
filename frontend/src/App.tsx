/**
 * Корневой layout: маршруты и провайдер авторизации.
 */

import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'

const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })))
const PublicProjectBoardPage = lazy(() =>
  import('./pages/PublicProjectBoardPage').then((m) => ({ default: m.PublicProjectBoardPage })),
)
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('./pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))

const ProjectsCarouselPage = lazy(() =>
  import('./pages/ProjectsCarouselPage').then((m) => ({ default: m.ProjectsCarouselPage })),
)
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })))
const ProjectBoardPage = lazy(() =>
  import('./pages/ProjectBoardPage').then((m) => ({ default: m.ProjectBoardPage })),
)
const ProjectFocusPage = lazy(() =>
  import('./pages/ProjectFocusPage').then((m) => ({ default: m.ProjectFocusPage })),
)
const ProfileSettingsPage = lazy(() =>
  import('./pages/ProfileSettingsPage').then((m) => ({ default: m.ProfileSettingsPage })),
)
const PresetEditorPage = lazy(() =>
  import('./pages/PresetEditorPage').then((m) => ({ default: m.PresetEditorPage })),
)
const CompanyPage = lazy(() => import('./pages/CompanyPage').then((m) => ({ default: m.CompanyPage })))
const MessengerPage = lazy(() => import('./pages/MessengerPage').then((m) => ({ default: m.MessengerPage })))
const FeedPage = lazy(() => import('./pages/FeedPage').then((m) => ({ default: m.FeedPage })))
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })))
const SupportPage = lazy(() => import('./pages/SupportPage').then((m) => ({ default: m.SupportPage })))
const WorkspacePlaceholderPage = lazy(() =>
  import('./pages/WorkspacePlaceholderPage').then((m) => ({ default: m.WorkspacePlaceholderPage })),
)

function AppFallback() {
  return <div className="flex min-h-svh items-center justify-center text-slate-400">Загрузка…</div>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<AppFallback />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/public/:shareId" element={<PublicProjectBoardPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route path="/projects/carousel" element={<ProjectsCarouselPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:projectId" element={<ProjectBoardPage />} />
              <Route path="/projects/:projectId/focus" element={<ProjectFocusPage />} />
              <Route path="/settings" element={<ProfileSettingsPage />} />
              <Route path="/settings/presets" element={<PresetEditorPage />} />
              <Route path="/workspace/company" element={<CompanyPage />} />
              <Route path="/workspace/messenger" element={<MessengerPage />} />
              <Route path="/workspace/feed" element={<FeedPage />} />
              <Route path="/workspace/reports" element={<ReportsPage />} />
              <Route path="/workspace/support" element={<SupportPage />} />
              <Route path="/workspace/:sectionId" element={<WorkspacePlaceholderPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
