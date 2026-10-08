import { apiBaseUrl } from '../config/env';

export function productImageSrc(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/store/images/')) {
    return `${apiBaseUrl()}${imageUrl}`;
  }
  return imageUrl;
}
