import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Registro de Service Worker para PWA
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nueva versión disponible. ¿Recargar?")) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log("Aplicación lista para trabajar offline.");
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
