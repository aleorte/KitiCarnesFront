export function apiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_URL?.trim();

  if (import.meta.env.PROD) {
    if (!raw) {
      throw new Error(
        'Falta VITE_API_URL. En Vercel definila por ambiente (Preview ≠ Production).',
      );
    }
    if (raw.startsWith('/')) {
      throw new Error(
        'VITE_API_URL de producción debe ser absoluta, por ejemplo https://api.tudominio.com/api/v1',
      );
    }
  }

  return (raw || '/api/v1').replace(/\/$/, '');
}
