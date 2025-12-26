#!/usr/bin/env python3
"""
Generate QR codes that update the roasting display via public URL.
Usage:
    python generate_roast_qr.py --base-url https://your-app.onrender.com --roast "Honduras" --output honduras_qr.png
"""
import argparse
import qrcode
from pathlib import Path


def main():
    parser = argparse.ArgumentParser(
        description="Generate a QR code that updates the roasting display"
    )
    parser.add_argument(
        "--base-url",
        required=True,
        help="Base URL of your deployed app (e.g., https://village-roaster.onrender.com)",
    )
    parser.add_argument(
        "--roast", required=True, help="Name of the roast (e.g., Honduras, Kenya AA)"
    )
    parser.add_argument(
        "--output", default="roast_qr.png", help="Output filename for the QR code"
    )
    args = parser.parse_args()

    # Clean up base URL
    base_url = args.base_url.rstrip("/")

    # Construct the API URL
    api_url = f"{base_url}/api/roast?item={args.roast}"

    # Generate QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(api_url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(args.output)

    print(f"✓ QR code generated: {args.output}")
    print(f"  URL: {api_url}")
    print(f"\nScan this QR code to update 'Roasting Now' to: {args.roast}")


if __name__ == "__main__":
    main()
