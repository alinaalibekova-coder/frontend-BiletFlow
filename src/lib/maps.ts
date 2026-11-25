// Search links for a venue address in the map apps people in Kazakhstan use. Only links:
// nothing is loaded from these sites, so the CSP is unaffected.
export function mapLinks(address: string) {
  const query = encodeURIComponent(address.trim());
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${query}`,
    twoGis: `https://2gis.kz/search/${query}`,
  };
}
