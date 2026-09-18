import httpx2

from app.config import Settings

from .conftest import ApiFactory


async def test_health_reports_the_application_and_its_database_as_up(
    api: httpx2.AsyncClient,
) -> None:
    response = await api.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "database": "up",
        "openrouter_key": "configured",
    }


async def test_the_application_serves_health_without_an_openrouter_key(
    api_for: ApiFactory, settings: Settings
) -> None:
    api = await api_for(settings.model_copy(update={"openrouter_api_key": None}))

    response = await api.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.json()["openrouter_key"] == "missing"
