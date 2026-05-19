from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import API_TITLE, CORS_ORIGINS
from app.routers.auth import require_authenticated_user, router as auth_router
from app.routers.brocante import router as brocante_router
from app.routers.budget import router as budget_router
from app.routers.dashboard import router as dashboard_router
from app.routers.patrimony import router as patrimony_router
from app.routers.resale import router as resale_router


app = FastAPI(title=API_TITLE)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


secured = [Depends(require_authenticated_user)]

app.include_router(auth_router, prefix="/api")
app.include_router(resale_router, prefix="/api", dependencies=secured)
app.include_router(brocante_router, prefix="/api", dependencies=secured)
app.include_router(dashboard_router, prefix="/api", dependencies=secured)
app.include_router(budget_router, prefix="/api", dependencies=secured)
app.include_router(patrimony_router, prefix="/api", dependencies=secured)
