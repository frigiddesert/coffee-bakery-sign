#!/usr/bin/env python3
"""
Create print-ready HTML sheets with QR codes (6-up per page)
Layout: 2 columns x 3 rows on 8.5x11" paper with 0.5" margins
"""
import os
from pathlib import Path

# Coffee types in order
coffees = [
    ("Brazil", "brazil"),
    ("Brazil Decaf", "brazil-decaf"),
    ("Brazil Mantiqueira de Minas", "brazil-mantiqueira"),
    ("Burundi", "burundi"),
    ("Colombia", "colombia"),
    ("Colombia Decaf", "colombia-decaf"),
    ("Costa Rica", "costa-rica"),
    ("Dark Roast Decaf", "dark-roast-decaf"),
    ("Early Winter Blend", "early-winter-blend"),
    ("Ethiopia Decaf", "ethiopia-decaf"),
    ("Ethiopia Guji", "ethiopia-guji"),
    ("French Espresso Colombia", "french-espresso-colombia"),
    ("French Espresso Guatemala", "french-espresso-guatemala"),
    ("French Espresso PNG", "french-espresso-png"),
    ("Guatemala", "guatemala"),
    ("Honduras", "honduras"),
    ("Kenya AA", "kenya-aa"),
    ("Kona 100%", "kona-100"),
    ("Mexico", "mexico"),
    ("Mexico Decaf", "mexico-decaf"),
    ("Mocha Java", "mocha-java"),
    ("Nicaragua", "nicaragua"),
    ("PNG", "png"),
    ("Scandinavian Blend", "scandinavian-blend"),
    ("Sulawesi", "sulawesi"),
    ("Sumatra", "sumatra"),
    ("Sumatra Dark Roast", "sumatra-dark"),
    ("Sumatra Decaf", "sumatra-decaf"),
    ("Tanzania PB", "tanzania-pb"),
    ("Village Blend", "village"),
]

html = """<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Village Roaster QR Codes - Print Sheet</title>
    <style>
        @page {
            size: letter;
            margin: 0.5in;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Arial', 'Helvetica', sans-serif;
            background: white;
        }

        .page {
            width: 8.5in;
            height: 11in;
            padding: 0.5in;
            page-break-after: always;
            display: grid;
            grid-template-columns: 1fr 1fr;
            grid-template-rows: repeat(3, 1fr);
            gap: 0.2in;
        }

        .page:last-child {
            page-break-after: auto;
        }

        .qr-card {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 0.3in;
            text-align: center;
        }

        .coffee-name {
            font-size: 26pt;
            font-weight: bold;
            margin-bottom: 0.2in;
            line-height: 1.1;
            color: #2B1712;
            max-width: 100%;
            word-wrap: break-word;
        }

        .qr-image {
            width: 2in;
            height: 2in;
            object-fit: contain;
        }

        @media print {
            body {
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }

            .page {
                margin: 0;
            }
        }

        @media screen {
            body {
                background: #f0f0f0;
                padding: 20px;
            }

            .page {
                background: white;
                margin: 0 auto 20px;
                box-shadow: 0 0 10px rgba(0,0,0,0.2);
            }

            .qr-card {
                border: 1px dashed #ccc;
            }
        }
    </style>
</head>
<body>
"""

# Group coffees into pages of 6
pages = [coffees[i:i+6] for i in range(0, len(coffees), 6)]

for page_num, page_coffees in enumerate(pages):
    html += f'<div class="page">\n'

    for display_name, file_name in page_coffees:
        html += f'''    <div class="qr-card">
        <div class="coffee-name">{display_name}</div>
        <img src="qr_codes/{file_name}.png" alt="{display_name}" class="qr-image">
    </div>
'''

    # Fill remaining slots with empty cards if needed
    remaining = 6 - len(page_coffees)
    for _ in range(remaining):
        html += '    <div class="qr-card"></div>\n'

    html += '</div>\n\n'

html += """</body>
</html>
"""

# Write HTML file
output_file = "qr_print_sheets.html"
with open(output_file, 'w') as f:
    f.write(html)

print(f"✓ Created print-ready HTML: {output_file}")
print(f"  {len(pages)} pages total ({len(coffees)} QR codes)")
print(f"  Layout: 2 columns × 3 rows (6-up per page)")
print("")
print("To print:")
print("  1. Open qr_print_sheets.html in your browser")
print("  2. Print (Ctrl/Cmd+P)")
print("  3. Settings:")
print("     - Paper size: Letter (8.5 x 11 in)")
print("     - Margins: Default (0.5 in already included)")
print("     - Background graphics: ON")
print("")
print("High-volume coffees to print multiple copies:")
print("  - Honduras: 6 copies")
print("  - Ethiopia Guji: 3 copies")
print("  - Brazil, Brazil Decaf, Costa Rica, etc.: 2 copies each")
