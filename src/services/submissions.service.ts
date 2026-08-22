import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ContactSubmission, JobApplication } from '../types/submissions';

/** Fichier déposé : l'identifiant va dans Directus, le lien part dans l'e-mail. */
export interface UploadedFile {
  id: string;
  url: string;
}

/**
 * Envoi des formulaires publics et de leurs pièces jointes.
 *
 * Tout passe par les routes `/api/*` du serveur SSR, qui écrit dans Directus
 * avec un jeton serveur. Le navigateur n'a donc aucune clé d'écriture, et le
 * site ne dépend plus que d'un seul backend.
 */
@Injectable({ providedIn: 'root' })
export class SubmissionsService {
  private readonly http = inject(HttpClient);

  /**
   * Dépose un fichier et renvoie son identifiant Directus **et** son lien de
   * téléchargement signé.
   *
   * Le lien est produit par le serveur au moment du dépôt : le navigateur ne
   * peut pas le signer, et le fichier reste privé dans Directus.
   */
  async uploadFile(
    file: File | Blob,
    fileName: string,
    scope: 'contacts' | 'candidatures' = 'contacts',
  ): Promise<UploadedFile> {
    const response = await firstValueFrom(
      this.http.post<UploadedFile>('/api/uploads', file, {
        headers: {
          'Content-Type': (file as File).type || 'application/octet-stream',
          'X-File-Name': encodeSafeHeader(fileName),
          'X-File-Scope': scope,
        },
      }),
    );
    if (!response?.id || !response?.url) throw new Error("Le dépôt du fichier n'a pas abouti.");
    return response;
  }

  async submitContact(payload: ContactSubmission): Promise<void> {
    await firstValueFrom(this.http.post('/api/contact', payload));
  }

  async submitApplication(payload: JobApplication): Promise<void> {
    await firstValueFrom(this.http.post('/api/candidature', payload));
  }
}

/**
 * Un en-tête HTTP ne transporte que de l'ASCII : les noms de fichiers accentués
 * feraient échouer la requête avant même d'atteindre le serveur.
 */
function encodeSafeHeader(value: string): string {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '_');
}
