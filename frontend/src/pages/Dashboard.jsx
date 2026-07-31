import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    CheckCircle,
    Clock,
    AlertTriangle,
    FileText,
    ExternalLink,
    Calendar,
    Settings
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import '../components/Layout.css';

const API_BASE = API_BASE_URL;

const StatCard = ({ title, value, icon: Icon, color, delay }) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay, duration: 0.5 }}
        className="glass-panel stat-card"
    >
        <div style={{ flex: 1 }}>
            <div className="stat-content">
                <h3 style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{title}</h3>
                <div className="stat-value" style={{ fontSize: '1.8rem', fontWeight: '700' }}>{value}</div>
            </div>
        </div>
        <div className="stat-icon-bg" style={{
            color: color,
            background: `${color}15`,
            padding: '12px',
            borderRadius: '12px'
        }}>
            <Icon size={24} />
        </div>
    </motion.div>
);

const Dashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const token = localStorage.getItem('sgm_token');
            const response = await axios.get(`${API_BASE}/dashboard/stats`, {
                headers: { 'X-Authorization': token ? `Bearer ${token}` : '' }
            });
            setStats(response.data);
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !stats) {
        return <div className="loading-container">Cargando Dashboard...</div>;
    }

    // Productivity Color Logic
    const getProductivityColor = (score) => {
        if (score <= 50) return '#ef4444'; // Red
        if (score <= 80) return '#f59e0b'; // Yellow
        return '#22c55e'; // Green
    };

    const prodColor = getProductivityColor(stats.productivity.score);

    return (
        <div>
            <div className="page-header">
                <div className="page-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        Dashboard Ejecutivo
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        Métricas en tiempo real desde Azure Storage.
                    </motion.p>
                </div>
                <div className="glass-button" onClick={fetchStats}>
                    Actualizar
                </div>
            </div>

            {/* KPI Cards */}
            <div className="dashboard-grid">
                <StatCard
                    title="Total Pedidos"
                    value={stats.counters.total_orders}
                    icon={FileText}
                    color="#38bdf8"
                    delay={0.1}
                />
                <StatCard
                    title="Avisos Atendidos"
                    value={stats.counters.attended_tasks}
                    icon={CheckCircle}
                    color="#22c55e"
                    delay={0.2}
                />
                <StatCard
                    title="Pendientes"
                    value={stats.counters.pending_tasks}
                    icon={Clock}
                    color="#f59e0b"
                    delay={0.3}
                />
                <StatCard
                    title="Críticos"
                    value={stats.counters.critical_tasks}
                    icon={AlertTriangle}
                    color="#ef4444"
                    delay={0.4}
                />
            </div>

            {/* Main Charts Area */}
            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                {/* Avance Semanal (Last 6 Months) */}
                <motion.div
                    className="glass-panel chart-container"
                    style={{ minWidth: 0 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    <div className="chart-header">
                        <h3>Avance Semanal (Últimos 6 Meses)</h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                            <Calendar size={14} /> 26 semanas
                        </div>
                    </div>
                    <div style={{ height: '300px', width: '100%', marginTop: '1rem' }}>
                        <ResponsiveContainer width="99%" height="100%">
                            <BarChart data={stats.weekly_advance}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis
                                    dataKey="name"
                                    stroke="var(--text-secondary)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="var(--text-secondary)"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <Tooltip
                                    contentStyle={{ background: '#1e293b', border: '1px solid var(--glass-border)', borderRadius: '8px' }}
                                    itemStyle={{ color: 'var(--accent-color)' }}
                                />
                                <Bar dataKey="atendidos" fill="var(--accent-color)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </motion.div>

                {/* Productividad (Last 15 Production Days) */}
                <motion.div
                    className="glass-panel chart-container"
                    style={{ minWidth: 0 }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <div className="chart-header">
                        <h3>Productividad (15 Días)</h3>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Meta: 120 eq.</div>
                    </div>
                    <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ position: 'relative', width: '100%', height: '180px' }}>
                            <ResponsiveContainer width="99%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[
                                            { value: stats.productivity.score || 0 },
                                            { value: 100 - (stats.productivity.score || 0) }
                                        ]}
                                        cx="50%"
                                        cy="100%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={0}
                                        dataKey="value"
                                    >
                                        <Cell fill={getProductivityColor(stats.productivity.score)} />
                                        <Cell fill="rgba(255,255,255,0.05)" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div style={{
                                position: 'absolute',
                                bottom: '10px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                textAlign: 'center'
                            }}>
                                <h2 style={{ margin: 0, fontSize: '2.2rem', color: getProductivityColor(stats.productivity.score) }}>{stats.productivity.score}%</h2>
                                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Efectividad</p>
                            </div>
                        </div>
                        <div style={{ marginTop: '0.5rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>
                                {stats.productivity.count} / {stats.productivity.target}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Equipos Atendidos</div>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Recent Activity Table */}
            <motion.div
                className="glass-panel"
                style={{ padding: '1.5rem' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
            >
                <div className="chart-header">
                    <h3>Avisos Recientes (Top 10 Atendidos)</h3>
                </div>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                <th style={{ padding: '1rem', fontWeight: 500 }}>ID Aviso</th>
                                <th style={{ padding: '1rem', fontWeight: 500 }}>Ubicación</th>
                                <th style={{ padding: '1rem', fontWeight: 500 }}>Tipo</th>
                                <th style={{ padding: '1rem', fontWeight: 500 }}>Fecha Cierre</th>
                                <th style={{ padding: '1rem', fontWeight: 500 }}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody style={{ fontSize: '0.95rem' }}>
                            {stats.recent_tasks.map((task) => (
                                <tr key={task.RowKey} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td
                                        style={{ padding: '1rem', color: 'var(--accent-color)', cursor: 'pointer', fontWeight: '500' }}
                                        onClick={() => navigate('/operaciones')} // Simplified link to operations
                                    >
                                        {task.RowKey}
                                    </td>
                                    <td style={{ padding: '1rem' }}>{task.location}</td>
                                    <td style={{ padding: '1rem' }}>
                                        <span style={{
                                            padding: '0.2rem 0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem',
                                            background: task.maintenance_type === 'Correctivo' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(56, 189, 248, 0.1)',
                                            color: task.maintenance_type === 'Correctivo' ? '#ef4444' : '#38bdf8'
                                        }}>
                                            {task.maintenance_type}
                                        </span>
                                    </td>
                                    <td style={{ padding: '1rem', color: 'var(--text-secondary)' }}>
                                        {new Date(task.completed_at).toLocaleDateString()}
                                    </td>
                                    <td style={{ padding: '1rem' }}>
                                        <button
                                            className="glass-button"
                                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                            onClick={() => navigate('/operaciones')}
                                        >
                                            <ExternalLink size={12} style={{ marginRight: '4px' }} />
                                            Ver
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {stats.recent_tasks.length === 0 && (
                                <tr>
                                    <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                        No hay avisos atendidos recientemente.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </motion.div>
        </div>
    );
};

export default Dashboard;
