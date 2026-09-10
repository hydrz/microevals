import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_health_and_presets_api():
    with TestClient(app) as client:
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

        res_presets = client.get("/api/presets")
        assert res_presets.status_code == 200
        presets = res_presets.json()
        assert len(presets) >= 24
        assert any("StrawberryEval" in p["title"] for p in presets)

def test_providers_api():
    with TestClient(app) as client:
        res = client.get("/api/providers")
        assert res.status_code == 200
        providers = res.json()
        assert len(providers) >= 1  # Should seed default providers (DeepSeek, OpenAI, Ollama, etc.)

        # Add a custom provider
        new_provider = {
            "id": "custom-test-provider",
            "name": "Custom Test Provider",
            "base_url": "https://api.example.com/v1",
            "api_key": "test-key-123",
            "models": ["custom-model-1", "custom-model-2"],
        }
        create_res = client.post("/api/providers", json=new_provider)
        assert create_res.status_code == 200
        created = create_res.json()
        assert created["id"] == "custom-test-provider"
        assert "api_key" not in created
        assert created["has_api_key"] is True
        assert created["api_key_masked"].endswith("-123")

        update_res = client.post(
            "/api/providers",
            json={**new_provider, "api_key": "", "name": "Updated Provider"},
        )
        assert update_res.status_code == 200
        assert update_res.json()["has_api_key"] is True

        listed = client.get("/api/providers").json()
        assert all("api_key" not in provider for provider in listed)
        assert sum(bool(provider["is_default"]) for provider in listed) == 1

def test_datasets_api():
    with TestClient(app) as client:
        # Create dataset
        ds_payload = {
            "name": "Math Test Suite",
            "description": "Basic arithmetic test cases",
            "cases": [
                {"id": "tc_1", "prompt": "What is 10 + 10?", "ground_truth": "20"},
                {"id": "tc_2", "prompt": "What is 5 * 5?", "ground_truth": "25"},
            ],
        }
        create_res = client.post("/api/datasets", json=ds_payload)
        assert create_res.status_code == 200
        created_id = create_res.json()["id"]

        # Fetch dataset
        get_res = client.get(f"/api/datasets/{created_id}")
        assert get_res.status_code == 200
        assert len(get_res.json()["cases"]) == 2


def test_dataset_atomic_update_and_export_round_trip():
    with TestClient(app) as client:
        created = client.post(
            "/api/datasets",
            json={"name": "Editable", "cases": [{"id": "one", "prompt": "old"}]},
        ).json()

        updated = client.put(
            f"/api/datasets/{created['id']}",
            json={
                "name": "Edited",
                "description": "Atomic replacement",
                "cases": [
                    {
                        "id": "replacement",
                        "prompt": "Return JSON",
                        "system_prompt": "Be concise",
                        "ground_truth": "{}",
                        "expected_tools": ["lookup"],
                        "rule_type": "json_schema",
                        "rule_config": {"type": "object"},
                    }
                ],
            },
        )
        assert updated.status_code == 200
        body = updated.json()
        assert body["name"] == "Edited"
        assert body["case_count"] == 1
        assert body["cases"][0]["id"].endswith("replacement")
        assert body["cases"][0]["expected_tools"] == ["lookup"]

        exported_jsonl = client.get(f"/api/datasets/{created['id']}/export?format=jsonl")
        assert exported_jsonl.status_code == 200
        exported_case = __import__("json").loads(exported_jsonl.text.strip())
        assert exported_case["rule_type"] == "json_schema"
        assert exported_case["rule_config"] == {"type": "object"}

        exported_csv = client.get(f"/api/datasets/{created['id']}/export?format=csv")
        assert exported_csv.status_code == 200
        assert "expected_tools" in exported_csv.text
        assert "lookup" in exported_csv.text

def test_evaluations_list_api():
    with TestClient(app) as client:
        res = client.get("/api/evaluations")
        assert res.status_code == 200
        assert isinstance(res.json(), list)


def test_provider_advanced_settings_and_ping():
    with TestClient(app) as client:
        # Create provider with timeout and custom headers
        advanced_provider = {
            "id": "advanced-test-prov",
            "name": "Advanced Test Provider",
            "base_url": "mock://builtin",
            "api_key": "adv-key-456",
            "models": ["adv-model-1", "adv-model-2"],
            "timeout_seconds": 120,
            "custom_headers": {"HTTP-Referer": "https://microevals.ai", "X-Title": "MicroEvals"},
        }
        res = client.post("/api/providers", json=advanced_provider)
        assert res.status_code == 200
        saved = res.json()
        assert saved["timeout_seconds"] == 120
        assert saved["custom_headers"]["HTTP-Referer"] == "https://microevals.ai"

        # Test ping endpoint
        ping_res = client.post(f"/api/providers/{advanced_provider['id']}/ping")
        assert ping_res.status_code == 200
        ping_data = ping_res.json()
        assert "latency_ms" in ping_data
        assert ping_data["status"] == "ok"

        # Test fetch_models endpoint with mock provider
        fetch_res = client.post(
            "/api/providers/fetch_models",
            json={"provider_id": advanced_provider["id"]},
        )
        assert fetch_res.status_code == 200
        fetched = fetch_res.json()
        assert fetched["status"] == "ok"
        assert len(fetched["models"]) >= 2


def test_batch_run_with_custom_parameters():
    with TestClient(app) as client:
        # Create dataset
        ds = client.post(
            "/api/datasets",
            json={
                "name": "Param Test Set",
                "cases": [{"id": "c1", "prompt": "Say hi", "ground_truth": "hi"}],
            },
        ).json()

        # Run batch with custom temperature, top_p, timeout, system_prompt
        run_res = client.post(
            "/api/evaluations/run",
            json={
                "source": {"type": "dataset", "id": ds["id"]},
                "models": [{"provider_id": "prov_mock", "model_name": "mock-gpt-4o"}],
                "concurrency": 2,
                "temperature": 0.0,
                "top_p": 0.95,
                "max_tokens": 128,
                "timeout": 45.0,
                "system_prompt": "You are a test evaluator.",
            },
        )
        assert run_res.status_code == 200
        assert "run_id" in run_res.json()


def test_direct_preset_run_snapshots_source_without_cloning_dataset():
    with TestClient(app) as client:
        presets = client.get("/api/presets").json()
        preset = presets[0]
        before_count = len(client.get("/api/datasets").json())

        response = client.post(
            "/api/evaluations/run",
            json={
                "source": {"type": "preset", "id": preset["slug"]},
                "models": [{"provider_id": "prov_mock", "model_name": "mock-gpt-4o"}],
            },
        )
        assert response.status_code == 200
        run_id = response.json()["run_id"]
        report = client.get(f"/api/evaluations/{run_id}").json()

        assert report["source_type"] == "preset"
        assert report["source_id"] == preset["slug"]
        assert report["source_snapshot"]
        assert len(client.get("/api/datasets").json()) == before_count

        history_item = next(item for item in client.get("/api/evaluations").json() if item["id"] == run_id)
        assert "case_results" not in history_item


def test_retry_creates_linked_immutable_run_for_failed_pairs():
    with TestClient(app) as client:
        dataset = client.post(
            "/api/datasets",
            json={
                "name": "Retry failures",
                "cases": [{"id": "failure", "prompt": "Say hello", "rule_type": "contains", "rule_config": {"substring": "impossible-value"}}],
            },
        ).json()
        original_id = client.post(
            "/api/evaluations/run",
            json={
                "source": {"type": "dataset", "id": dataset["id"]},
                "models": [{"provider_id": "prov_mock", "model_name": "mock-gpt-4o"}],
            },
        ).json()["run_id"]
        original = client.get(f"/api/evaluations/{original_id}").json()
        assert original["case_results"][0]["verdict"] == "failed"

        retried = client.post(f"/api/evaluations/{original_id}/retry")
        assert retried.status_code == 200
        retry_report = client.get(f"/api/evaluations/{retried.json()['run_id']}").json()
        assert retry_report["retry_of_run_id"] == original_id
        assert retry_report["total_cases"] == 1


def test_set_default_provider_api():
    with TestClient(app) as client:
        # 1. Create a new provider
        p = client.post(
            "/api/providers",
            json={
                "id": "prov_default_candidate",
                "name": "Candidate Default Provider",
                "base_url": "https://api.candidate.com/v1",
                "models": ["cand-1"],
                "is_default": False,
            },
        ).json()
        assert p["is_default"] is False

        # 2. Call set_default endpoint
        set_res = client.post(f"/api/providers/{p['id']}/set_default")
        assert set_res.status_code == 200
        assert set_res.json()["is_default"] is True

        # 3. Check list_providers to confirm it is the only default
        all_provs = client.get("/api/providers").json()
        defaults = [x for x in all_provs if x["is_default"]]
        assert len(defaults) == 1
        assert defaults[0]["id"] == p["id"]
