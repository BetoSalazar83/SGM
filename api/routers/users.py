from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from services.table_service import table_service
from core.security import get_password_hash
from core.config import settings
from dependencies import get_current_user, check_admin

router = APIRouter(prefix="/users", tags=["Users"])

# Modelos
class UserBase(BaseModel):
    name: str
    email: str
    role: str = "Técnico"
    status: str = "Activo"

class UserCreate(UserBase):
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserOut(UserBase):
    RowKey: str
    lastLogin: Optional[str] = None

# Logic moved to dependencies.py

@router.get("/", response_model=List[UserOut])
async def list_users(admin_user: dict = Depends(check_admin)):
    try:
        users = table_service.get_sync_data(settings.AZURE_TABLE_USERS, None)
        return users
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error al listar usuarios")

@router.post("/", response_model=UserOut)
async def create_user(user: UserCreate, admin_user: dict = Depends(check_admin)):
    try:
        # Verificar si ya existe
        existing = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", user.email.lower())
        if existing:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
            
        data = user.dict()
        data['hashed_password'] = get_password_hash(data.pop('password'))
        data['email'] = data['email'].lower()
        
        success = table_service.upsert_entity(
            settings.AZURE_TABLE_USERS,
            data,
            "Users",
            data['email']
        )
        
        if success:
            data['RowKey'] = data['email']
            return data
        raise HTTPException(status_code=500, detail="Error al guardar el usuario")
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{email}/reset-password")
async def reset_password(email: str, admin_user: dict = Depends(check_admin)):
    """Genera una contraseña temporal para un usuario."""
    try:
        user = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", email.lower())
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        # Generar clave temporal simple but secure
        import secrets
        import string
        temp_pwd = ''.join(secrets.choice(string.ascii_letters + string.digits) for i in range(10))
        
        user['hashed_password'] = get_password_hash(temp_pwd)
        user['token_version'] = user.get('token_version', 1) + 1 # Invalidar tokens antiguos
        table_service.upsert_entity(settings.AZURE_TABLE_USERS, user, "Users", email.lower())
        
        table_service.log_audit_event(
            entity_type="User",
            entity_id=email.lower(),
            action="reset_password",
            performed_by=admin_user.get('sub')
        )
        
        return {"message": "Contraseña reseteada con éxito", "temp_password": temp_pwd}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{email}")
async def delete_user(email: str, admin_user: dict = Depends(check_admin)):
    try:
        # 1. No dejar borrar al usuario que está logueado
        if admin_user.get('sub') == email.lower():
            raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta")
            
        # 2. No dejar borrar al admin principal admin@sgm.com por seguridad
        if email.lower() == "admin@sgm.com":
             raise HTTPException(status_code=400, detail="No se puede eliminar el administrador del sistema")

        # Soft delete
        user = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", email.lower())
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado")
            
        user['is_deleted'] = True
        user['deleted_at'] = datetime.utcnow().isoformat()
        user['deleted_by'] = admin_user.get('sub')
        
        success = table_service.upsert_entity(settings.AZURE_TABLE_USERS, user, "Users", email.lower())
        if success:
            table_service.log_audit_event(
                entity_type="User",
                entity_id=email.lower(),
                action="soft_delete",
                performed_by=admin_user.get('sub')
            )
            return {"message": "Usuario eliminado (lógico)"}
        raise HTTPException(status_code=500, detail="Error al eliminar el usuario")
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
