// markdown-renderer.component.ts
import { Component, Input } from '@angular/core';
import { MarkdownModule } from 'ngx-markdown';

@Component({
  selector: 'app-markdown-renderer',
  imports: [MarkdownModule],
  template: `
    @if (content) {
      <markdown [data]="content"></markdown>
    }
  `,
})
export class MarkdownRenderer {
  @Input() content: string | null = null;
}