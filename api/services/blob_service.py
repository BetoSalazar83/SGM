from azure.storage.blob import BlobServiceClient, ContentSettings
import uuid
import base64
import io
from ..core.config import settings

class AzureBlobService:
    def __init__(self):
        self.blob_service_client = BlobServiceClient.from_connection_string(settings.AZURE_STORAGE_CONNECTION_STRING)
        self.container_name = settings.AZURE_CONTAINER_EVIDENCE.lower() # Azure requires lowercase
        self._create_container_if_not_exists()
        self._configure_cors()

    def _configure_cors(self):
        try:
            from azure.storage.blob import CorsRule
            cors_rule = CorsRule(
                allowed_origins=['*'],
                allowed_methods=['GET', 'HEAD', 'POST', 'PUT'],
                allowed_headers=['*'],
                exposed_headers=['*'],
                max_age_in_seconds=3600
            )
            self.blob_service_client.set_service_properties(cors=[cors_rule])
            print("CORS configured for Blob Storage")
        except Exception as e:
            print(f"Error configuring CORS: {e}")

    def _create_container_if_not_exists(self):
        try:
            container_client = self.blob_service_client.get_container_client(self.container_name)
            if not container_client.exists():
                self.blob_service_client.create_container(self.container_name) 
                print(f"Container {self.container_name} created")
        except Exception as e:
            print(f"Error managing container {self.container_name}: {e}")

    def download_blob(self, blob_name: str) -> tuple[bytes, str]:
        """
        Descarga un blob y retorna sus bytes y content_type.
        """
        try:
            blob_client = self.blob_service_client.get_blob_client(container=self.container_name, blob=blob_name)
            if not blob_client.exists():
                return None, None
            
            stream = blob_client.download_blob()
            return stream.readall(), stream.properties.content_settings.content_type
        except Exception as e:
            print(f"Error downloading blob {blob_name}: {e}")
            return None, None

    def upload_base64_image(self, base64_str: str, folder: str = "evidence", filename: str = None) -> str:
        """
        Sube una imagen en base64 a Azure Blob Storage y retorna la URL pública.
        """
        try:
            if not base64_str or not base64_str.startswith("data:image"):
                return base64_str # Retornar tal cual si no es base64 (ej: ya es una URL)

            # Separar el header del contenido
            header, data = base64_str.split(',', 1)
            # data:image/png;base64... -> png
            extension = header.split('/')[1].split(';')[0]
            image_data = base64.b64decode(data)

            # Generar nombre único o usar el provisto
            name = filename if filename else str(uuid.uuid4())
            blob_name = f"{folder}/{name}.{extension}"
            blob_client = self.blob_service_client.get_blob_client(container=self.container_name, blob=blob_name)

            # Subir el contenido
            blob_client.upload_blob(
                image_data, 
                blob_type="BlockBlob", 
                content_settings=ContentSettings(content_type=f"image/{extension}"),
                overwrite=True
            )

            return blob_client.url
        except Exception as e:
            print(f"Error uploading blob: {e}")
            return None # Return None strictly to avoid EntityTooLarge in Tables if upload fails

blob_service = AzureBlobService()
