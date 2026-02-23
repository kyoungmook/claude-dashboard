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
