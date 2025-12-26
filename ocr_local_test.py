import argparse
import base64
import os
from pathlib import Path

from mistralai import Mistral
from dotenv import load_dotenv

load_dotenv()


def main():
    parser = argparse.ArgumentParser(
        description="Send a local image to Mistral OCR and print the markdown response."
    )
    parser.add_argument("image", help="Path to a local image (JPG/PNG/HEIC)")
    parser.add_argument(
        "--api-key", help="Override MISTRAL_API_KEY env var", default=None
    )
    args = parser.parse_args()

    api_key = args.api_key or os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise SystemExit(
            "MISTRAL_API_KEY not set. Pass --api-key or export it in the environment."
        )

    image_path = Path(args.image)
    if not image_path.exists():
        raise SystemExit(f"Image not found: {image_path}")

    payload = base64.b64encode(image_path.read_bytes()).decode("utf-8")
    client = Mistral(api_key=api_key)

    # Use chat completions with vision for OCR
    data_uri = f"data:image/jpeg;base64,{payload}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": "Extract all text from this image and return it in markdown format. Include any lists, tables, or structured content you see."},
                {"type": "image_url", "image_url": data_uri}
            ]
        }
    ]

    resp = client.chat.complete(
        model="pixtral-large-latest",
        messages=messages
    )

    if hasattr(resp, "choices") and resp.choices:
        print(resp.choices[0].message.content)
    else:
        print(resp)


if __name__ == "__main__":
    main()
