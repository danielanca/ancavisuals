export function generateEventSlug(location: string, phone: string) {
    // remove special chars, lowercase, replace spaces with hyphens
    const cleanLocation = location
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s]/g, '') // keep letters/numbers only
      .replace(/\s+/g, '-');       // replace spaces with '-'
  
    const cleanPhone = phone.replace(/\D/g, ''); // remove non-digits
  
    return `${cleanLocation}-${cleanPhone}`;
  }
  