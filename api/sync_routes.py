from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from models import Task, SyncResponse
from services.table_service import table_service
from core.config import settings

router = APIRouter(prefix="/api/sync", tags=["Sync"])

@router.post("/push")
async def push_changes(changes: List[Task]):
    """
    Endpoint para recibir cambios locales desde la PWA.
    """
    processed = []
    failed = []
    
    for item in changes:
        # Convert Task to dict for Azure
        # Usamos ID como RowKey y OrderId como PartitionKey para tareas
        # Esto es una estrategia común, pero para sync simple usaremos una PartitionKey fija o basada en fecha
        # Estrategia: PartitionKey = "Tasks", RowKey = item.id
        
        data = item.dict()
        # Remove Sync fields unrelated to business data if needed, or keep them
        
        success = table_service.upsert_entity(
            table_name=settings.AZURE_TABLE_TASKS,
            entity_data=data,
            partition_key="Tasks", # Partition unica para búsquedas globales
            row_key=item.id
        )
        
        if success:
            processed.append(item.id)
            print(f"Synced item: {item.id}")
        else:
            failed.append(item.id)
    
    if failed:
        return {"status": "partial_success", "processed_ids": processed, "failed_ids": failed}
        
    return {"status": "success", "processed_ids": processed}

@router.get("/pull", response_model=SyncResponse)
async def pull_changes(last_sync: Optional[datetime] = None):
    """
    Endpoint para que la PWA descargue datos nuevos.
    """
    # Si no hay last_sync, asumimos carga inicial (últimos 30 días o todo)
    if not last_sync:
        # En producción, limitar esto. Para MVP, todo.
        pass

    try:
        tasks = table_service.get_sync_data(settings.AZURE_TABLE_TASKS, last_sync)
        
        # Mapear de vuelta a modelo Task si es necesario
        # Azure devuelve propiedades adicionales, Pydantic debe ignorarlas con extra='ignore'
        
        return SyncResponse(
            data=tasks,
            server_timestamp=datetime.utcnow(),
            has_more=False
        )
    except Exception as e:
        print(f"Error in pull_changes: {e}")
        raise HTTPException(status_code=500, detail="Error fetching updates")
