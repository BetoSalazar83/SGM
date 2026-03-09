
import os
import sys
from datetime import datetime

# Add api directory to path to import models and services
sys.path.append(os.path.join(os.getcwd(), 'api'))

from services.table_service import table_service
from core.config import settings

def test_partitioning():
    print("Starting Partitioning Verification...")
    
    order_id = "TEST_ORDER_001"
    task_id_new = "TASK_NEW_001"
    task_id_legacy = "TASK_LEGACY_001"
    
    # 1. Simulate legacy task creation (PartitionKey = "Tasks")
    legacy_task = {
        "order_id": order_id,
        "asset_id": "ASSET_001",
        "status": "pending",
        "maintenance_type": "Preventivo"
    }
    table_service.upsert_entity(settings.AZURE_TABLE_TASKS, legacy_task, "Tasks", task_id_legacy)
    print(f"Created legacy task: {task_id_legacy} in partition 'Tasks'")
    
    # 2. Simulate new partitioned task creation (PartitionKey = order_id)
    new_task = {
        "order_id": order_id,
        "asset_id": "ASSET_002",
        "status": "pending",
        "maintenance_type": "Correctivo"
    }
    table_service.upsert_entity(settings.AZURE_TABLE_TASKS, new_task, order_id, task_id_new)
    print(f"Created new task: {task_id_new} in partition '{order_id}'")
    
    # 3. Verify both exist and can be queried by order_id
    table_client = table_service._get_table_client(settings.AZURE_TABLE_TASKS)
    
    # Query new partition
    new_tasks = list(table_client.query_entities(query_filter=f"PartitionKey eq '{order_id}'"))
    print(f"Tasks in new partition '{order_id}': {len(new_tasks)}")
    
    # Query legacy partition with filter
    legacy_tasks = list(table_client.query_entities(query_filter=f"PartitionKey eq 'Tasks' and order_id eq '{order_id}'"))
    print(f"Legacy tasks for order '{order_id}': {len(legacy_tasks)}")
    
    assert len(new_tasks) == 1, "Should find 1 task in new partition"
    assert len(legacy_tasks) == 1, "Should find 1 task in legacy partition"
    
    print("Verification Successful!")

if __name__ == "__main__":
    try:
        test_partitioning()
    except Exception as e:
        print(f"Error during verification: {e}")
