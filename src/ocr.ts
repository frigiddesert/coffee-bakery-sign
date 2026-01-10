import { MistralResponse } from './types';

// Convert image bytes to base64
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Call Mistral Vision API for OCR
export async function mistralOcrImageBytes(
  imageBytes: ArrayBuffer,
  apiKey: string
): Promise<string> {
  if (!apiKey) {
    throw new Error('MISTRAL_API_KEY missing');
  }

  const b64 = arrayBufferToBase64(imageBytes);
  const dataUri = `data:image/jpeg;base64,${b64}`;

  const payload = {
    model: 'pixtral-large-latest',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Extract all text from this image and return it in markdown format. Include any lists, tables, or structured content you see.',
          },
          {
            type: 'image_url',
            image_url: dataUri,
          },
        ],
      },
    ],
  };

  const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mistral API error: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as MistralResponse;

  if (data.choices && data.choices.length > 0) {
    return data.choices[0].message.content || '';
  }

  return '';
}

// Normalize image format (convert HEIC/PNG to JPEG if needed)
// For now, we'll accept any image format and let Mistral handle it
export function normalizeImageBytes(imageBytes: ArrayBuffer): ArrayBuffer {
  // In a full implementation, you might use a library to convert formats
  // For now, we'll pass through as-is since Mistral supports multiple formats
  return imageBytes;
}
