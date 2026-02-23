from __future__ import annotations

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


class TestPixelOfficeEndpoints:
    def test_page_returns_200(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        assert "officeCanvas" in response.text

    def test_page_has_title(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        assert "픽셀 오피스" in response.text

    def test_page_has_script_tag(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        assert "pixel-office.js" in response.text

    def test_page_has_movement_script(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        assert "pixel-office-movement.js" in response.text

    def test_movement_script_loads_before_main(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        movement_pos = response.text.index("pixel-office-movement.js")
        main_pos = response.text.index("pixel-office.js")
        assert movement_pos < main_pos

    def test_page_has_decorations_script(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        assert "pixel-office-decorations.js" in response.text

    def test_scripts_load_in_correct_order(self):
        response = client.get("/pixel-office")
        assert response.status_code == 200
        text = response.text
        movement_pos = text.index("pixel-office-movement.js")
        decorations_pos = text.index("pixel-office-decorations.js")
        main_pos = text.index('src="/static/js/pixel-office.js"')
        assert movement_pos < decorations_pos < main_pos

    def test_stream_content_type(self):
        with client.stream("GET", "/pixel-office/stream") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]
            # Read just one chunk to verify SSE format, then break
            for line in response.iter_lines():
                if line.startswith("data:"):
                    import json
                    data = json.loads(line[len("data:"):])
                    assert isinstance(data, list)
                    break
