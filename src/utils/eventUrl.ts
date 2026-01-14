export function generateEventSlug(title: string, location?: string): string {
  let text = (title + (location ? ' ' + location : '')).trim();

  // Step 1: Convert to lowercase
  text = text.toLowerCase();

  // Step 2: Replace spaces and special characters with single hyphen
  text = text
    .replace(/\s+/g, '-')           // spaces → hyphen
    .replace(/[^a-z0-9-]/g, '');    // remove everything except letters, numbers, hyphen

  // Step 3: Clean up multiple/consecutive hyphens and trim edges
  text = text
    .replace(/-+/g, '-')            // multiple hyphens → single
    .replace(/^-+|-+$/g, '');       // remove leading/trailing hyphens

  // Optional: If result is empty (very rare), fallback
  if (!text) {
    text = 'event-' + Date.now().toString(36); // simple fallback
  }

  return text;
}