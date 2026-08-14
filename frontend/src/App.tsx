import { Routes, Route } from 'react-router-dom';
import { RequireAuth } from './components/requireAuth.js';
import { AuthPage } from './pages/authPage.js';
import { ProjectListPage } from './pages/projectListPage.js';
import { NewProjectPage } from './pages/newProjectPage.js';
import { ProjectDetailPage } from './pages/projectDetailPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route
        path="/projects"
        element={
          <RequireAuth>
            <ProjectListPage />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/new"
        element={
          <RequireAuth>
            <NewProjectPage />
          </RequireAuth>
        }
      />
      <Route
        path="/projects/:id"
        element={
          <RequireAuth>
            <ProjectDetailPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
