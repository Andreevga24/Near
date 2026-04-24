/**
 * Корневой layout: маршруты и провайдер авторизации.
 */

import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { AppLayout } from './components/AppLayout'
import { RequireAuth } from './components/RequireAuth'
import { AuthProvider } from './context/AuthContext'
import { HomePage } from './pages/HomePage'
import { LoginPage } from './pages/LoginPage'
import { ProjectBoardPage } from './pages/ProjectBoardPage'
import { ProjectFocusPage } from './pages/ProjectFocusPage'
import { ProfileSettingsPage } from './pages/ProfileSettingsPage'
import { PresetEditorPage } from './pages/PresetEditorPage'
import { ProjectsCarouselPage } from './pages/ProjectsCarouselPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { PublicProjectBoardPage } from './pages/PublicProjectBoardPage'
import { RegisterPage } from './pages/RegisterPage'
import { CompanyPage } from './pages/CompanyPage'
import { MessengerPage } from './pages/MessengerPage'
import { FeedPage } from './pages/FeedPage'
import { ReportsPage } from './pages/ReportsPage'
import { SupportPage } from './pages/SupportPage'
import { WorkspacePlaceholderPage } from './pages/WorkspacePlaceholderPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
