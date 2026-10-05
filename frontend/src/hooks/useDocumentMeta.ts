import { useEffect } from 'react';

function upsertMeta(attribute: 'name' | 'property', key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

/**
 * Keeps <title>, description and Open Graph tags in sync with the active route.
 * Deliberately dependency-free — the app ships no SEO/tracking libraries.
 */
export function useDocumentMeta(title: string, description?: string): void {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description ?? title);
    upsertMeta('property', 'og:title', title);
    if (description) upsertMeta('property', 'og:description', description);
    upsertMeta('name', 'twitter:title', title);
  }, [title, description]);
}
