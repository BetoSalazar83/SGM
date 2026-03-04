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

# Work Order (Pedido)
class Order(SyncModel):
    order_number: str
    creation_date: datetime
    status: str
    total_assets: int
    assets_summary: dict # JSON with prev/corr counts

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

# Sync Response Wrapper
class SyncResponse(BaseModel):
    data: List[Any]
    server_timestamp: datetime
    has_more: bool = False
