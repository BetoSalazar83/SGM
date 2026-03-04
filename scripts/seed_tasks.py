import os
import sys
from datetime import datetime, timedelta

# Añadir el directorio padre al sys.path para poder importar los módulos del backend
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from backend.services.table_service import table_service
from backend.core.config import settings

def seed_tasks():
    print("Inyectando tareas de prueba en Azure Table Storage...")
    
    mock_tasks = [
        {
            "id": "AV-2024-81",
            "order_id": "PED-2024-001",
            "asset_id": "EQ-001",
            "asset_name": "Compresor Aire A1",
            "location": "Sótano 2",
            "maintenance_type": "Preventivo",
            "priority": "normal",
            "status": "pending",
            "sync_status": "synced",
            "last_modified": datetime.utcnow().isoformat(),
            "is_deleted": False
        },
        {
            "id": "AV-2024-85",
            "order_id": "PED-2024-001",
            "asset_id": "EQ-045",
            "asset_name": "Elevador Carga",
            "location": "Planta Baja",
            "maintenance_type": "Correctivo",
            "priority": "high",
            "status": "pending",
            "sync_status": "synced",
            "last_modified": datetime.utcnow().isoformat(),
            "is_deleted": False
        }
    ]
    
    success_count = 0
    for task in mock_tasks:
        success = table_service.upsert_entity(
            table_name=settings.AZURE_TABLE_TASKS,
            entity_data=task,
            partition_key="Tasks",
            row_key=task["id"]
        )
        if success:
            success_count += 1
            print(f"✅ Tarea insertada: {task['id']}")
        else:
            print(f"❌ Error al insertar tarea: {task['id']}")
            
    print(f"\nFinalizado. {success_count}/{len(mock_tasks)} insertadas correctamente.")

if __name__ == "__main__":
    seed_tasks()
