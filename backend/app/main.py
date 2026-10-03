"""FastAPI entrypoint.  Run:  uvicorn app.main:app --reload  (from backend/)"""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .core.data_loader import load_scenarios, load_segments
from .routers import risk, scenario
from .services.risk.service import RiskService
from .services.scenario import ScenarioPlayer


def create_app() -> FastAPI:
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        segments = load_segments(settings.data_dir / "pilot" / "segments.geojson")
        scenarios = load_scenarios(settings.data_dir / "scenarios" / "rain_scenarios.json")
        player = ScenarioPlayer(scenarios, initial=settings.initial_scenario)
        app.state.player = player
        app.state.risk_service = RiskService(segments, player)
        yield

    app = FastAPI(
        title="AquaRoute API",
        version="0.1.0",
        description="Urban flood nowcasting for SIH26085. Module 1: Flood Risk Engine.",
        lifespan=lifespan,
    )
    app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins,
                       allow_methods=["*"], allow_headers=["*"])
    app.include_router(risk.router)
    app.include_router(scenario.router)

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok", "service": "aquaroute-api", "module": "risk-engine"}

    return app


app = create_app()
