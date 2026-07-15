import { isPlatformBrowser } from '@angular/common';
import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Injectable({ providedIn: 'root' })
export class MarkdownService {
  constructor(private readonly sanitizer: DomSanitizer,
        @Inject(PLATFORM_ID) private readonly platformId: Object

  ) {
    // Configuration essentielle de marked
    marked.setOptions({
      breaks: true,       // Convertit les sauts de ligne en <br>
      gfm: true          // GitHub Flavored Markdown
    });
  }

  async parse(markdown: string | null): Promise<SafeHtml | null> {
    if (!markdown?.trim()) return null;
    
    try {
      const html = await marked.parse(markdown);
      return this.sanitize(html);
    } catch (e) {
      console.error('Markdown parsing error:', e);
      return this.sanitize(`<div class="markdown-error">⚠️ Erreur d'affichage du contenu</div>`);
    }
  }

 private sanitize(html: string): SafeHtml {
    // Nettoyage différent selon l'environnement
    return isPlatformBrowser(this.platformId) 
      ? this.browserSanitize(html)
      : this.serverSanitize(html);
  }

  private browserSanitize(html: string): SafeHtml {
    const cleanHtml = this.removeUnsafeTags(html);
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }

  private serverSanitize(html: string): SafeHtml {
    // Solution simplifiée pour SSR
    const cleanHtml = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/ on\w+="[^"]*"/g, '');
    
    return this.sanitizer.bypassSecurityTrustHtml(cleanHtml);
  }

  private removeUnsafeTags(html: string): string {
    // Liste des tags autorisés (peut être étendue)
    const allowedTags = [
      'p', 'br', 'strong', 'em', 'h1', 'h2', 'h3', 'h4', 
      'ul', 'ol', 'li', 'a', 'blockquote', 'code', 'pre'
    ];
    
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    // Supprime les éléments non autorisés
    doc.body.querySelectorAll('*').forEach(el => {
      if (!allowedTags.includes(el.tagName.toLowerCase())) {
        el.remove();
      }
      
      // Supprime les attributs dangereux
      Array.from(el.attributes).forEach(attr => {
        if (attr.name.startsWith('on') || attr.name === 'style') {
          el.removeAttribute(attr.name);
        }
      });
    });
    
    return doc.body.innerHTML;
  }
}