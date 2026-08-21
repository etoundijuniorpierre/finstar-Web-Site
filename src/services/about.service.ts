import { inject, Injectable, computed } from '@angular/core';
import { DirectusV2Service } from './directus-v2.service';


function toBlockContent(values: unknown, body: string): unknown {
  const entries = Array.isArray(values)
    ? values
    : (values as { items?: unknown[] } | null)?.items;

  if (!Array.isArray(entries) || entries.length === 0) return body;

  // Une liste de chaînes désigne des noms (les partenaires) : elle doit rester
  // un tableau, que la page transforme en cartes de logos.
  if (Array.isArray(values) && entries.every((entry) => typeof entry === 'string')) {
    return values;
  }

  const header = Array.isArray(values)
    ? undefined
    : (values as { header?: string } | null)?.header;

  const content: Record<string, unknown> = header ? { header } : {};
  entries.forEach((entry, index) => {
    if (entry && typeof entry === 'object') {
      const { title, content: text } = entry as { title?: string; content?: string };
      content[title || `Point ${index + 1}`] = text ?? '';
      return;
    }
    const raw = String(entry ?? '').trim();
    const split = raw.match(/^(.+?[.:])\s+(.*)$/s);
    content[split ? split[1].trim() : raw] = split ? split[2].trim() : '';
  });
  return content;
}

@Injectable({ providedIn: 'root' })
export class AboutService {
  private readonly directusV2 = inject(DirectusV2Service);

  isLoading = computed(() => !this.directusV2.ready());

  /** Présence de la page (le template s'en sert comme garde d'affichage). */
  aboutPage = computed(() => this.directusV2.aboutPage());

  // Données de la page « À propos » (singleton + blocs typés).
  aboutData = computed(() => {
    const page = this.directusV2.aboutPage();
    if (!page) return null;

    const rows = this.directusV2.aboutBlocks().map((block) => {
      const body = String(block['body'] || '');
      const content = toBlockContent(block['values'], body);
      // Un bloc sans liste n'affiche que son texte : le répéter en description
      // le ferait apparaître deux fois dans la carte.
      const hasList = content !== body;
      return {
        Catégorie: String(block['title'] || block['kind'] || ''),
        ...(hasList ? { Description: body } : {}),
        Contenu: content,
      };
    });

    return {
      headline: String(page['headline'] || ''),
      subheadline: String(page['subheadline'] || ''),
      image: page['image'] as string | null,
      tableData: { data: rows },
    };
  });

  // Logos des partenaires
  partnerImages = computed(() => this.directusV2.partners()
    .map((partner) => partner['logo'])
    .filter((url): url is string => typeof url === 'string' && !!url));

  partners = computed(() => this.directusV2.partners().map((partner) => ({
    name: String(partner['name'] || ''),
    url: String(partner['url'] || '#'),
    image: String(partner['logo'] || '/assets/placeholder-partner.png'),
  })));
}
