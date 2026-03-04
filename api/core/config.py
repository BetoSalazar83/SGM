from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    AZURE_STORAGE_CONNECTION_STRING: str
    AZURE_TABLE_USERS: str = "SgmUsers"
    AZURE_TABLE_TASKS: str = "SgmTasks"
    AZURE_TABLE_ORDERS: str = "SgmOrders"
    AZURE_CONTAINER_EVIDENCE: str = "sguevidence"
    SECRET_KEY: str # JWT Secret
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480 # 8 hours

    class Config:
        env_file = os.path.join(os.path.dirname(__file__), '..', '.env')

settings = Settings()
