"""Image detection tests that must remain compatible with Python 3.13+."""

from __future__ import annotations

import base64
import io

from PIL import Image

from app.services.conversation.image_processor import ImageProcessor


def _image_bytes(image_format: str) -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (2, 2), color="red").save(output, format=image_format)
    return output.getvalue()


def test_encode_uses_detected_png_mime_type():
    encoded = ImageProcessor().encode_to_base64(_image_bytes("PNG"))

    assert encoded.startswith("data:image/png;base64,")


def test_base64_detection_accepts_image_and_rejects_arbitrary_bytes():
    image = base64.b64encode(_image_bytes("JPEG")).decode("ascii")
    arbitrary = base64.b64encode(b"not an image").decode("ascii")

    assert ImageProcessor.is_base64_image(image)
    assert not ImageProcessor.is_base64_image(arbitrary)
