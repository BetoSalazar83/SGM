import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Calendar,
    MapPin,
    ChevronLeft,
    Camera,
    CheckCircle,
    AlertTriangle,
    FileText
} from 'lucide-react';
import '../components/Layout.css';
import './Operaciones.css';
import { get, set } from 'idb-keyval';
import { useSyncQueue } from '../hooks/useSyncQueue';
import { API_BASE_URL } from '../config';

const API_BASE = API_BASE_URL;

const TASKS_CACHE_KEY = 'sgm-tasks-cache';

// Mock Data for Tasks via Props or State
const MOCK_TASKS = [
    { id: 'AV-2024-81', orderId: 'PED-2024-001', year: '2024', month: '01', assetId: 'EQ-001', assetNumber: '44011214', type: 'Preventivo', asset: 'Compresor Aire A1', location: 'Sótano 2', status: 'Pendiente', priority: 'normal' },
    { id: 'AV-2024-85', orderId: 'PED-2024-001', year: '2024', month: '01', assetId: 'EQ-045', assetNumber: '44011215', type: 'Correctivo', asset: 'Elevador Carga', location: 'Planta Baja', status: 'Pendiente', priority: 'high' },
    { id: 'AV-2024-92', orderId: 'PED-2024-002', year: '2024', month: '02', assetId: 'EQ-102', assetNumber: '44011216', type: 'Preventivo', asset: 'Bomba de Agua B2', location: 'Azotea', status: 'Atendido', priority: 'normal' },
    { id: 'AV-2024-99', orderId: 'PED-2024-002', year: '2024', month: '02', assetId: 'EQ-888', assetNumber: '44011217', type: 'Preventivo', asset: 'Generador Princ.', location: 'Cuarto Máq.', status: 'Pendiente', priority: 'high' },
];

const EvidenceSlot = ({ label, onUpload, image }) => {
    return (
        <div className="evidence-box" onClick={() => document.getElementById(`upload-${label}`).click()}>
            {image ? (
                <>
                    <img src={image} alt={label} />
                    <div className="evidence-check"><CheckCircle size={14} /></div>
                    <div className="evidence-change-badge">Reemplazar</div>
                </>
            ) : (
                <>
                    <Camera size={28} color="var(--text-secondary)" />
                    <span className="evidence-label">{label}</span>
                </>
            )}
            <input
                id={`upload-${label}`}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            onUpload(reader.result); // This is the Base64 string
                        };
                        reader.readAsDataURL(file);
                    }
                }}
            />
        </div>
    );
};

const TaskDetail = ({ task, onClose, onComplete }) => {
    const [evidence, setEvidence] = useState({
        etiqueta: task.evidence_tag || null,
        antes: task.evidence_before || null,
        durante: task.evidence_during || null,
        despues: task.evidence_after || null
    });
    const [comments, setComments] = useState(task.closing_comments || '');
    const [equipmentNotFound, setEquipmentNotFound] = useState(task.equipmentNotFound || false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { isOnline, addToQueue, getQueueItem, checkRealConnectivity } = useSyncQueue();

    useEffect(() => {
        const loadLocalData = async () => {
            const local = await getQueueItem(task.id);
            if (local && local.data) {
                setEvidence({
                    etiqueta: local.data.evidence_etiqueta || task.evidence_tag,
                    antes: local.data.evidence_antes || task.evidence_before,
                    durante: local.data.evidence_durante || task.evidence_during,
                    despues: local.data.evidence_despues || task.evidence_after
                });
                setComments(local.data.comments || task.closing_comments);
                setEquipmentNotFound(local.data.equipment_not_found || task.equipmentNotFound || false);
            } else {
                setEvidence({
                    etiqueta: task.evidence_tag || null,
                    antes: task.evidence_before || null,
                    durante: task.evidence_during || null,
                    despues: task.evidence_after || null
                });
                setComments(task.closing_comments || '');
                setEquipmentNotFound(task.equipmentNotFound || false);
            }
        };
        loadLocalData();
    }, [task.id]); // ONLY trigger when the selected task ID changes

    const handleUpload = (type, url) => {
        setEvidence(prev => ({ ...prev, [type]: url }));
    };

    // 4 photos required + comments required (at least some text)
    const isComplete = Object.values(evidence).every(x => x !== null) && comments.trim().length > 3;

    const handleSubmit = async () => {
        if (!isComplete) return;
        setIsSubmitting(true);

        const payload = {
            comments: comments,
            evidence_etiqueta: evidence.etiqueta,
            evidence_antes: evidence.antes,
            evidence_durante: evidence.durante,
            evidence_despues: evidence.despues,
            equipment_not_found: equipmentNotFound
        };

        // Check real connectivity before attempting if browser thinks it's online
        let effectivelyOnline = navigator.onLine;
        if (effectivelyOnline) {
            effectivelyOnline = await checkRealConnectivity();
        }

        if (!effectivelyOnline) {
            await addToQueue(task.id, payload);
            alert("Sin conexión real detected. La orden se guardó localmente y se sincronizará automáticamente al recuperar internet.");
            onComplete(task.id, true, payload); // true indicates local/pending
            setIsSubmitting(false);
            return;
        }

        try {
            const token = localStorage.getItem('sgm_token');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

            const headers = { 'Content-Type': 'application/json' };
            if (token) {
                headers['X-Authorization'] = `Bearer ${token}`;
            }

            const response = await fetch(`${API_BASE}/tasks/${task.id}/complete`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                alert("Orden cerrada exitosamente");
                onComplete(task.id, false, payload);
            } else if (response.status === 401) {
                alert("Su sesión ha expirado por seguridad. Por favor, inicie sesión de nuevo.");
                localStorage.removeItem('sgm_token');
                localStorage.removeItem('sgm_user');
                navigate('/');
            } else if (response.status >= 500) {
                // If server is failing (probably storage or partial failure)
                await addToQueue(task.id, payload);
                alert("El servidor reportó un problema técnico. La orden se guardó localmente para sincronizarse automáticamente cuando el servicio se restablezca.");
                onComplete(task.id, true, payload);
            } else {
                alert("Error al cerrar la orden en el servidor (Valida los datos)");
            }
        } catch (error) {
            console.error("Error:", error);
            await addToQueue(task.id, payload);
            alert("Error de conexión. Se guardó localmente para reintentar luego.");
            onComplete(task.id, true, payload);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <motion.div
            className="detail-view"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
            <div className="detail-header">
                <button onClick={onClose} className="back-btn">
                    <ChevronLeft size={24} />
                </button>
                <div>
                    <h2 style={{ fontSize: '1.2rem', margin: 0 }}>{task.id}</h2>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Detalle de Orden</span>
                </div>
            </div>

            <div className="detail-content">
                {/* Info Section */}
                <div className="info-section">
                    <h3>Información del Activo</h3>
                    <div className="info-grid">
                        <div className="info-item">
                            <label>Pedido</label>
                            <p>{task.orderId}</p>
                        </div>
                        <div className="info-item">
                            <label>No. Activo</label>
                            <p>{task.assetNumber}</p>
                        </div>
                        <div className="info-item">
                            <label>Equipo</label>
                            <p>{task.assetId}</p>
                        </div>
                        <div className="info-item">
                            <label>Ubicación</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <MapPin size={14} color="var(--accent-color)" />
                                <p>{task.location}</p>
                            </div>
                        </div>
                        <div className="info-item">
                            <label>Tipo Mto.</label>
                            <p>{task.type}</p>
                        </div>
                    </div>
                </div>

                {/* Evidence Section */}
                <div className="info-section">
                    <h3>Evidencia Fotográfica</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Capture las 4 fotos requeridas para cerrar la orden.
                    </p>
                    <div className="evidence-grid">
                        <EvidenceSlot label="Etiqueta" image={evidence.etiqueta} onUpload={(url) => handleUpload('etiqueta', url)} />
                        <EvidenceSlot label="Antes" image={evidence.antes} onUpload={(url) => handleUpload('antes', url)} />
                        <EvidenceSlot label="Durante" image={evidence.durante} onUpload={(url) => handleUpload('durante', url)} />
                        <EvidenceSlot label="Después" image={evidence.despues} onUpload={(url) => handleUpload('despues', url)} />
                    </div>
                </div>

                {/* Closing Section */}
                <div className="info-section closing-section">
                    <h3>Cierre de Orden</h3>

                    <label className="not-found-checkbox-container" onClick={() => setEquipmentNotFound(!equipmentNotFound)}>
                        <input
                            type="checkbox"
                            checked={equipmentNotFound}
                            onChange={(e) => setEquipmentNotFound(e.target.checked)}
                            onClick={(e) => e.stopPropagation()}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <AlertTriangle size={18} />
                            <span>Equipo no localizado</span>
                        </div>
                    </label>

                    <textarea
                        className="glass-input"
                        placeholder="Comentarios finales, observaciones o repuestos utilizados..."
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                    ></textarea>
                </div>
            </div>

            <div className="action-bar">
                <button
                    className="glass-button btn-primary"
                    style={{ width: '100%', opacity: isComplete && !isSubmitting ? 1 : 0.5 }}
                    disabled={!isComplete || isSubmitting}
                    onClick={handleSubmit}
                >
                    <CheckCircle size={18} />
                    <span>
                        {isSubmitting ? 'Cerrando...' :
                            (task.status === 'Atendido' ? 'Actualizar y Guardar' : 'Confirmar y Cerrar')}
                    </span>
                </button>
            </div>
        </motion.div>
    );
};

const Operaciones = () => {
    const [selectedTask, setSelectedTask] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    const { isOnline, pendingCount, getAllQueueItems, processQueue, checkRealConnectivity } = useSyncQueue((syncedId) => {
        setTasks(prev => prev.map(t => t.id === syncedId ? { ...t, status: 'Atendido' } : t));
    });

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const token = localStorage.getItem('sgm_token');
                // Try to load from cache first for immediate UI
                const cached = await get(TASKS_CACHE_KEY);
                if (cached) setTasks(cached);

                const headers = {};
                if (token) {
                    headers['X-Authorization'] = `Bearer ${token}`;
                }

                const response = await fetch(`${API_BASE}/tasks`, {
                    headers
                });

                if (response.status === 401) {
                    localStorage.removeItem('sgm_token');
                    localStorage.removeItem('sgm_user');
                    navigate('/');
                    return;
                }

                if (response.ok) {
                    const data = await response.json();
                    const mappedTasks = data.map(t => ({
                        id: t.id,
                        orderId: t.order_id,
                        year: t.year || '',
                        month: t.month || '',
                        assetId: t.asset_id,
                        assetNumber: t.asset_number || '', // This is the real Activo
                        type: t.maintenance_type,
                        asset: t.asset_name,
                        location: t.location,
                        status: t.status === 'completed' ? 'Atendido' : (t.status === 'in_progress' ? 'En Progreso' : 'Pendiente'),
                        priority: t.priority,
                        evidence_tag: t.evidence_tag,
                        evidence_before: t.evidence_before,
                        evidence_during: t.evidence_during,
                        evidence_after: t.evidence_after,
                        closing_comments: t.closing_comments,
                        equipmentNotFound: t.equipment_not_found || false
                    }));

                    const finalTasks = mappedTasks.length > 0 ? mappedTasks : MOCK_TASKS;

                    // MERGE: Overwrite server data with pending local data
                    const pendingItems = await getAllQueueItems();
                    const mergedTasks = finalTasks.map(t => {
                        if (pendingItems[t.id]) {
                            const local = pendingItems[t.id].data;
                            return {
                                ...t,
                                status: 'Pendiente Sinc.',
                                evidence_tag: local.evidence_etiqueta || t.evidence_tag,
                                evidence_before: local.evidence_antes || t.evidence_before,
                                evidence_during: local.evidence_durante || t.evidence_during,
                                evidence_after: local.evidence_despues || t.evidence_after,
                                closing_comments: local.comments || t.closing_comments,
                                equipmentNotFound: local.equipment_not_found || t.equipmentNotFound
                            };
                        }
                        return t;
                    });

                    setTasks(mergedTasks);
                    await set(TASKS_CACHE_KEY, mergedTasks); // Update cache with merged data
                }
            } catch (error) {
                console.error("Error cargando tareas:", error);
                const cached = await get(TASKS_CACHE_KEY);
                if (!cached) setTasks(MOCK_TASKS);
            } finally {
                setLoading(false);
            }
        };

        fetchTasks();
    }, []);

    // Filters State
    const [filters, setFilters] = useState({
        month: '',
        aviso: '',
        asset: '',
        order: '',
        location: '',
        status: 'Todos',
        notFoundOnly: false
    });

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const handleSelectTask = (task) => {
        setSelectedTask(task);
    };

    const handleCloseTask = (taskId, isPendingSync = false, payload = null) => {
        setTasks(prev => {
            const updated = prev.map(t => {
                if (t.id === taskId) {
                    const baseUpdate = {
                        ...t,
                        status: isPendingSync ? 'Pendiente Sinc.' : 'Atendido'
                    };

                    if (payload) {
                        return {
                            ...baseUpdate,
                            evidence_tag: payload.evidence_etiqueta || t.evidence_tag,
                            evidence_before: payload.evidence_antes || t.evidence_before,
                            evidence_during: payload.evidence_durante || t.evidence_during,
                            evidence_after: payload.evidence_despues || t.evidence_after,
                            closing_comments: payload.comments || t.closing_comments,
                            equipmentNotFound: payload.equipment_not_found !== undefined ? payload.equipment_not_found : t.equipmentNotFound
                        };
                    }
                    return baseUpdate;
                }
                return t;
            });

            // Persist to cache immediately
            set(TASKS_CACHE_KEY, updated);
            return updated;
        });
        setSelectedTask(null);
    };

    // Filter Logic
    const filteredTasks = tasks.filter(task => {
        const searchAsset = filters.asset.toLowerCase();

        // Month Filter Logic
        let matchMonth = true;
        if (filters.month) {
            const [fYear, fMonth] = filters.month.split('-');
            matchMonth = task.year === fYear && task.month === fMonth;
        }

        const matchAviso = task.id.toLowerCase().includes(filters.aviso.toLowerCase());
        const matchAsset =
            String(task.assetId || "").toLowerCase().includes(searchAsset) ||
            String(task.asset || "").toLowerCase().includes(searchAsset) ||
            String(task.assetNumber || "").toLowerCase().includes(searchAsset);
        const matchOrder = task.orderId.toLowerCase().includes(filters.order.toLowerCase());
        const matchLoc = task.location.toLowerCase().includes(filters.location.toLowerCase());
        const matchStatus = filters.status === 'Todos' || task.status === filters.status;
        const matchNotFound = !filters.notFoundOnly || task.equipmentNotFound;

        return matchMonth && matchAviso && matchAsset && matchOrder && matchLoc && matchStatus && matchNotFound;
    });

    return (
        <div className="operaciones-page">
            <div className="page-header">
                <div className="page-title">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        Operaciones
                    </motion.h1>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <p>Gestión de órdenes de trabajo en campo.</p>
                        {pendingCount > 0 && (
                            <span className="sync-badge">
                                {pendingCount} pendiente{pendingCount > 1 ? 's' : ''} sync
                            </span>
                        )}
                        <div className={`connection-status ${isOnline ? 'online' : 'offline'}`}>
                            {isOnline ? 'Online' : 'Offline'}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters Bar */}
            <motion.div
                className="glass-panel operations-filters"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <div className="filter-group">
                    <label>Mes Procesamiento</label>
                    {/* Using standard HTML date-month input or select */}
                    <input
                        type="month"
                        className="glass-input"
                        value={filters.month}
                        onChange={(e) => handleFilterChange('month', e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label>No. Aviso</label>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Ej. AV-2024..."
                        value={filters.aviso}
                        onChange={(e) => handleFilterChange('aviso', e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label>No. Activo / Equipo</label>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Ej. EQ-001..."
                        value={filters.asset}
                        onChange={(e) => handleFilterChange('asset', e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label>No. Pedido</label>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Ej. PED-..."
                        value={filters.order}
                        onChange={(e) => handleFilterChange('order', e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label>Ubicación</label>
                    <input
                        type="text"
                        className="glass-input"
                        placeholder="Ej. Sótano..."
                        value={filters.location}
                        onChange={(e) => handleFilterChange('location', e.target.value)}
                    />
                </div>
                <div className="filter-group">
                    <label>Estatus</label>
                    <select
                        className="glass-input"
                        value={filters.status}
                        onChange={(e) => handleFilterChange('status', e.target.value)}
                        style={{ cursor: 'pointer' }}
                    >
                        <option value="Todos">Todos</option>
                        <option value="Pendiente">Pendiente</option>
                        <option value="En Progreso">En Progreso</option>
                        <option value="Atendido">Atendido</option>
                        <option value="Pendiente Sinc.">Pendiente Sinc.</option>
                    </select>
                </div>
                <div className="filter-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', alignSelf: 'center', marginTop: '1.2rem' }} onClick={() => handleFilterChange('notFoundOnly', !filters.notFoundOnly)}>
                    <input
                        type="checkbox"
                        checked={filters.notFoundOnly}
                        onChange={(e) => handleFilterChange('notFoundOnly', e.target.checked)}
                        onClick={(e) => e.stopPropagation()}
                    />
                    <label style={{ margin: 0, cursor: 'pointer' }}>No Localizados</label>
                </div>
            </motion.div>

            {/* Task List - Compact View */}
            <motion.div
                className="task-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
            >
                {loading ? (
                    <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Cargando avisos...
                    </div>
                ) : (
                    <div className="glass-panel" style={{ overflow: 'hidden', padding: 0 }}>
                        <div className="task-header">
                            <div style={{ paddingLeft: '1rem' }}>Año</div>
                            <div>Mes</div>
                            <div>Aviso</div>
                            <div>Equipo</div>
                            <div>No. Activo</div>
                            <div>Ubicación</div>
                            <div>Tipo Mto.</div>
                            <div>Estatus</div>
                            <div style={{ textAlign: 'center' }}>Acción</div>
                        </div>
                        {filteredTasks.length > 0 ? (
                            filteredTasks.map((task) => (
                                <motion.div
                                    key={task.id}
                                    className={`task-item-compact priority-${task.priority}`}
                                    whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
                                    onClick={() => handleSelectTask(task)}
                                >
                                    <div className="compact-year-cell" style={{ paddingLeft: '1rem' }}>{task.year}</div>
                                    <div className="compact-month-cell">{task.month}</div>
                                    <div className="compact-id">{task.id}</div>
                                    <div className="compact-asset-cell">
                                        {task.asset}
                                        {task.equipmentNotFound && (
                                            <span className="not-found-alert" title="Equipo no localizado">
                                                <AlertTriangle size={12} />
                                            </span>
                                        )}
                                    </div>
                                    <div className="compact-asset-number-cell">{task.assetNumber}</div>
                                    <div className="compact-loc-cell" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                        <MapPin size={12} color="var(--accent-color)" />
                                        <span style={{ fontSize: '0.85rem' }}>{task.location}</span>
                                    </div>
                                    <div className="compact-type-cell" style={{ fontSize: '0.85rem' }}>
                                        {task.type}
                                    </div>

                                    {/* Mobile helper for grouped meta */}
                                    <div className="compact-meta-cell" style={{ display: 'none' }}>
                                        <span>{task.year}-{task.month}</span>
                                        <span>• Activo: {task.assetNumber}</span>
                                        <span>• {task.type}</span>
                                    </div>

                                    <div className="compact-status-cell">
                                        <span className={`compact-status ${task.status === 'Atendido' ? 'status-active' :
                                            task.status === 'Pendiente Sinc.' ? 'status-pending-sync' : ''
                                            }`}>
                                            {task.status}
                                        </span>
                                    </div>
                                    <div className="compact-action-cell" style={{ display: 'flex', justifyContent: 'center' }}>
                                        <button className="compact-action-btn">
                                            <ChevronLeft size={18} style={{ transform: 'rotate(180deg)' }} />
                                        </button>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                                No se encontraron avisos con los filtros actuales.
                            </div>
                        )}
                    </div>
                )}
            </motion.div>

            {/* Detail Overlay */}
            <AnimatePresence>
                {selectedTask && (
                    <TaskDetail
                        task={selectedTask}
                        onClose={() => setSelectedTask(null)}
                        onComplete={handleCloseTask}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default Operaciones;

