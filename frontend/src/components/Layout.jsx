import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
    LayoutDashboard,
    Users,
    FileText,
    ClipboardList,
    LogOut,
    Menu,
    Activity,
    UserCircle,
    ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import './Layout.css';

// Axios interceptor for JWT
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('sgm_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const SidebarItem = ({ to, icon: Icon, label }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
    >
        <Icon className="nav-item-icon" />
        <span>{label}</span>
    </NavLink>
);

const UserHeader = ({ user, onLogout }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`top-user-nav ${isOpen ? 'expanded' : ''}`} onMouseEnter={() => setIsOpen(true)} onMouseLeave={() => setIsOpen(false)} onClick={() => setIsOpen(!isOpen)}>
            <div className="user-profile-top">
                <div className="user-avatar-sm">
                    {user?.name?.charAt(0) || 'U'}
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            className="user-dropdown-content"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                        >
                            <div className="user-info-top">
                                <span className="user-name-top">{user?.name}</span>
                                <span className="user-role-top">{user?.role}</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onLogout(); }}
                                className="logout-icon-btn"
                                title="Cerrar Sesión"
                            >
                                <LogOut size={18} />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
                <ChevronDown size={14} className={`dropdown-arrow ${isOpen ? 'rotated' : ''}`} />
            </div>
        </div>
    );
};

const Layout = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const userData = localStorage.getItem('sgm_user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);

            // Redirect technicians away from admin routes
            const isAdmin = parsedUser.role === 'Administrador';
            const adminRoutes = ['/dashboard', '/usuarios', '/pedidos'];
            if (!isAdmin && adminRoutes.includes(window.location.pathname)) {
                navigate('/operaciones');
            }
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('sgm_token');
        localStorage.removeItem('sgm_user');
        navigate('/');
    };

    const isAdmin = user?.role === 'Administrador';

    return (
        <div className={`app-layout ${!isAdmin ? 'no-sidebar' : ''}`}>
            {isAdmin && (
                <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
                    <div className="sidebar-header">
                        <Activity className="logo-icon" />
                        <span className="brand-name">SGM</span>
                    </div>

                    <nav className="nav-menu">
                        <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" />
                        <SidebarItem to="/usuarios" icon={Users} label="Usuarios" />
                        <SidebarItem to="/pedidos" icon={FileText} label="Pedidos" />
                        <SidebarItem to="/operaciones" icon={ClipboardList} label="Operaciones" />
                    </nav>

                    <div className="sidebar-footer" style={{ border: 'none', padding: 0 }}>
                        {/* Footer is now simpler as info is on top */}
                        <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                            SGM v1.2.0
                        </p>
                    </div>
                </aside>
            )}

            <main className="main-content">
                <UserHeader user={user} onLogout={handleLogout} />
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
