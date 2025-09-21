"""Flask application exposing endpoints for DSPy response generation and edits.

This module provides two routes:

* ``POST /generate_response`` - Accepts a ``prompt`` and produces an LLM response
  via the DSPy pipeline. The prompt-response pair is cached with a generated
  ``turn_id`` so that follow-up edits can be associated with the original output.
* ``POST /save_edit`` - Accepts a ``turn_id`` and ``edited_output`` payload,
  retrieves the cached prompt and original output, and appends a JSON line to
  ``golden_dataset.jsonl`` so the interaction can be reused for fine-tuning.

The implementation keeps an in-memory cache keyed by ``turn_id``. The module is
written in a way that allows plugging in a real DSPy pipeline while still being
functional in development environments where the pipeline is unavailable.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict, Optional
from uuid import uuid4

from flask import Flask, jsonify, request
from flask_cors import CORS

_LOGGER = logging.getLogger(__name__)


def _default_pipeline(prompt: str) -> str:
    """Fallback pipeline used when a DSPy pipeline is not configured.

    The real application is expected to replace this with an actual DSPy
    pipeline. Returning a simple echo keeps the endpoint operational for manual
    testing without requiring DSPy to be installed in the execution environment.
    """

    return prompt


try:  # pragma: no cover - optional dependency.
    from dspy import pipeline  # type: ignore

    def _run_pipeline(prompt: str) -> str:
        return pipeline(prompt)

except Exception:  # pragma: no cover - we do not want to hard fail on import.
    _LOGGER.warning(
        "DSPy pipeline is not available; falling back to echo responses."
    )
    _run_pipeline = _default_pipeline


def create_app() -> Flask:
    """Create and configure the Flask application instance."""

    app = Flask(__name__)
    CORS(app)

    conversation_cache: Dict[str, Dict[str, str]] = {}
    dataset_path = Path("golden_dataset.jsonl")

    @app.post("/generate_response")
    def generate_response() -> Any:
        """Generate a response using the DSPy pipeline and cache the result."""

        payload: Optional[Dict[str, Any]] = request.get_json(silent=True)
        if not payload or "prompt" not in payload:
            return (
                jsonify({"error": "Missing required field 'prompt'."}),
                400,
            )

        prompt = payload["prompt"]
        if not isinstance(prompt, str) or not prompt.strip():
            return (
                jsonify({"error": "Field 'prompt' must be a non-empty string."}),
                400,
            )

        try:
            output = _run_pipeline(prompt)
        except Exception as exc:  # pragma: no cover - depends on external pipeline
            _LOGGER.exception("DSPy pipeline execution failed")
            return jsonify({"error": str(exc)}), 500

        turn_id = str(uuid4())
        conversation_cache[turn_id] = {
            "prompt": prompt,
            "original_llm_output": output,
        }

        return jsonify({"output": output, "turn_id": turn_id})

    @app.post("/save_edit")
    def save_edit() -> Any:
        """Persist an edited LLM response associated with a cached prompt."""

        payload: Optional[Dict[str, Any]] = request.get_json(silent=True)
        if not payload:
            return jsonify({"error": "Request body must be valid JSON."}), 400

        turn_id = payload.get("turn_id")
        edited_output = payload.get("edited_output")

        if not isinstance(turn_id, str) or not turn_id:
            return (
                jsonify({"error": "Field 'turn_id' must be a non-empty string."}),
                400,
            )

        if not isinstance(edited_output, str):
            return (
                jsonify({"error": "Field 'edited_output' must be a string."}),
                400,
            )

        cached = conversation_cache.get(turn_id)
        if not cached:
            return (
                jsonify({"error": f"Unknown turn_id: {turn_id}"}),
                404,
            )

        record = {
            "prompt": cached["prompt"],
            "original_llm_output": cached["original_llm_output"],
            "edited_output": edited_output,
        }

        try:
            dataset_path.parent.mkdir(parents=True, exist_ok=True)
            with dataset_path.open("a", encoding="utf-8") as file:
                file.write(json.dumps(record, ensure_ascii=False) + "\n")
        except OSError as exc:
            _LOGGER.exception("Failed to append to golden dataset")
            return jsonify({"error": str(exc)}), 500

        return jsonify({"status": "saved", "turn_id": turn_id})

    return app


app = create_app()

