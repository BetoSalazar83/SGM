// Centralized configuration for the SGM Frontend
const isExtension = typeof window !== 'undefined' && window.location.protocol === 'chrome-extension:';
const isDev = import.meta.env.DEV;

// Use VITE_API_URL from .env files, fallback to local for safety
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export default {
    API_BASE_URL,
    isDev,
    siteTitle: 'SGM - Sistema de Gestión de Mantenimiento'
};
