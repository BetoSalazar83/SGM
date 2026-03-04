from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import List, Optional
from services.table_service import table_service
from core.security import get_password_hash, decode_token
from core.config import settings
from fastapi.security import OAuth2PasswordBearer

router = APIRouter(prefix="/api/users", tags=["Users"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

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

# Dependencia para obtener el usuario actual
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    return payload

# Dependencia para validar si es Administrador
async def check_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'Administrador':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador"
        )
    return current_user

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
        table_service.upsert_entity(settings.AZURE_TABLE_USERS, user, "Users", email.lower())
        
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

        success = table_service.delete_entity(settings.AZURE_TABLE_USERS, "Users", email.lower())
        if success:
            return {"message": "Usuario eliminado"}
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
