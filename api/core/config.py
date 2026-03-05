from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    AZURE_STORAGE_CONNECTION_STRING: str = "Use_Env_Var"
    AZURE_TABLE_USERS: str = "SgmUsers"
    AZURE_TABLE_TASKS: str = "SgmTasks"
    AZURE_TABLE_ORDERS: str = "SgmOrders"
    AZURE_CONTAINER_EVIDENCE: str = "sguevidence"
    SECRET_KEY: str = "temporary-secret-key-for-build" # JWT Secret
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480 # 8 hours

    class Config:
        env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
        env_file = env_path if os.path.exists(env_path) else None

settings = Settings()
