import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    FileText,
    UploadCloud,
    FileSpreadsheet,
    MoreVertical,
    Calendar,
    CheckCircle,
    AlertCircle,
    X,
    Trash2,
    AlertTriangle
} from 'lucide-react';
import { API_BASE_URL } from '../config';
import '../components/Layout.css';
import './Pedidos.css';

const API_BASE = API_BASE_URL;

const UploadModal = ({ isOpen, onClose, onRefresh }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            setFile(droppedFiles[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE}/orders/import`, {
                method: 'POST',
                body: formData,
            });

            if (response.ok) {
                alert("Archivo procesado e importado con éxito.");
                onRefresh();
                onClose();
            } else {
                const err = await response.json();
                alert(`Error: ${err.detail || "No se pudo procesar el archivo"}`);
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Error de conexión con el servidor.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                className="modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{ zIndex: 1000 }}
            >
                <motion.div
                    className="glass-panel modal-content"
                    initial={{ scale: 0.9, opacity: 0, y: 20 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, y: 20 }}
                    style={{ maxWidth: '600px' }}
                >
                    <div className="modal-header">
                        <h3>Importar Nuevo Pedido</h3>
                        <button onClick={onClose} className="icon-btn"><X size={20} /></button>
                    </div>

                    <div
                        className={`upload-dropzone ${isDragging ? 'active' : ''}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <UploadCloud className="upload-icon" />
                        <div className="upload-text">
                            <h3>Arrastra tu archivo aquí</h3>
                            <p>Soporta formato Excel (.xlsx)</p>
                        </div>
                        <button className="glass-button btn-secondary" onClick={() => document.getElementById('fileInput').click()}>
                            Seleccionar Archivo
                        </button>
                        <input
                            id="fileInput"
                            type="file"
                            hidden
                            accept=".xlsx,.xls"
                            onChange={(e) => setFile(e.target.files[0])}
                        />
                    </div>

                    {file && (
                        <motion.div
                            className="file-preview"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            <div className="file-info">
                                <FileSpreadsheet size={24} color="#22c55e" />
                                <div>
                                    <div style={{ fontWeight: 500 }}>{file.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        {(file.size / 1024).toFixed(2)} KB
                                    </div>
                                </div>
                            </div>
                            <button onClick={() => setFile(null)} className="icon-btn"><X size={16} /></button>
                        </motion.div>
                    )}

                    <div className="modal-actions" style={{ marginTop: '2rem' }}>
                        <button onClick={onClose} className="glass-button btn-secondary">Cancelar</button>
                        <button
                            onClick={handleUpload}
                            className="glass-button btn-primary"
                            disabled={!file || isUploading}
                            style={{ opacity: (file && !isUploading) ? 1 : 0.5 }}
                        >
                            {isUploading ? 'Procesando...' : 'Procesar Archivo'}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const DeleteModal = ({ isOpen, onClose, onConfirm, orderId }) => {
    const [confirmId, setConfirmId] = useState('');

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div className="modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ zIndex: 1100 }}>
                <motion.div className="glass-panel modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                    <AlertTriangle size={48} color="var(--danger)" style={{ marginBottom: '1rem' }} />
                    <h3 style={{ color: 'var(--danger)' }}>¿Eliminar Pedido?</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                        Esta acción eliminará permanentemente el pedido <strong>{orderId}</strong> y todos sus avisos asociados.
                    </p>

                    <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                        <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem' }}>
                            Escribe el ID del pedido para confirmar:
                        </label>
                        <input
                            type="text"
                            className="glass-input"
                            style={{ width: '100%', borderColor: confirmId === orderId ? 'var(--success)' : 'rgba(255,255,255,0.1)' }}
                            placeholder={orderId}
                            value={confirmId}
                            onChange={(e) => setConfirmId(e.target.value)}
                        />
                    </div>

                    <div className="modal-actions">
                        <button onClick={onClose} className="glass-button btn-secondary">Cancelar</button>
                        <button
                            onClick={onConfirm}
                            className="glass-button btn-danger"
                            disabled={confirmId !== orderId}
                            style={{ opacity: confirmId === orderId ? 1 : 0.5 }}
                        >
                            Eliminar Definitivamente
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

const StatusChip = ({ status }) => {
    let color = 'var(--text-secondary)';
    let bg = 'rgba(255,255,255,0.1)';

    switch (status) {
        case 'Pendiente':
            color = '#f59e0b';
            bg = 'rgba(245, 158, 11, 0.2)';
            break;
        case 'En Proceso':
            color = '#38bdf8';
            bg = 'rgba(56, 189, 248, 0.2)';
            break;
        case 'Facturado':
            color = '#22c55e';
            bg = 'rgba(34, 197, 94, 0.2)';
            break;
        case 'Atendido':
            color = '#22c55e';
            bg = 'rgba(34, 197, 94, 0.2)';
            break;
    }

    return (
        <span style={{
            color,
            backgroundColor: bg,
            padding: '0.2rem 0.6rem',
            borderRadius: '20px',
            fontSize: '0.8rem',
            fontWeight: 500
        }}>
            {status}
        </span>
    );
};

const Pedidos = () => {
    const [isUploadOpen, setUploadOpen] = useState(false);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedForDelete, setSelectedForDelete] = useState(null);
    const [menuOpenId, setMenuOpenId] = useState(null);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/orders`);
            if (response.ok) {
                const data = await response.json();
                setOrders(data);
            }
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchOrders();
    }, []);

    const handleDelete = async () => {
        if (!selectedForDelete) return;
        try {
            const response = await fetch(`${API_BASE}/orders/${selectedForDelete}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                setOrders(prev => prev.filter(o => (o.RowKey || o.id) !== selectedForDelete));
                setSelectedForDelete(null);
            }
        } catch (error) {
            alert("No se pudo eliminar el pedido.");
        }
    };

    return (
        <div className="pedidos-page">
            <div className="page-header">
                <div className="page-title">
                    <motion.h1
                        initial={{ opacity: 0.5, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        Administración de Pedidos
                    </motion.h1>
                    <p>Carga masiva de órdenes y seguimiento de estatus.</p>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setUploadOpen(true)}
                    className="glass-button btn-primary"
                >
                    <UploadCloud size={18} />
                    <span>Importar Pedido (Excel)</span>
                </motion.button>
            </div>

            <div className="glass-panel table-container" style={{ position: 'relative' }}>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Año/Mes</th>
                            <th>ID Pedido</th>
                            <th>Tipo</th>
                            <th className="text-center">Total</th>
                            <th>Avisos (P/C)</th>
                            <th>Estatus / Avance</th>
                            <th className="text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>Cargando registros...</td></tr>
                        ) : orders.length > 0 ? (
                            orders.map((order) => {
                                const oid = order.RowKey || order.id || order.order_number;
                                return (
                                    <tr key={oid}>
                                        <td>
                                            <div style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                                                {order.year} - {order.month}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontWeight: 600, color: 'var(--accent-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <FileText size={16} />
                                                {oid}
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                {order.order_type || 'Preventivo'}
                                            </div>
                                        </td>
                                        <td className="text-center" style={{ fontWeight: 600 }}>{order.total_assets}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <span className="count-badge count-prev" title="Preventivos">P: {order.prev_count || 0}</span>
                                                <span className="count-badge count-corr" title="Correctivos">C: {order.corr_count || 0}</span>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <StatusChip status={order.status} />
                                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                                        ({order.progress || 0}%: {order.completed_count || 0} / {order.total_assets})
                                                    </span>
                                                </div>
                                                <div className="progress-container" style={{ width: '100%', marginTop: 0 }}>
                                                    <div className="progress-bar" style={{ width: `${order.progress || 0}%` }}></div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-right">
                                            <div style={{ position: 'relative', display: 'inline-block' }}>
                                                <button
                                                    className="icon-btn"
                                                    onClick={() => setMenuOpenId(menuOpenId === oid ? null : oid)}
                                                >
                                                    <MoreVertical size={18} />
                                                </button>

                                                {menuOpenId === oid && (
                                                    <div className="glass-panel context-menu">
                                                        <button
                                                            className="menu-item delete"
                                                            onClick={() => {
                                                                setSelectedForDelete(oid);
                                                                setMenuOpenId(null);
                                                            }}
                                                        >
                                                            <Trash2 size={14} />
                                                            <span>Eliminar</span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        ) : (
                            <tr><td colSpan="7" style={{ textAlign: 'center', padding: '2rem' }}>No hay pedidos cargados.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <UploadModal
                isOpen={isUploadOpen}
                onClose={() => setUploadOpen(false)}
                onRefresh={fetchOrders}
            />

            <DeleteModal
                isOpen={!!selectedForDelete}
                onClose={() => setSelectedForDelete(null)}
                onConfirm={handleDelete}
                orderId={selectedForDelete}
            />
        </div>
    );
};

export default Pedidos;

