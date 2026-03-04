from fastapi import FastAPI
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from .sync_routes import router as sync_router
from .routers.tasks import router as tasks_router
from .routers.orders import router as orders_router
from .routers.dashboard import router as dashboard_router
from .routers.auth import router as auth_router
from .routers.users import router as users_router
from .services.table_service import table_service
from .core.config import settings

import os

app = FastAPI(title="SGM Backend", version="1.0.0")

# Configurar CORS: permitir todas en dev, o una específica en prod
cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sync_router)
app.include_router(tasks_router)
app.include_router(orders_router)
app.include_router(dashboard_router)
app.include_router(auth_router)
app.include_router(users_router)

@app.get("/health")
@app.head("/health")
@app.options("/health")
async def health_check():
    # Ping ultra-rápido: solo validar que el proceso está vivo
    # La validación de storage la dejamos opcional para no bloquear la UI
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}

@app.get("/health/storage")
async def health_storage_check():
    try:
        table_client = table_service._get_table_client(settings.AZURE_TABLE_TASKS)
        list(table_client.list_entities(results_per_page=1))
        return {"status": "connected"}
    except Exception as e:
        from fastapi import Response
        return Response(content='{"status": "disconnected"}', status_code=503, media_type="application/json")
