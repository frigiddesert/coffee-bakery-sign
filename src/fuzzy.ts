import { extract, token_set_ratio } from 'fuzzball';

// Normalize text (remove extra spaces, special characters)
export function normalizeText(s: string): string {
  let text = s.trim();
  text = text.replace(/[•·—]/g, ' ');
  text = text.replace(/\s+/g, ' ');
  return text;
}

// Split OCR text into candidate lines
export function splitCandidateLines(ocrText: string): string[] {
  const rawLines: string[] = [];

  for (const line of ocrText.split('\n')) {
    const normalized = normalizeText(line);
    if (!normalized || normalized.length < 2) continue;
    rawLines.push(normalized);
  }

  // Split on common delimiters
  const out: string[] = [];
  for (const line of rawLines) {
    const parts = line.split(/[,|/]+/).map((p) => p.trim()).filter((p) => p);
    out.push(...parts);
  }

  // Remove duplicates (case-insensitive)
  const seen = new Set<string>();
  const final: string[] = [];
  for (const x of out) {
    const key = x.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    final.push(x);
  }

  return final;
}

// Clean up candidate by removing prep keywords and expanding abbreviations
function cleanCandidate(candidate: string): string {
  let cleaned = candidate;

  // Remove common prep keywords (case-insensitive)
  const prepKeywords = [
    'cut', 'prep', 'make', 'bake', 'prepare', 'mix', 'finish',
    'assemble', 'wrap', 'package', 'box', 'frost', 'fill'
  ];

  for (const keyword of prepKeywords) {
    // Remove keyword at the start or end with word boundaries
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    cleaned = cleaned.replace(regex, '');
  }

  // Expand common abbreviations
  const abbreviations: { [key: string]: string } = {
    'H&C': 'Ham & Cheese',
    'h&c': 'Ham & Cheese',
    'S&F': 'Spinach & Feta',
    's&f': 'Spinach & Feta',
    'B&W': 'Black & White',
    'b&w': 'Black & White',
    'PB': 'Peanut Butter',
    'pb': 'Peanut Butter',
  };

  for (const [abbr, full] of Object.entries(abbreviations)) {
    const regex = new RegExp(`\\b${abbr}\\b`, 'g');
    cleaned = cleaned.replace(regex, full);
  }

  // Clean up extra whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned;
}

// Fuzzy match candidates to menu using fuzzball
export function fuzzyMatchToMenu(candidates: string[], menu: string[]): string[] {
  if (candidates.length === 0) return [];
  if (menu.length === 0) return candidates;

  const matched: string[] = [];
  const used = new Set<string>();

  for (const candidate of candidates) {
    // Clean up the candidate (remove prep keywords, expand abbreviations)
    const cleaned = cleanCandidate(candidate);

    // Skip if cleaned candidate is too short or empty
    if (!cleaned || cleaned.length < 2) continue;

    // Extract best match from menu
    const results = extract(cleaned, menu, { scorer: token_set_ratio, limit: 1 });

    if (results.length === 0) continue;

    const [bestMatch, score] = results[0];
    if (score < 80) continue;

    const key = bestMatch.toLowerCase();
    if (used.has(key)) continue;

    used.add(key);
    matched.push(bestMatch);
  }

  return matched;
}

// Load menu items from env
export function loadMenuItems(menuItemsEnv: string): string[] {
  if (!menuItemsEnv) return [];

  try {
    const arr = JSON.parse(menuItemsEnv);
    if (Array.isArray(arr)) {
      return arr.map((x) => String(x).trim()).filter((x) => x);
    }
  } catch (e) {
    console.error('Failed to parse MENU_ITEMS:', e);
  }

  return [];
}
