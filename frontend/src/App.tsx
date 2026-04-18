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
import { ProfileSettingsPage } from './pages/ProfileSettingsPage'
import { ProjectsCarouselPage } from './pages/ProjectsCarouselPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { RegisterPage } from './pages/RegisterPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
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
            <Route path="/settings" element={<ProfileSettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
