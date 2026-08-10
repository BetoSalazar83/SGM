from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    AZURE_STORAGE_CONNECTION_STRING: str = "Use_Env_Var"
    AZURE_TABLE_USERS: str = "SgmUsers"
    AZURE_TABLE_TASKS: str = "SgmTasks"
    AZURE_TABLE_ORDERS: str = "SgmOrders"
    AZURE_TABLE_AUDIT: str = "SgmAuditLog"
    AZURE_CONTAINER_EVIDENCE: str = "sguevidence"
    SECRET_KEY: str = "temporary-secret-key-for-build" # JWT Secret
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480 # 8 hours
    # Host to prefix onto the evidence proxy URL (e.g. "http://localhost:8000" for
    # local dev, where the frontend runs on a different origin). Leave empty in
    # production: behind Azure Static Web Apps the request seen by the Function
    # App reflects an internal hostname, not the public site, so a relative URL
    # (resolved by the browser against the current page) is the only correct option.
    PUBLIC_API_URL: str = ""

    class Config:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        env_file = env_path if os.path.exists(env_path) else None

settings = Settings()
