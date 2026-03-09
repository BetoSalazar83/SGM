from fastapi import HTTPException, Depends, status, Header
from typing import Optional
from core.security import decode_token

# Dependency to get current user from JWT token
async def get_current_user(x_authorization: Optional[str] = Header(None)):
    if not x_authorization or not x_authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    token = x_authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )
    
    # Validar token_version contra la base de datos
    email = payload.get("sub")
    token_version = payload.get("token_version")
    
    if not email or token_version is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token malformado",
        )
        
    from services.table_service import table_service
    from core.config import settings
    user = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", email.lower())
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
        
    if user.get("token_version", 1) != token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión invalidada por cambio de seguridad. Por favor, inicie sesión de nuevo.",
        )

    return payload

# Dependency to validate if Admin
async def check_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get('role') != 'Administrador':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador"
        )
    return current_user
