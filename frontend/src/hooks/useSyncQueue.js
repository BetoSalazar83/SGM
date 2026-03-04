import { useEffect, useState } from 'react';
import { get, set, del, keys } from 'idb-keyval';
import { API_BASE_URL } from '../config';

const QUEUE_KEY_PREFIX = 'sync-queue-';

export const useSyncQueue = (onSyncSuccess) => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    const checkRealConnectivity = async () => {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000); // Aumentar a 6s para evitar falsos negativos en arranques lentos

            const response = await fetch(`${API_BASE_URL.replace('/api', '')}/health`, {
                method: 'GET',
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            // Si el servidor responde con 200 o 503 (falla de storage pero servidor vivo), estamos "Online" respecto al backend
            const online = response.ok || response.status === 503;
            setIsOnline(online);
            return online;
        } catch (e) {
            console.warn("Heartbeat failed:", e.message);
            setIsOnline(false);
            return false;
        }
    };

    const updatePendingCount = async () => {
        const allKeys = await keys();
        const pending = allKeys.filter(k => k.toString().startsWith(QUEUE_KEY_PREFIX));
        setPendingCount(pending.length);
    };

    const getAllQueueItems = async () => {
        const allKeys = await keys();
        const pendingKeys = allKeys.filter(k => k.toString().startsWith(QUEUE_KEY_PREFIX));
        const items = {};
        for (const key of pendingKeys) {
            const taskId = key.toString().replace(QUEUE_KEY_PREFIX, '');
            items[taskId] = await get(key);
        }
        return items;
    };

    const getQueueItem = async (taskId) => {
        return await get(`${QUEUE_KEY_PREFIX}${taskId}`);
    };

    const addToQueue = async (taskId, data) => {
        await set(`${QUEUE_KEY_PREFIX}${taskId}`, {
            taskId,
            data,
            timestamp: new Date().toISOString()
        });
        await updatePendingCount();
    };

    const processQueue = async () => {
        if (!navigator.onLine) return;

        const allKeys = await keys();
        const pendingKeys = allKeys.filter(k => k.toString().startsWith(QUEUE_KEY_PREFIX));

        for (const key of pendingKeys) {
            const item = await get(key);
            try {
                const response = await fetch(`${API_BASE_URL}/tasks/${item.taskId}/complete`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(item.data)
                });

                if (response.ok) {
                    await del(key);
                    if (onSyncSuccess) onSyncSuccess(item.taskId);
                    console.log(`Synced task ${item.taskId} successfully`);
                }
            } catch (error) {
                console.error(`Failed to sync task ${item.taskId}:`, error);
            }
        }
        await updatePendingCount();
    };

    useEffect(() => {
        const handleOnline = () => {
            checkRealConnectivity().then(online => {
                if (online) processQueue();
            });
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Check every 30 seconds
        const interval = setInterval(checkRealConnectivity, 30000);
        updatePendingCount();
        checkRealConnectivity().then(online => {
            if (online) processQueue();
        });

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            clearInterval(interval);
        };
    }, []);

    return { isOnline, pendingCount, addToQueue, getQueueItem, getAllQueueItems, processQueue, checkRealConnectivity, updatePendingCount };
};
