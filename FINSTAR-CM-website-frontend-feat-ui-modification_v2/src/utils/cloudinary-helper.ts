import { environment } from '../environments/environment';

// Helper pour construire les URLs Cloudinary depuis Directus
export function getCloudinaryUrl(file: any): string | null {
  if (!file) return null;

  // Si c'est déjà une URL Cloudinary complète
  if (typeof file === 'string' && file.includes('cloudinary.com')) {
    return file;
  }

  // Si c'est un objet avec métadonnées Cloudinary
  if (typeof file === 'object' && file.metadata?.cloudinary) {
    const cloudinaryData = file.metadata.cloudinary;
    
    // Si on a déjà le secure_url, l'utiliser
    if (cloudinaryData.secure_url) {
      return cloudinaryData.secure_url;
    }
    
    // Sinon, construire l'URL avec le public_id et le format réel
    if (cloudinaryData.public_id) {
      const format = cloudinaryData.format || file.type?.split('/')[1] || 'jpg';
      const cloudName = environment.cloudinaryCloudName;
      return `https://res.cloudinary.com/${cloudName}/image/upload/directus/${cloudinaryData.public_id}.${format}`;
    }
  }

  // Si c'est juste un ID de fichier (string)
  if (typeof file === 'string') {
    const cloudName = environment.cloudinaryCloudName;
    return `https://res.cloudinary.com/${cloudName}/image/upload/directus/${file}.png`;
  }

  // Si c'est un objet de relation avec directus_files_id
  if (typeof file === 'object' && file.directus_files_id) {
    return getCloudinaryUrl(file.directus_files_id);
  }

  return null;
}
