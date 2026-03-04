from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional
from ..services.table_service import table_service
from ..core.security import verify_password, create_access_token
from ..core.config import settings

router = APIRouter(prefix="/auth", tags=["Auth"])

class LoginRequest(BaseModel):
    email: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict

@router.post("/login", response_model=Token)
async def login(request: LoginRequest):
    try:
        # Buscar usuario en la tabla SgmUsers
        # Usaremos el email como RowKey (normalizado) o buscaremos por propiedad
        # Para mayor eficiencia, el email (o username) debería ser el RowKey
        
        # Primero intentamos obtenerlo directamente
        user = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", request.email.lower())
        
        if not user:
            # Si no, buscamos en todos (menos eficiente pero seguro si el RowKey no es el email)
            users = table_service.get_sync_data(settings.AZURE_TABLE_USERS, None)
            user = next((u for u in users if u.get('email', '').lower() == request.email.lower()), None)
            
        if not user or not verify_password(request.password, user.get('hashed_password', '')):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Correo o contraseña incorrectos",
                headers={"WWW-Authenticate": "Bearer"},
            )
            
        if user.get('status') != 'Activo':
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Usuario inactivo. Contacte al administrador.",
            )

        # Crear token
        access_token = create_access_token(
            data={"sub": user['email'], "role": user.get('role', 'Técnico')}
        )
        
        # Limpiar datos sensibles
        user_info = {
            "name": user.get('name'),
            "email": user.get('email'),
            "role": user.get('role'),
            "id": user.get('RowKey')
        }
        
        return {"access_token": access_token, "token_type": "bearer", "user": user_info}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in login: {e}")
        raise HTTPException(status_code=500, detail="Error interno durante el inicio de sesión")
