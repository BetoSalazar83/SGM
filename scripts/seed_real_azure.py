import os
from azure.data.tables import TableServiceClient, UpdateMode
from dotenv import load_dotenv

# Load .env from backend directory
env_path = os.path.join(os.path.dirname(__file__), '..', 'backend', '.env')
load_dotenv(env_path)

connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
tasks_table_name = os.getenv("AZURE_TABLE_TASKS", "SgmTasks")
users_table_name = os.getenv("AZURE_TABLE_USERS", "SgmUsers")

def seed_data():
    print(f"Connecting to real Azure Storage...")
    try:
        service_client = TableServiceClient.from_connection_string(conn_str=connection_string)
        
        # Create Tables
        for table_name in [tasks_table_name, users_table_name]:
            try:
                service_client.create_table(table_name)
                print(f"Table '{table_name}' created.")
            except Exception as e:
                print(f"Table '{table_name}' already exists or error: {e}")

        # Seed Tasks
        tasks_client = service_client.get_table_client(table_name=tasks_table_name)
        
        mock_tasks = [
            {
                "PartitionKey": "Tasks",
                "RowKey": "AV-2024-81",
                "order_id": "PED-2024-001",
                "asset_id": "EQ-001",
                "asset_name": "Compresor Aire A1 (Azure Real)",
                "location": "Sótano 2",
                "maintenance_type": "Preventivo",
                "priority": "normal",
                "status": "pending"
            },
            {
                "PartitionKey": "Tasks",
                "RowKey": "AV-2024-85",
                "order_id": "PED-2024-001",
                "asset_id": "EQ-045",
                "asset_name": "Elevador Carga (Azure Real)",
                "location": "Planta Baja",
                "maintenance_type": "Correctivo",
                "priority": "high",
                "status": "pending"
            },
            {
                "PartitionKey": "Tasks",
                "RowKey": "AV-2024-92",
                "order_id": "PED-2024-002",
                "asset_id": "EQ-102",
                "asset_name": "Bomba de Agua B2 (Azure Real)",
                "location": "Azotea",
                "maintenance_type": "Preventivo",
                "priority": "normal",
                "status": "pending"
            },
            {
                "PartitionKey": "Tasks",
                "RowKey": "AV-2024-99",
                "order_id": "PED-2024-002",
                "asset_id": "EQ-888",
                "asset_name": "Generador Princ. (Azure Real)",
                "location": "Cuarto Máq.",
                "maintenance_type": "Preventivo",
                "priority": "high",
                "status": "pending"
            }
        ]

        for task in mock_tasks:
            tasks_client.upsert_entity(mode=UpdateMode.REPLACE, entity=task)
            print(f"Upserted task {task['RowKey']}")

        print("Seeding completed successfully!")
    except Exception as e:
        print(f"Error during seeding: {e}")

if __name__ == "__main__":
    seed_data()
