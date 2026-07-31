from fastapi import APIRouter, Depends

from services.table_service import table_service
from core.config import settings
from dependencies import check_admin

router = APIRouter(prefix="/admin", tags=["Admin"])

ADMIN_EMAIL = "admin@sgm.com"


@router.post("/reset-system")
async def reset_system(admin_user: dict = Depends(check_admin)):
    performed_by = admin_user.get('sub')

    deleted_orders = table_service.delete_all_entities("SgmOrders")
    deleted_tasks = table_service.delete_all_entities(settings.AZURE_TABLE_TASKS)
    deleted_users = table_service.delete_all_entities(settings.AZURE_TABLE_USERS, exclude_row_keys=[ADMIN_EMAIL])

    summary = {
        "orders_deleted": deleted_orders,
        "tasks_deleted": deleted_tasks,
        "users_deleted": deleted_users,
    }

    table_service.log_audit_event(
        entity_type="System",
        entity_id="reset",
        action="reset_system",
        performed_by=performed_by,
        new_value=summary
    )

    return {"status": "success", "message": "Sistema limpiado con éxito.", **summary}
