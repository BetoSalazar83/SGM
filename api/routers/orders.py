from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from typing import List, Optional
# Removed pandas to reduce package size for Azure
import io
import uuid
from datetime import datetime

from services.table_service import table_service
from core.config import settings
from models import Order, Task
from dependencies import get_current_user

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
async def import_order(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    try:
        user_email = current_user.get('sub', 'Unknown')
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

        # 1. Validate duplicates within Excel and extract IDs
        excel_tasks = set()
        rows_to_process = list(sheet.iter_rows(min_row=2, values_only=True))
        for row in rows_to_process:
            if not row[idx_aviso]: continue
            tid = str(row[idx_aviso])
            if tid in excel_tasks:
                print(f"BLOCK: Duplicate Task ID {tid} in Excel file. User: {user_email}")
                raise HTTPException(status_code=400, detail=f"El archivo Excel contiene avisos duplicados: {tid}")
            excel_tasks.add(tid)

        # 2. Process rows and group by Pedido
        order_groups = {}
        for row in rows_to_process:
            if not row[idx_pedido]: continue
            oid = str(row[idx_pedido])
            if oid not in order_groups:
                order_groups[oid] = []
            order_groups[oid].append(row)
        
        # 3. System-wide Validations
        table_tasks_client = table_service._get_table_client(settings.AZURE_TABLE_TASKS)
        table_orders_client = table_service._get_table_client("SgmOrders")

        for oid, rows in order_groups.items():
            # 3.1 Check if Order already exists and if it has worked tasks
            existing_order = table_service.get_entity("SgmOrders", "Orders", oid)
            if existing_order:
                # Query all tasks for this order across all partitions
                tasks_query = f"order_id eq '{oid}'"
                existing_tasks = list(table_tasks_client.query_entities(query_filter=tasks_query))
                
                worked_tasks = [t for t in existing_tasks if str(t.get('status', 'pending')).lower() not in ['pending', 'pendiente']]
                if worked_tasks:
                    print(f"BLOCK: Order {oid} has worked tasks. Cannot overwrite. User: {user_email}")
                    raise HTTPException(status_code=400, detail=f"No se puede cargar el pedido {oid} porque ya tiene mantenimientos atendidos o en proceso.")

            # 3.2 Check Task uniqueness (across all orders)
            for r in rows:
                task_id = str(r[idx_aviso])
                # Global search by RowKey
                task_search_query = f"RowKey eq '{task_id}'"
                other_tasks = list(table_tasks_client.query_entities(query_filter=task_search_query))
                
                for t in other_tasks:
                    if str(t.get('order_id')) != oid:
                        print(f"BLOCK: Task ID {task_id} already exists in Order {t.get('order_id')}. User: {user_email}")
                        raise HTTPException(status_code=400, detail=f"El aviso {task_id} ya existe en otro pedido ({t.get('order_id')}).")

        # 4. Perform weighted updates/creations
        for oid, rows in order_groups.items():
            first_row = rows[0]
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
            
            order_type = "Preventivo-Correctivo" if prev_count > 0 and corr_count > 0 else ("Correctivo" if corr_count > 0 else "Preventivo")

            # 4.1 Upsert Order Summary (Maintaining original creation info if exists)
            existing_order = table_service.get_entity("SgmOrders", "Orders", oid)
            order_data = {
                "PartitionKey": "Orders",
                "RowKey": oid,
                "order_number": oid,
                "year": year,
                "month": month,
                "order_type": order_type,
                "prev_count": prev_count,
                "corr_count": corr_count,
                "completed_count": existing_order.get('completed_count', 0) if existing_order else 0,
                "creation_date": existing_order.get('creation_date', datetime.utcnow().isoformat()) if existing_order else datetime.utcnow().isoformat(),
                "status": existing_order.get('status', 'Pendiente') if existing_order else 'Pendiente',
                "total_assets": len(rows),
                "progress": existing_order.get('progress', 0) if existing_order else 0,
                "updated_at": datetime.utcnow().isoformat(),
                "updated_by": user_email
            }
            table_service.upsert_entity("SgmOrders", order_data, "Orders", oid)
            
            # 4.2 Upsert Tasks (Protecting operational fields)
            idx_activo = get_col_idx("No.Activo") if get_col_idx("No.Activo") != -1 else get_col_idx("No. Activo")
            idx_nombre = get_col_idx("Nombre.Equipo")
            idx_loc = get_col_idx("Nombre.Ubicación")

            for r in rows:
                task_id = str(r[idx_aviso])
                # Check for existing task to protect fields
                existing_task = None
                task_search = list(table_tasks_client.query_entities(query_filter=f"RowKey eq '{task_id}'"))
                if task_search:
                    existing_task = task_search[0]

                task_data = {
                    "PartitionKey": oid,
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
                    "status": existing_task.get('status', 'pending') if existing_task else 'pending',
                    "created_at": existing_task.get('created_at', datetime.utcnow().isoformat()) if existing_task else datetime.utcnow().isoformat()
                }

                # Preserve all operational fields if task exists
                if existing_task:
                    operational_fields = [
                        'completed_at', 'completed_by', 'closing_comments', 
                        'equipment_not_found', 'evidence_tag', 'evidence_before', 
                        'evidence_during', 'evidence_after'
                    ]
                    for field in operational_fields:
                        if field in existing_task:
                            task_data[field] = existing_task[field]

                table_service.upsert_entity(settings.AZURE_TABLE_TASKS, task_data, oid, task_id)

        # Log audit for the entire import
        table_service.log_audit_event(
            entity_type="Order",
            entity_id="BatchImport",
            action="import",
            performed_by=user_email,
            new_value={"orders_imported": list(order_groups.keys())}
        )

        return {"status": "success", "message": f"Importados {len(order_groups)} pedidos con éxito."}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error importing Excel: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{order_id}")
async def delete_order(order_id: str, current_user: dict = Depends(get_current_user)):
    try:
        user_email = current_user.get('sub', 'Unknown')
        
        # Soft delete del pedido
        order = table_service.get_entity("SgmOrders", "Orders", order_id)
        if not order:
            raise HTTPException(status_code=404, detail="Pedido no encontrado")
            
        order['is_deleted'] = True
        order['deleted_at'] = datetime.utcnow().isoformat()
        order['deleted_by'] = user_email
        
        success = table_service.upsert_entity("SgmOrders", order, "Orders", order_id)
        
        if success:
            # Log audit for order soft deletion
            table_service.log_audit_event(
                entity_type="Order",
                entity_id=order_id,
                action="soft_delete",
                performed_by=user_email,
                old_value={"order_id": order_id}
            )
            return {"status": "success", "message": "Pedido eliminado (lógico)."}
        else:
            raise HTTPException(status_code=500, detail="Error al marcar el pedido como eliminado.")
    except Exception as e:
        print(f"Error deleting order: {e}")
        raise HTTPException(status_code=500, detail="Error al eliminar el pedido.")
