from azure.data.tables import TableServiceClient, TableEntity, UpdateMode
from datetime import datetime
import json
from core.config import settings
from models import SyncModel

class AzureTableService:
    def __init__(self):
        self.service_client = TableServiceClient.from_connection_string(conn_str=settings.AZURE_STORAGE_CONNECTION_STRING)
        self.users_table = settings.AZURE_TABLE_USERS
        self.tasks_table = settings.AZURE_TABLE_TASKS
        self.orders_table = "SgmOrders"
        
        # Ensure tables exist
        self._create_table_if_not_exists(self.users_table)
        self._create_table_if_not_exists(self.tasks_table)
        self._create_table_if_not_exists(self.orders_table)

    def _create_table_if_not_exists(self, table_name):
        try:
            self.service_client.create_table_if_not_exists(table_name)
        except Exception as e:
            print(f"Error creating table {table_name}: {e}")

    def _get_table_client(self, table_name):
        return self.service_client.get_table_client(table_name)

    def upsert_entity(self, table_name: str, entity_data: dict, partition_key: str, row_key: str, mode: UpdateMode = UpdateMode.MERGE):
        table_client = self._get_table_client(table_name)
        
        # Prepare Azure Table Entity
        entity = {
            'PartitionKey': partition_key,
            'RowKey': row_key,
            **entity_data
        }
        
        # Upsert (Merge by default) to handle both insert and partial updates
        try:
            table_client.upsert_entity(mode=mode, entity=entity)
            return True
        except Exception as e:
            print(f"Error upserting entity: {e}")
            return False

    def get_entity(self, table_name: str, partition_key: str, row_key: str):
        try:
            table_client = self._get_table_client(table_name)
            return table_client.get_entity(partition_key=partition_key, row_key=row_key)
        except Exception:
            return None

    def delete_entity(self, table_name: str, partition_key: str, row_key: str):
        try:
            table_client = self._get_table_client(table_name)
            table_client.delete_entity(partition_key=partition_key, row_key=row_key)
            return True
        except Exception:
            return False

    def get_sync_data(self, table_name: str, last_sync: datetime):
        """
        Recupera registros modificados después de la fecha last_sync.
        """
        table_client = self._get_table_client(table_name)
        
        filter_query = f"Timestamp gt datetime'{last_sync.isoformat()}'" if last_sync else ""
        
        entities = table_client.query_entities(query_filter=filter_query) if filter_query else table_client.list_entities()
        
        results = []
        for entity in entities:
            # Convert back to clean dict
            item = dict(entity)
            item.pop('metadata', None) # Safely remove Azure metadata if present
            
            # Map RowKey to 'id' for SyncModel compatibility if needed
            if 'id' not in item:
                item['id'] = item.get('RowKey')
                
            results.append(item)
            
        return results

table_service = AzureTableService()
