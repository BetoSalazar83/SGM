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
    ChevronDown,
    X as CloseIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import './Layout.css';

// Axios interceptor for JWT
axios.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('sgm_token');
        if (token) {
            config.headers['X-Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

const SidebarItem = ({ to, icon: Icon, label, onClick }) => (
    <NavLink
        to={to}
        className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        onClick={onClick}
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

// Routes each role is allowed to visit. Roles not listed here default to Operaciones only.
const ROLE_ROUTES = {
    'Administrador': ['/dashboard', '/usuarios', '/pedidos', '/operaciones'],
    'Project Manager': ['/dashboard', '/operaciones'],
    'Técnico': ['/operaciones'],
};
const DEFAULT_ROUTES = ['/operaciones'];

const Layout = () => {
    const navigate = useNavigate();
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState(null);

    const handleNavClick = () => {
        if (window.innerWidth <= 768) {
            setSidebarOpen(false);
        }
    };

    useEffect(() => {
        const userData = localStorage.getItem('sgm_user');
        if (userData) {
            const parsedUser = JSON.parse(userData);
            setUser(parsedUser);

            // Redirect users away from routes their role can't access
            const allowedRoutes = ROLE_ROUTES[parsedUser.role] || DEFAULT_ROUTES;
            if (!allowedRoutes.includes(window.location.pathname)) {
                navigate('/operaciones');
            }
        }
    }, [navigate]);

    const handleLogout = () => {
        localStorage.removeItem('sgm_token');
        localStorage.removeItem('sgm_user');
        navigate('/');
    };

    const allowedRoutes = ROLE_ROUTES[user?.role] || DEFAULT_ROUTES;
    const hasSidebar = allowedRoutes.length > 1;

    return (
        <div className={`app-layout ${!hasSidebar ? 'no-sidebar' : ''}`}>
            {/* Mobile Header Toggle - Visible for roles with a sidebar OR on mobile screens for any user */}
            {(hasSidebar || window.innerWidth <= 768) && (
                <button
                    className="mobile-toggle-btn"
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                    aria-label="Toggle menu"
                >
                    {isSidebarOpen ? <CloseIcon size={24} /> : <Menu size={24} />}
                </button>
            )}

            {hasSidebar && (
                <>
                    {/* Backdrop for mobile */}
                    <AnimatePresence>
                        {isSidebarOpen && (
                            <motion.div
                                className="sidebar-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setSidebarOpen(false)}
                            />
                        )}
                    </AnimatePresence>

                    <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : ''}`}>
                        <div className="sidebar-header">
                            <Activity className="logo-icon" />
                            <span className="brand-name">SGM</span>
                            {/* Close button inside sidebar for mobile */}
                            <button className="sidebar-close-mobile" onClick={() => setSidebarOpen(false)}>
                                <CloseIcon size={20} />
                            </button>
                        </div>

                        <nav className="nav-menu">
                            {allowedRoutes.includes('/dashboard') && <SidebarItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" onClick={handleNavClick} />}
                            {allowedRoutes.includes('/usuarios') && <SidebarItem to="/usuarios" icon={Users} label="Usuarios" onClick={handleNavClick} />}
                            {allowedRoutes.includes('/pedidos') && <SidebarItem to="/pedidos" icon={FileText} label="Pedidos" onClick={handleNavClick} />}
                            {allowedRoutes.includes('/operaciones') && <SidebarItem to="/operaciones" icon={ClipboardList} label="Operaciones" onClick={handleNavClick} />}
                        </nav>

                        <div className="sidebar-footer" style={{ border: 'none', padding: 0 }}>
                            {/* Footer is now simpler as info is on top */}
                            <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem' }}>
                                SGM v1.2.0
                            </p>
                        </div>
                    </aside>
                </>
            )}

            <main className="main-content">
                <UserHeader user={user} onLogout={handleLogout} />
                <Outlet />
            </main>
        </div>
    );
};

export default Layout;
