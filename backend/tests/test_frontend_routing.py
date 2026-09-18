import httpx2


async def test_the_browser_gets_the_single_page_application_at_the_root(
    api: httpx2.AsyncClient,
) -> None:
    response = await api.get("/")

    assert response.status_code == 200
    assert 'id="root"' in response.text


async def test_an_unknown_client_side_path_resolves_to_the_single_page_application(
    api: httpx2.AsyncClient,
) -> None:
    response = await api.get("/trips/lisbon-in-april")

    assert response.status_code == 200
    assert 'id="root"' in response.text


async def test_a_built_asset_is_served_as_itself(api: httpx2.AsyncClient) -> None:
    response = await api.get("/assets/app.js")

    assert response.status_code == 200
    assert "built bundle" in response.text


async def test_an_unknown_api_path_is_a_not_found_rather_than_the_application(
    api: httpx2.AsyncClient,
) -> None:
    response = await api.get("/api/nowhere")

    assert response.status_code == 404
    assert 'id="root"' not in response.text


async def test_the_api_root_is_not_the_application_either(api: httpx2.AsyncClient) -> None:
    response = await api.get("/api")

    assert response.status_code == 404
    assert 'id="root"' not in response.text


async def test_a_path_climbing_out_of_the_build_directory_gets_the_application(
    api: httpx2.AsyncClient,
) -> None:
    # Encoded so it survives the client's own normalisation and reaches the route.
    response = await api.get("/%2E%2E/conftest.py")

    assert response.status_code == 200
    assert 'id="root"' in response.text
