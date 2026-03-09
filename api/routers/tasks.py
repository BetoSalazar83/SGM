from fastapi import APIRouter, HTTPException, Response, Request, Depends
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime
from services.blob_service import blob_service
from models import Task
from services.table_service import table_service
from core.config import settings
from dependencies import get_current_user

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/evidence/{blob_path:path}")
async def get_evidence_proxy(blob_path: str):
    """
    Proxy to serve evidence images from Azure Blob Storage.
    Supports nested folders (e.g., year-month/order_id/filename).
    """
    content, content_type = blob_service.download_blob(blob_path)
    
    if content is None:
        raise HTTPException(status_code=404, detail=f"Evidencia no encontrada en: {blob_path}")
    
    return Response(content=content, media_type=content_type)

@router.get("", response_model=List[dict])
async def get_tasks(request: Request = None):
    try:
        tasks_data = table_service.get_sync_data(settings.AZURE_TABLE_TASKS, None)
        
        # Determine base URL dynamically or fallback to localhost
        if request:
            base_url = str(request.base_url).rstrip('/')
        else:
            base_url = "http://localhost:8000"

        # Rewrite evidence URLs to use local proxy
        base_proxy_url = "/api/tasks/evidence"
        for task in tasks_data:
            for field in ["evidence_tag", "evidence_before", "evidence_during", "evidence_after"]:
                url = task.get(field)
                if url and "blob.core.windows.net" in url:
                    try:
                        container = settings.AZURE_CONTAINER_EVIDENCE.lower()
                        parts = url.split(f"/{container}/")
                        if len(parts) > 1:
                            path = parts[1]
                            task[field] = f"{base_url}{base_proxy_url}/{path}"
                    except Exception:
                        pass
        return tasks_data
    except Exception as e:
        print(f"Error fetching tasks: {e}")
        raise HTTPException(status_code=500, detail="Error fetching tasks")

class TaskCompleteRequest(BaseModel):
    comments: str
    evidence_etiqueta: Optional[str] = None
    evidence_antes: Optional[str] = None
    evidence_durante: Optional[str] = None
    evidence_despues: Optional[str] = None
    equipment_not_found: bool = False

@router.put("/{task_id}/complete")
async def complete_task(task_id: str, payload: TaskCompleteRequest, current_user: dict = Depends(get_current_user)):
    try:
        from services.blob_service import blob_service
        
        # 0. Get current task info to get order_id and real PartitionKey
        table_client = table_service._get_table_client(settings.AZURE_TABLE_TASKS)
        
        # Try finding in the new partition first (assuming task_id is RowKey and we need PartitionKey)
        # Since we don't have order_id yet, we search by RowKey
        task_query = f"RowKey eq '{task_id}'"
        tasks_found = list(table_client.query_entities(query_filter=task_query))
        
        if not tasks_found:
            raise HTTPException(status_code=404, detail="Tarea no encontrada")
        
        task_entity = tasks_found[0]
        actual_partition = task_entity['PartitionKey']
        order_id = str(task_entity.get('order_id', 'UnknownOrder'))
        
        # 1. Define Folder Structure: [Año-Mes]/[No.Pedido]
        now = datetime.utcnow()
        year_month = now.strftime("%Y-%m")
        target_folder = f"{year_month}/{order_id}"
        
        # 2. Upload images with specific naming: [Aviso]_X
        img_tag = blob_service.upload_base64_image(payload.evidence_etiqueta, target_folder, f"{task_id}_1")
        img_before = blob_service.upload_base64_image(payload.evidence_antes, target_folder, f"{task_id}_2")
        img_during = blob_service.upload_base64_image(payload.evidence_durante, target_folder, f"{task_id}_3")
        img_after = blob_service.upload_base64_image(payload.evidence_despues, target_folder, f"{task_id}_4")

        # 3. Update Azure Table with real URLs
        update_data = {
            "status": "completed",
            "closing_comments": payload.comments,
            "evidence_tag": img_tag,
            "evidence_before": img_before,
            "evidence_during": img_during,
            "evidence_after": img_after,
            "equipment_not_found": payload.equipment_not_found,
            "completed_at": now.isoformat(),
            "completed_by": current_user.get('sub')
        }
        
        success = table_service.upsert_entity(
            table_name=settings.AZURE_TABLE_TASKS,
            entity_data=update_data,
            partition_key=actual_partition,
            row_key=task_id
        )
        
        if success:
            # 4. Update Order Progress
            try:
                # Query both new partitioned tasks and legacy tasks
                # New partition
                new_tasks_query = f"PartitionKey eq '{order_id}'"
                order_tasks = list(table_client.query_entities(query_filter=new_tasks_query))
                
                # Legacy tasks
                legacy_tasks_query = f"PartitionKey eq 'Tasks' and order_id eq '{order_id}'"
                order_tasks.extend(list(table_client.query_entities(query_filter=legacy_tasks_query)))
                
                total = len(order_tasks)
                completed = len([t for t in order_tasks if t.get('status') == 'completed'])
                progress = int((completed / total) * 100) if total > 0 else 0
                
                # Check if all completed
                order_status = "En Proceso" if completed > 0 else "Pendiente"
                if completed == total and total > 0:
                    order_status = "Atendido"

                order_update = {
                    "completed_count": completed,
                    "progress": progress,
                    "status": order_status,
                    "updated_at": datetime.utcnow().isoformat(),
                    "updated_by": current_user.get('sub')
                }
                table_service.upsert_entity("SgmOrders", order_update, "Orders", str(order_id))
                
                # Log audit event for Task
                table_service.log_audit_event(
                    entity_type="Task",
                    entity_id=task_id,
                    action="complete",
                    performed_by=current_user.get('sub'),
                    old_value={"status": task_entity.get('status')},
                    new_value={"status": "completed", "comments": payload.comments}
                )
            except Exception as oe:
                print(f"Error updating order progress: {oe}")

            return {"status": "success", "message": "Task completed successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to complete task")
            
    except Exception as e:
        print(f"Error completing task: {e}")
        raise HTTPException(status_code=500, detail="Error completing task")
