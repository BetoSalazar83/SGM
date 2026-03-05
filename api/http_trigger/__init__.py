import azure.functions as func
import sys
import os

# Ensure the parent directory is in the path so we can import 'main.py'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app as fastapi_app

async def main(req: func.HttpRequest, context: func.Context) -> func.HttpResponse:
    return await func.AsgiMiddleware(fastapi_app).handle_async(req, context)
