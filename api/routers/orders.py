from fastapi import APIRouter, HTTPException, UploadFile, File
from typing import List, Optional
# Removed pandas to reduce package size for Azure
import io
import uuid
from datetime import datetime

from services.table_service import table_service
from core.config import settings
from models import Order, Task

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
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(contents), data_only=True)
        sheet = wb.active
        
        # Get headers from first row
        headers = [str(cell.value).strip() if cell.value else "" for cell in sheet[1]]
        
        def get_col_idx(name):
            try: return headers.index(name)
            except ValueError: return -1

        idx_pedido = get_col_idx("Pedido")
        idx_aviso = get_col_idx("No.Aviso")
        idx_equipo = get_col_idx("No.Equipo")
        idx_tipo = get_col_idx("Tipo.Mantenimiento")
        
        if -1 in [idx_pedido, idx_aviso, idx_equipo, idx_tipo]:
            missing = [h for i, h in enumerate(["Pedido", "No.Aviso", "No.Equipo", "Tipo.Mantenimiento"]) if [idx_pedido, idx_aviso, idx_equipo, idx_tipo][i] == -1]
            raise HTTPException(status_code=400, detail=f"Faltan las columnas requeridas: {', '.join(missing)}")

        # Process rows and group by Pedido
        order_groups = {}
        for row in sheet.iter_rows(min_row=2, values_only=True):
            if not row[idx_pedido]: continue
            oid = str(row[idx_pedido])
            if oid not in order_groups:
                order_groups[oid] = []
            order_groups[oid].append(row)
        
        for oid, rows in order_groups.items():
            first_row = rows[0]
            # Flexible year/month check
            idx_year = get_col_idx("Año")
            idx_month = get_col_idx("Mes")
            year = str(first_row[idx_year]) if idx_year != -1 and first_row[idx_year] else str(datetime.utcnow().year)
            month = str(first_row[idx_month]) if idx_month != -1 and first_row[idx_month] else str(datetime.utcnow().month)
            
            # Count maintenance types
            prev_count = 0
            corr_count = 0
            for r in rows:
                m_type = str(r[idx_tipo]).lower()
                if "preventivo" in m_type: prev_count += 1
                if "correctivo" in m_type: corr_count += 1
            
            if prev_count > 0 and corr_count > 0:
                order_type = "Preventivo-Correctivo"
            elif corr_count > 0:
                order_type = "Correctivo"
            else:
                order_type = "Preventivo"

            # 1. Create/Update Order Summary
            order_data = {
                "PartitionKey": "Orders",
                "RowKey": oid,
                "order_number": oid,
                "year": year,
                "month": month,
                "order_type": order_type,
                "prev_count": prev_count,
                "corr_count": corr_count,
                "completed_count": 0,
                "creation_date": datetime.utcnow().isoformat(),
                "status": "Pendiente",
                "total_assets": len(rows),
                "progress": 0
            }
            table_service.upsert_entity("SgmOrders", order_data, "Orders", oid)
            
            # 2. Create Tasks (Avisos)
            idx_activo = get_col_idx("No.Activo") if get_col_idx("No.Activo") != -1 else get_col_idx("No. Activo")
            idx_nombre = get_col_idx("Nombre.Equipo")
            idx_loc = get_col_idx("Nombre.Ubicación")

            for r in rows:
                task_id = str(r[idx_aviso])
                task_data = {
                    "PartitionKey": "Tasks",
                    "RowKey": task_id,
                    "order_id": oid,
                    "year": year,
                    "month": month,
                    "asset_id": str(r[idx_equipo]),
                    "asset_number": str(r[idx_activo]) if idx_activo != -1 else "",
                    "asset_name": str(r[idx_nombre]) if idx_nombre != -1 else str(r[idx_equipo]),
                    "location": str(r[idx_loc]) if idx_loc != -1 else "Sin Ubicación",
                    "maintenance_type": str(r[idx_tipo]),
                    "priority": "normal",
                    "status": "pending"
                }
                table_service.upsert_entity(settings.AZURE_TABLE_TASKS, task_data, "Tasks", task_id)

        return {"status": "success", "message": f"Importados {len(order_groups)} pedidos con éxito."}
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
