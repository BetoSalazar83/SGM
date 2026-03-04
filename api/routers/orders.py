from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
import pandas as pd
import io
import uuid
from datetime import datetime

from ..services.table_service import table_service
from ..core.config import settings
from ..models import Order, Task

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.get("", response_model=List[dict])
async def get_orders():
    try:
        orders = table_service.get_sync_data(settings.AZURE_TABLE_USERS.replace("Users", "Orders"), None) # Using a naming convention or separate config
        # For now, let's use the actual table name 'SgmOrders'
        orders = table_service.get_sync_data("SgmOrders", None)
        return orders
    except Exception as e:
        print(f"Error fetching orders: {e}")
        return []

@router.post("/import")
async def import_order(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Expected Columns check (loose check)
        # Año, Mes, Pedido, No.Aviso, No.Equipo, No.Activo, Tipo.Mantenimiento, Nombre.Ubicación
        required_cols = ["Pedido", "No.Aviso", "No.Equipo", "Tipo.Mantenimiento"]
        for col in required_cols:
            if col not in df.columns:
                raise HTTPException(status_code=400, detail=f"Falta la columna requerida: {col}")

        # Unique Orders in this file
        order_ids = df["Pedido"].unique()
        
        for oid in order_ids:
            order_df = df[df["Pedido"] == oid]
            
            # Extract Year and Month from first row
            first_row = order_df.iloc[0]
            year = str(first_row.get("Año", datetime.utcnow().year))
            month = str(first_row.get("Mes", datetime.utcnow().month))
            
            # Count maintenance types
            prev_count = len(order_df[order_df["Tipo.Mantenimiento"].str.contains("Preventivo", case=False, na=False)])
            corr_count = len(order_df[order_df["Tipo.Mantenimiento"].str.contains("Correctivo", case=False, na=False)])
            
            # Determine overall Type
            if prev_count > 0 and corr_count > 0:
                order_type = "Preventivo-Correctivo"
            elif corr_count > 0:
                order_type = "Correctivo"
            else:
                order_type = "Preventivo"

            # 1. Create/Update Order Summary
            order_data = {
                "PartitionKey": "Orders",
                "RowKey": str(oid),
                "order_number": str(oid),
                "year": year,
                "month": month,
                "order_type": order_type,
                "prev_count": prev_count,
                "corr_count": corr_count,
                "completed_count": 0,
                "creation_date": datetime.utcnow().isoformat(),
                "status": "Pendiente",
                "total_assets": len(order_df),
                "progress": 0
            }
            table_service.upsert_entity("SgmOrders", order_data, "Orders", str(oid))
            
            # 2. Create Tasks (Avisos)
            for _, row in order_df.iterrows():
                task_id = str(row["No.Aviso"])
                task_data = {
                    "PartitionKey": "Tasks",
                    "RowKey": task_id,
                    "order_id": str(oid),
                    "year": year,
                    "month": month,
                    "asset_id": str(row["No.Equipo"]),
                    "asset_number": str(row.get("No. Activo") or row.get("No.Activo") or ""), # Real Activo (flexible sensing)
                    "asset_name": str(row.get("Nombre.Equipo", row["No.Equipo"])),
                    "location": str(row.get("Nombre.Ubicación", "Sin Ubicación")),
                    "maintenance_type": str(row["Tipo.Mantenimiento"]),
                    "priority": "normal",
                    "status": "pending"
                }
                table_service.upsert_entity(settings.AZURE_TABLE_TASKS, task_data, "Tasks", task_id)

        return {"status": "success", "message": f"Importados {len(order_ids)} pedidos con éxito."}
    except Exception as e:
        print(f"Error importing Excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{order_id}")
async def delete_order(order_id: str):
    try:
        # 1. Delete Avisos associated with this order
        # For simplicity in Azure Tables, we might need to query and then delete each
        # A more robust way is to query where order_id == order_id
        all_tasks = table_service.get_sync_data(settings.AZURE_TABLE_TASKS, None)
        tasks_to_delete = [t for t in all_tasks if t.get("order_id") == order_id]
        
        table_client = table_service._get_table_client(settings.AZURE_TABLE_TASKS)
        for task in tasks_to_delete:
            table_client.delete_entity(partition_key="Tasks", row_key=task["RowKey"])
            
        # 2. Delete Order Entry
        order_client = table_service._get_table_client("SgmOrders")
        order_client.delete_entity(partition_key="Orders", row_key=order_id)
        
        return {"status": "success", "message": "Pedido y avisos eliminados."}
    except Exception as e:
        print(f"Error deleting order: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar el pedido.")
