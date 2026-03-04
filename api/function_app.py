import azure.functions as func
import main as main_module
fastapi_app = main_module.app

app = func.AsgiFunctionApp(app=fastapi_app, http_auth_level=func.AuthLevel.ANONYMOUS)
