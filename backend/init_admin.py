import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from core.security import get_password_hash
from services.table_service import table_service
from core.config import settings

def init_admin():
    email = "admin@sgm.com"
    password = "admin123" # User should change this
    
    # Check if exists
    existing = table_service.get_entity(settings.AZURE_TABLE_USERS, "Users", email)
    if existing:
        print(f"Admin {email} already exists.")
        return

    admin_data = {
        "name": "Administrador Principal",
        "email": email,
        "role": "Administrador",
        "status": "Activo",
        "hashed_password": get_password_hash(password)
    }
    
    success = table_service.upsert_entity(
        settings.AZURE_TABLE_USERS,
        admin_data,
        "Users",
        email
    )
    
    if success:
        print(f"Admin created successfully!")
        print(f"Email: {email}")
        print(f"Password: {password}")
    else:
        print("Failed to create admin.")

if __name__ == "__main__":
    init_admin()
