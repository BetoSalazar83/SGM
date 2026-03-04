import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import './index.css';

import Usuarios from './pages/Usuarios';
import Pedidos from './pages/Pedidos';
import Operaciones from './pages/Operaciones';

// AuthGuard component to protect routes
const AuthGuard = ({ children }) => {
  const token = localStorage.getItem('sgm_token');
  if (!token) return <Navigate to="/" replace />;
  return children;
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        {/* Rutas protegidas dentro del Layout */}
        <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/pedidos" element={<Pedidos />} />
          <Route path="/operaciones" element={<Operaciones />} />
        </Route>

        {/* Redirect default al login por ahora */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
