import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Users,
    Search,
    Plus,
    MoreVertical,
    Shield,
    Wrench,
    X,
    Check,
    Trash2,
    Key,
    AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import '../components/Layout.css';
import './Usuarios.css';

const API_BASE = API_BASE_URL;

const RoleBadge = ({ role }) => {
    const isAdmin = role === 'Administrador';
    return (
        <span className={`role-badge ${isAdmin ? 'role-admin' : 'role-tech'}`}>
            {isAdmin ? <Shield size={14} /> : <Wrench size={14} />}
            {role}
        </span>
    );
};

const StatusBadge = ({ status }) => (
    <span className={`status-badge ${status === 'Activo' ? 'status-active' : 'status-inactive'}`}>
        <span className="status-dot"></span>
        {status}
    </span>
);

const UserModal = ({ isOpen, onClose, user, onSave, loading }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Técnico',
        status: 'Activo'
    });

    useEffect(() => {
        if (user) {
            setFormData({
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status
            });
        } else {
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'Técnico',
                status: 'Activo'
            });
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <motion.div className="glass-panel modal-content" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <div className="modal-header">
                        <h3>{user ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
                        <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                    </div>

                    <form className="modal-form" onSubmit={(e) => { e.preventDefault(); onSave(formData); }}>
                        <div className="form-group">
                            <label>Nombre Completo</label>
                            <input
                                type="text"
                                className="glass-input"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Ej. Juan Perez"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Correo Electrónico</label>
                            <input
                                type="email"
                                className="glass-input"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                placeholder="juan@empresa.com"
                                required
                                disabled={!!user}
                            />
                        </div>

                        {!user && (
                            <div className="form-group">
                                <label>Contraseña Inicial</label>
                                <input
                                    type="password"
                                    className="glass-input"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    placeholder="Contraseña temporal"
                                    required
                                />
                            </div>
                        )}

                        <div className="form-row">
                            <div className="form-group">
                                <label>Rol</label>
                                <select
                                    className="glass-input"
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                >
                                    <option value="Administrador">Administrador</option>
                                    <option value="Técnico">Técnico</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Estatus</label>
                                <select
                                    className="glass-input"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="Activo">Activo</option>
                                    <option value="Inactivo">Inactivo</option>
                                </select>
                            </div>
                        </div>

                        <div className="modal-actions">
                            <button type="button" onClick={onClose} className="glass-button btn-secondary">Cancelar</button>
                            <button type="submit" className="glass-button btn-primary" disabled={loading}>
                                {loading ? 'Guardando...' : (user ? 'Guardar Cambios' : 'Crear Usuario')}
                            </button>
                        </div>
                    </form>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const SuccessModal = ({ isOpen, onClose, tempPassword, email }) => {
    if (!isOpen) return null;
    return (
        <AnimatePresence>
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ zIndex: 2000 }}>
                <motion.div className="glass-panel modal-content" style={{ maxWidth: '400px' }}>
                    <div className="modal-header">
                        <Check className="text-success" size={24} />
                        <h3>Contraseña Reseteada</h3>
                    </div>
                    <div className="reset-success-body">
                        <p>Se ha generado una nueva contraseña temporal para <strong>{email}</strong>:</p>
                        <div className="temp-pwd-box">{tempPassword}</div>
                        <p className="text-muted small">Por favor, compártala con el usuario de forma segura.</p>
                    </div>
                    <div className="modal-actions">
                        <button onClick={onClose} className="glass-button btn-primary">Cerrar</button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const Usuarios = () => {
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSuccessOpen, setIsSuccessOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const [tempPassword, setTempPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('sgm_token');
            const response = await axios.get(`${API_BASE}/users/`, {
                headers: { 'X-Authorization': token ? `Bearer ${token}` : '' }
            });
            setUsers(response.data);
        } catch (err) {
            setError('Error al cargar usuarios');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (data) => {
        setLoading(true);
        try {
            const token = localStorage.getItem('sgm_token');
            const config = { headers: { 'X-Authorization': token ? `Bearer ${token}` : '' } };
            if (selectedUser) {
                // Update (solo nombre, rol y estatus)
                // Implementar endpoint PUT /users/{email} en el futuro o usar POST upsert
                await axios.post(`${API_BASE}/users/`, data, config);
            } else {
                // Create
                await axios.post(`${API_BASE}/users/`, data, config);
            }
            setIsModalOpen(false);
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.detail || 'Error al guardar usuario');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (email) => {
        if (!window.confirm(`¿Está seguro de eliminar al usuario ${email}?`)) return;
        try {
            const token = localStorage.getItem('sgm_token');
            await axios.delete(`${API_BASE}/users/${email}`, {
                headers: { 'X-Authorization': token ? `Bearer ${token}` : '' }
            });
            fetchUsers();
        } catch (err) {
            alert('Error al eliminar usuario');
        }
    };

    const handleReset = async (email) => {
        if (!window.confirm(`Se generará una nueva contraseña para ${email}. ¿Continuar?`)) return;
        try {
            const token = localStorage.getItem('sgm_token');
            const response = await axios.post(`${API_BASE}/users/${email}/reset-password`, {}, {
                headers: { 'X-Authorization': token ? `Bearer ${token}` : '' }
            });
            setTempPassword(response.data.temp_password);
            setSelectedUser({ email });
            setIsSuccessOpen(true);
        } catch (err) {
            alert('Error al resetear contraseña');
        }
    };

    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            u.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesRole = roleFilter === 'all' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="usuarios-page">
            <div className="page-header">
                <div className="page-title">
                    <motion.h1 initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                        Gestión de Usuarios
                    </motion.h1>
                    <p>Administra el acceso y roles del personal.</p>
                </div>

                <motion.button onClick={() => { setSelectedUser(null); setIsModalOpen(true); }} className="glass-button btn-primary">
                    <Plus size={18} />
                    <span>Nuevo Usuario</span>
                </motion.button>
            </div>

            <div className="toolbar glass-panel">
                <div className="search-wrapper">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o correo..."
                        className="glass-input search-input"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                <div className="toolbar-actions">
                    <select className="glass-input filter-select" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                        <option value="all">Todos los Roles</option>
                        <option value="Administrador">Administradores</option>
                        <option value="Técnico">Técnicos</option>
                    </select>
                </div>
            </div>

            {loading && users.length === 0 ? (
                <div className="loading-state">Cargando usuarios...</div>
            ) : (
                <motion.div className="glass-panel table-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Rol</th>
                                <th>Estatus</th>
                                <th className="text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map((user, index) => (
                                <motion.tr key={user.RowKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * index }}>
                                    <td>
                                        <div className="user-cell">
                                            <div className="user-avatar-sm">{user.name.charAt(0)}</div>
                                            <div>
                                                <div className="user-name">{user.name}</div>
                                                <div className="user-email">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td><RoleBadge role={user.role} /></td>
                                    <td><StatusBadge status={user.status} /></td>
                                    <td className="text-right">
                                        <div className="actions-cell">
                                            <button onClick={() => handleReset(user.email)} className="icon-btn text-warning" title="Reset Password">
                                                <Key size={18} />
                                            </button>
                                            <button onClick={() => { setSelectedUser(user); setIsModalOpen(true); }} className="icon-btn" title="Editar">
                                                <MoreVertical size={18} />
                                            </button>
                                            <button onClick={() => handleDelete(user.email)} className="icon-btn text-error" title="Eliminar">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </motion.div>
            )}

            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSave={handleSave}
                loading={loading}
            />

            <SuccessModal
                isOpen={isSuccessOpen}
                onClose={() => setIsSuccessOpen(false)}
                tempPassword={tempPassword}
                email={selectedUser?.email}
            />
        </div>
    );
};

export default Usuarios;
