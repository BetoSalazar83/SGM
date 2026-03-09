from datetime import datetime
from typing import Optional, List, Any
from pydantic import BaseModel, Field

# Base Model for PWA Synchronization
class SyncModel(BaseModel):
    id: str = Field(..., description="Unique identifier (PartitionKey|RowKey)")
    last_modified: datetime = Field(default_factory=datetime.utcnow, description="Timestamp for sync conflict resolution")
    is_deleted: bool = Field(default=False, description="Soft delete flag for sync")
    sync_status: str = Field(default="synced", description="pending, synced, conflict")

# User Model
class User(SyncModel):
    email: str
    full_name: str
    role: str # admin, tech
    active: bool = True
    token_version: int = Field(default=1)
    # Soft delete fields
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None

# Work Order (Pedido)
class Order(SyncModel):
    order_number: str
    year: str
    month: str
    order_type: str # Preventivo, Correctivo, etc
    total_assets: int
    completed_count: int = 0
    progress: int = 0
    status: str = "Pendiente" # Pendiente, En Proceso, Completado
    creation_date: datetime = Field(default_factory=datetime.utcnow)
    
    # Audit fields
    updated_at: Optional[datetime] = None
    updated_by: Optional[str] = None
    
    # Soft delete fields
    is_deleted: bool = False
    deleted_at: Optional[datetime] = None
    deleted_by: Optional[str] = None

# Asset Task (Aviso)
class Task(SyncModel):
    order_id: str
    asset_id: str
    asset_name: str
    location: str
    maintenance_type: str # Preventive, Corrective
    priority: str # normal, high
    status: str # pending, in_progress, completed
    technician_id: Optional[str] = None
    
    # Evidence (URLs to Blob Storage)
    evidence_tag: Optional[str] = None
    evidence_before: Optional[str] = None
    evidence_during: Optional[str] = None
    evidence_after: Optional[str] = None
    
    closing_comments: Optional[str] = None
    completed_at: Optional[datetime] = None
    
    # Audit fields
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_by: Optional[str] = None

# Audit Log entry
class AuditLog(SyncModel):
    PartitionKey: str # entity_type: User, Order, Task
    entity_id: str
    action: str # create, update, delete, reset_password
    performed_by: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    old_value: Optional[str] = None # JSON string
    new_value: Optional[str] = None # JSON string

# Sync Response Wrapper
class SyncResponse(BaseModel):
    data: List[Any]
    server_timestamp: datetime
    has_more: bool = False
