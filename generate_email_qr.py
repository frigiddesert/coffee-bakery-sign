#!/usr/bin/env python3
import qrcode
from PIL import Image, ImageDraw, ImageFont

# Mailto link with email and subject
mailto_link = "mailto:baking-lccbohfpluk03etuh1via7@sandland.us?subject=Baking"

# Generate QR code
qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
)
qr.add_data(mailto_link)
qr.make(fit=True)

# Create QR code image
qr_img = qr.make_image(fill_color="black", back_color="white")

# Create a larger image with text label
img_width = 400
img_height = 500
img = Image.new('RGB', (img_width, img_height), 'white')
draw = ImageDraw.Draw(img)

# Paste QR code (centered)
qr_size = 350
qr_img = qr_img.resize((qr_size, qr_size))
qr_position = ((img_width - qr_size) // 2, 20)
img.paste(qr_img, qr_position)

# Add text label below QR code
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
except:
    font = ImageFont.load_default()

text = "Email Baking Plan"
bbox = draw.textbbox((0, 0), text, font=font)
text_width = bbox[2] - bbox[0]
text_position = ((img_width - text_width) // 2, qr_size + 40)
draw.text(text_position, text, fill="black", font=font)

# Save image
output_path = "qr_codes/email_baking_qr.png"
img.save(output_path)
print(f"QR code saved to: {output_path}")
print(f"Mailto link: {mailto_link}")
