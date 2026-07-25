from app.services.conversation.model_logging import safe_model_settings


def test_safe_model_settings_excludes_credentials_and_endpoints():
    settings = {
        "model_id": "model-1",
        "temperature": 0.2,
        "max_tokens": 512,
        "api_key": "must-not-be-logged",
        "api_url": "https://user:password@example.test/v1?token=secret",
        "custom_headers": {"Authorization": "Bearer secret"},
    }

    assert safe_model_settings(settings) == {
        "model_id": "model-1",
        "temperature": 0.2,
        "max_tokens": 512,
    }
