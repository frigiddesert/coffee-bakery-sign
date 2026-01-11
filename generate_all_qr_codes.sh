#!/bin/bash

# QR Code Generator for Village Roaster Coffee Types
# Base URL for the Worker
BASE_URL="https://village-roaster-sign.eric-c5f.workers.dev"

# Create output directory
mkdir -p qr_codes

echo "Generating 30 QR codes for Village Roaster..."
echo ""

# Function to generate QR code
generate_qr() {
    local name="$1"
    local output="$2"
    uvx --quiet --from qrcode --with Pillow python3 python-legacy/generate_roast_qr.py \
        --base-url "$BASE_URL" \
        --roast "$name" \
        --output "qr_codes/${output}.png"
}

# Generate QR codes for all coffee types
generate_qr "Brazil" "brazil"
generate_qr "Brazil Decaf" "brazil-decaf"
generate_qr "Brazil Mantiqueira de Minas" "brazil-mantiqueira"
generate_qr "Burundi" "burundi"
generate_qr "Colombia" "colombia"
generate_qr "Colombia Decaf" "colombia-decaf"
generate_qr "Costa Rica" "costa-rica"
generate_qr "Dark Roast Decaf" "dark-roast-decaf"
generate_qr "Early Winter Blend" "early-winter-blend"
generate_qr "Ethiopia Decaf" "ethiopia-decaf"
generate_qr "Ethiopia Guji" "ethiopia-guji"
generate_qr "French Espresso Colombia" "french-espresso-colombia"
generate_qr "French Espresso Guatemala" "french-espresso-guatemala"
generate_qr "French Espresso PNG" "french-espresso-png"
generate_qr "Guatemala" "guatemala"
generate_qr "Honduras" "honduras"
generate_qr "Kenya AA" "kenya-aa"
generate_qr "Kona 100%" "kona-100"
generate_qr "Mexico" "mexico"
generate_qr "Mexico Decaf" "mexico-decaf"
generate_qr "Mocha Java" "mocha-java"
generate_qr "Nicaragua" "nicaragua"
generate_qr "PNG" "png"
generate_qr "Scandinavian Blend" "scandinavian-blend"
generate_qr "Sulawesi" "sulawesi"
generate_qr "Sumatra" "sumatra"
generate_qr "Sumatra Dark Roast" "sumatra-dark"
generate_qr "Sumatra Decaf" "sumatra-decaf"
generate_qr "Tanzania PB" "tanzania-pb"
generate_qr "Village Blend" "village"

echo ""
echo "✓ Generated 30 QR codes in qr_codes/ directory"
echo ""
echo "Print multiple copies for high-volume roasts:"
echo "  - Honduras: 6 copies (qr_codes/honduras.png)"
echo "  - Ethiopia Guji: 3 copies (qr_codes/ethiopia-guji.png)"
echo "  - Brazil, Brazil Decaf, Costa Rica, etc.: 2 copies each"
echo ""
echo "Each QR code points to: $BASE_URL/api/roast?item=<coffee-name>"
