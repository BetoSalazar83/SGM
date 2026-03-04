import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Activity, Mail, Lock, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Login.css';

const API_BASE = API_BASE_URL;

const Login = () => {
    const navigate = useNavigate();
    const [installPrompt, setInstallPrompt] = useState(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Redirect if already logged in
        const token = localStorage.getItem('sgm_token');
        if (token) {
            navigate('/dashboard');
        }

        const handler = (e) => {
            e.preventDefault();
            setInstallPrompt(e);
        };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, [navigate]);

    const handleInstall = async () => {
        if (!installPrompt) return;
        installPrompt.prompt();
        const { outcome } = await installPrompt.userChoice;
        if (outcome === 'accepted') setInstallPrompt(null);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log("Iniciando login para:", email);
            const response = await axios.post(`${API_BASE}/auth/login`, {
                email,
                password
            });

            const { access_token, user } = response.data;

            // Store auth data
            localStorage.setItem('sgm_token', access_token);
            localStorage.setItem('sgm_user', JSON.stringify(user));

            console.log("Login exitoso, redireccionando...");

            const target = user.role === 'Administrador' ? '/dashboard' : '/operaciones';
            window.location.href = target;
        } catch (err) {
            console.error("Error en login:", err);
            setError(err.response?.data?.detail || 'Error de conexión con el servidor');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        // Enlace a WhatsApp del admin (basado en el correo prellenado si hay uno)
        const msg = encodeURIComponent(`Hola, solicito recuperar mi contraseña para el SGM. Mi correo es: ${email || '[Ingresa tu correo aquí]'}`);
        window.open(`https://wa.me/521234567890?text=${msg}`, '_blank'); // Reemplazar con el número real del admin
    };

    return (
        <div className="login-container">
            <div className="login-bg" />
            <div className="login-overlay" />

            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="glass-panel login-card"
            >
                <div className="login-icon-wrapper">
                    <Activity className="login-icon" />
                </div>

                <div className="login-header">
                    <h1>SGM</h1>
                    <p>Sistema de Gestión de Mantenimiento</p>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="login-group">
                        <Mail size={18} className="login-input-icon" />
                        <input
                            type="email"
                            className="glass-input login-input"
                            placeholder="Correo electrónico"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    <div className="login-group">
                        <Lock size={18} className="login-input-icon" />
                        <input
                            type="password"
                            className="glass-input login-input"
                            placeholder="Contraseña"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                        />
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="login-error"
                        >
                            <AlertCircle size={14} />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={loading}
                        className="glass-button login-btn btn-primary"
                    >
                        {loading ? 'Entrando...' : 'Iniciar Sesión'}
                    </motion.button>

                    <div className="login-options">
                        <span className="forgot-password" onClick={handleForgotPassword}>
                            ¿Olvidaste tu contraseña?
                        </span>
                    </div>

                    {installPrompt && (
                        <motion.button
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            whileHover={{ scale: 1.02 }}
                            onClick={handleInstall}
                            className="glass-button login-btn install-btn"
                        >
                            <span>📲 Instalar Aplicación</span>
                        </motion.button>
                    )}
                </form>

                <p className="login-footer-text">
                    Acceso seguro persistente en Azure Table Storage
                </p>
            </motion.div>
        </div>
    );
};

export default Login;
