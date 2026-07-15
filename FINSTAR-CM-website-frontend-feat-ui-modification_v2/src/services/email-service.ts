import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { ToastrService } from 'ngx-toastr';
import { firstValueFrom, timeout, retry, catchError } from 'rxjs';
import { throwError } from 'rxjs';
import { environment } from '../environments/environment';

export interface ContactFormData {
  name: string;
  firstName: string;
  email: string;
  phoneNumber: string;
  subject: string;
  message: string;
  subjectDisplay?: string;
  subjectColor?: string;
  fileUrl?: string;
  hideFileBlock?: boolean;
  isCareer?: boolean;
}

export interface CandidatureData {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  posteSouhaite: string;
  villeResidence: string;
  age: number;
  dernierDiplome: string;
  situationMatrimmoniale: string;
  nombreEnfants: number;
  dejaTravaille: string;
  ouTravaille?: string;
  lundiSamedi: boolean;
  parfoisDimanche: boolean;
  joursFeries: boolean;
  horaires: string;
  travailHorsVille: string;
  conditions?: string;
  salaireSouhaite: number;
  methodeRemuneration: string;
  villesDePreference: string[];
  cvUrl?: string;
  candidaturePdfUrl?: string;
  typeCandidature?: string;
  typeStage?: string;
  dureeStage?: string;
  themeStage?: string;
  serviceStage?: string;
  etablissement?: string;
  avaliste?: string;
  cautionAcceptee?: boolean;
  documents?: Record<string, string>;
}

interface EmailJSResponse {
  status: number;
  text: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmailService {
  private readonly apiUrl = 'https://api.emailjs.com/api/v1.0/email/send';
  private readonly requestTimeout = 15000;
  private readonly maxRetries = 2;

  constructor(
    private toastr: ToastrService, 
    private http: HttpClient
  ) {}

  async sendEmail(formData: ContactFormData): Promise<boolean> {
    if (!this.validateFormData(formData)) {
      return false;
    }

    const emailConfig = environment.emailjs;
    const targetEmail = formData.isCareer ? emailConfig.careerEmail : emailConfig.contactEmail;
    const visitorEmail = formData.email?.trim().toLowerCase() || '';

    if (!targetEmail || targetEmail.trim() === '') {
      console.error('ERREUR CRITIQUE: email cible non défini dans environment');
      this.toastr.error('Configuration email manquante', 'Erreur de configuration');
      return false;
    }

    try {
      console.log('Début de l\'envoi de l\'email vers:', targetEmail);

      const templateParams = {
        name: formData.name.trim(),
        firstName: formData.firstName.trim(),
        email: visitorEmail,
        PhoneNumber: formData.phoneNumber || '',
        phoneNumber: formData.phoneNumber || '',
        subject: formData.subjectDisplay || formData.subject.trim(),
        subject_color: formData.subjectColor || '#1f2937',
        message: formData.message.trim(),
        file_url: formData.fileUrl ? `${formData.fileUrl}?download=` : '',
        file_block: (formData.fileUrl && !formData.hideFileBlock) ? `Pour télécharger la pièce jointe, cliquez ici : ${formData.fileUrl}?download=` : '',
        date: new Date().toLocaleString('fr-FR', {
          timeZone: 'Africa/Douala',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
        to_email: targetEmail, 
        to_name: 'Équipe Finstar',
        reply_to: visitorEmail || targetEmail,
        user_agent: this.getBrowserInfo()
      };

      console.log('Template params préparés:', {
        name: templateParams.name,
        firstName: templateParams.firstName,
        email: templateParams.email,
        phoneNumber: templateParams.phoneNumber,
        subject: templateParams.subject,
        to_email: templateParams.to_email,
        date: templateParams.date,
        hasFile: !!formData.fileUrl
      });

      const requestData = {
        service_id: emailConfig.serviceId,
        template_id: emailConfig.templateIdEmail,
        user_id: emailConfig.publicKey,
        template_params: templateParams
      };

      // Validation finale avant envoi
      if (!requestData.service_id || !requestData.template_id || !requestData.user_id) {
        throw new Error('Configuration EmailJS incomplète');
      }

      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      });

      console.log('Envoi de la requête à EmailJS...');

      const response = await firstValueFrom(
        this.http.post(this.apiUrl, requestData, { 
          headers,
          responseType: 'text',
          observe: 'response'
        }).pipe(
          timeout(this.requestTimeout),
          retry({
            count: this.maxRetries,
            delay: (error, retryCount) => {
              console.log(`Nouvelle tentative ${retryCount + 1}/${this.maxRetries + 1}...`);
              return new Promise(resolve => setTimeout(resolve, 2000 * retryCount));
            }
          }),
          catchError((error: HttpErrorResponse) => {
            console.error('Erreur HTTP détaillée:', {
              status: error.status,
              statusText: error.statusText,
              message: error.message,
              error: error.error,
              url: error.url,
              headers: error.headers
            });
            return throwError(() => error);
          })
        )
      );

      console.log('Réponse EmailJS:', {
        status: response.status,
        statusText: response.statusText,
        body: response.body
      });

      const isSuccess = response.status === 200 && 
                       (response.body === 'OK' || 
                        (typeof response.body === 'string' && response.body.includes('OK')));

      if (isSuccess) {
        const userEmail = visitorEmail;
        const replyTemplateId = emailConfig.templateIdReply;

        if (
          userEmail &&
          replyTemplateId &&
          userEmail !== emailConfig.contactEmail &&
          userEmail !== emailConfig.careerEmail
        ) {
          const replyData = {
            service_id: emailConfig.serviceId,
            template_id: replyTemplateId,
            user_id: emailConfig.publicKey,
            template_params: {
              ...templateParams,
              email: userEmail,
              to_email: userEmail,
              reply_to: targetEmail,
              to_name: templateParams.firstName
                ? `${templateParams.firstName} ${templateParams.name}`
                : templateParams.name,
              from_name: 'FINSTAR-CM'
            },
          };

          try {
            await firstValueFrom(
              this.http.post(this.apiUrl, replyData, {
                headers,
                responseType: 'text',
              })
            );
            console.log('Accusé de réception envoyé au visiteur.');
          } catch (err) {
            console.error('Échec de l\'accusé de réception', err);
          }
        }

        this.toastr.success(
          `Votre message a été envoyé avec succès à l'équipe Finstar ! Nous vous répondrons dans les plus brefs délais.`,
          'Message envoyé',
          {
            timeOut: 6000,
            positionClass: 'toast-bottom-right',
            progressBar: true,
            closeButton: true
          }
        );
        
        return true;
      } else {
        throw new Error(`Réponse inattendue d'EmailJS: ${response.body} (Status: ${response.status})`);
      }

    } catch (error: any) {
      console.error('Erreur lors de l\'envoi de l\'email:', error);
      
      let errorMessage = this.getErrorMessage(error);
      let errorTitle = 'Erreur d\'envoi';
      
      // Messages d'erreur personnalisés selon le contexte
      if (error.status === 422) {
        errorTitle = 'Err. Configuration Template';
        errorMessage = 'Le template EmailJS ne reconnaît pas les variables de destination.';
        console.error('❌ Erreur 422 : "The recipients address is empty"');
        console.error('CONSEIL : Vérifiez que dans votre Dashboard EmailJS, le champ "To Email" du template contient exactement {{to_email}}.');
      }

      this.toastr.error(
        `${errorMessage} Pour toute urgence, contactez-nous directement à finstarcm@gmail.com.`,
        errorTitle,
        {
          timeOut: 10000,
          positionClass: 'toast-bottom-right',
          enableHtml: true,
          closeButton: true,
          progressBar: true
        }
      );
      
      return false;
    }
  }

  async sendCandidatureEmail(data: CandidatureData): Promise<boolean> {
    const formattedMessage = this.formatCandidatureForEmail(data);
    
    // On réutilise la structure de ContactFormData pour la compatibilité avec sendEmail
    const contactData: ContactFormData = {
      name: data.nom,
      firstName: data.prenom,
      email: data.email,
      phoneNumber: data.telephone,
      subject: `Candidature: ${data.posteSouhaite} - ${data.nom.toUpperCase()} ${data.prenom}`,
      message: formattedMessage,
      fileUrl: data.cvUrl,
      hideFileBlock: true,
      isCareer: true,
      subjectDisplay: `📥 Nouvelle Candidature - ${data.posteSouhaite}`,
      subjectColor: '#E74C9E'
    };

    return this.sendEmail(contactData);
  }

  private formatCandidatureForEmail(data: any): string {
    const candidateName = `${data.nom?.toUpperCase()} ${data.prenom}`;
    const dateStr = new Date().toLocaleDateString('fr-FR');
    const documentLabels: Record<string, string> = {
      demande: 'Demande', cni: 'CNI', recommandation: 'Recommandation', cv: 'CV',
      ecole: "Document de l'école", planLocalisation: 'Plan de localisation',
      lettreMotivation: 'Lettre de motivation', diplome1: 'Diplôme 1', diplome2: 'Diplôme 2'
    };
    const documentLinks = Object.entries(data.documents || {})
      .map(([key, url], index) => `${index + 2}. ${documentLabels[key] || key} :\n${String(url)}?download=`)
      .join('\n\n');
    const internshipDetails = data.typeCandidature?.startsWith('stage_')
      ? `\nType de stage : ${data.typeStage || 'Non précisé'}\nDurée souhaitée : ${data.dureeStage || 'Non précisée'}\nThème : ${data.themeStage || 'À définir'}\nÉtablissement : ${data.etablissement || 'Non précisé'}\nService souhaité : ${data.serviceStage || 'Non précisé'}\n`
      : '';
    const collectorDetails = data.typeCandidature === 'collectrice'
      ? `\nAvaliste : ${data.avaliste || 'Non précisé'}\nCaution de 100 000 FCFA acceptée : ${data.cautionAcceptee ? 'Oui' : 'Non'}\n`
      : '';

    return `
NOUVELLE CANDIDATURE REÇUE - FINSTAR-CM SA

Candidat : ${candidateName}
Poste souhaité : ${data.posteSouhaite}
Reçu le : ${dateStr}
${internshipDetails}${collectorDetails}

Vous trouverez ci-dessous les liens pour télécharger les documents :

1. FICHE RÉCAPITULATIVE (PDF) : 
${data.candidaturePdfUrl ? `${data.candidaturePdfUrl}?download=` : 'Non générée'}

${documentLinks || `2. CURRICULUM VITAE (CV) :\n${data.cvUrl ? `${data.cvUrl}?download=` : 'Aucun CV fourni'}`}

Veuillez cliquer sur les liens ci-dessus pour ouvrir les documents.
    `.trim();
  }

  private getErrorMessage(error: any): string {
    if (error.name === 'TimeoutError') {
      return 'La requête a expiré. Vérifiez votre connexion internet et réessayez.';
    }
    
    switch (error.status) {
      case 0:
        return 'Problème de connexion réseau. Vérifiez votre connexion internet.';
      case 400:
        return 'Données du formulaire invalides. Veuillez vérifier vos informations.';
      case 401:
        return 'Clé publique EmailJS invalide ou expirée.';
      case 403:
        return 'Accès refusé. Vérifiez les paramètres de sécurité EmailJS.';
      case 404:
        return 'Service ou template EmailJS introuvable.';
      case 422:
        return 'Erreur de validation des données. Le template EmailJS pourrait être mal configuré.';
      case 429:
        return 'Trop de tentatives d\'envoi. Veuillez attendre quelques minutes.';
      case 500:
      case 502:
      case 503:
      case 504:
        return 'Service EmailJS temporairement indisponible. Réessayez dans quelques minutes.';
      default:
        return 'Une erreur inattendue s\'est produite lors de l\'envoi.';
    }
  }

  private validateFormData(formData: ContactFormData): boolean {
    if (!formData) {
      this.showValidationError('Données du formulaire manquantes');
      return false;
    }

    const validations = [
      { field: formData.name, condition: !formData.name || formData.name.trim().length < 2, message: 'Le nom doit contenir au moins 2 caractères' },
      { field: formData.email, condition: (!formData.email || !this.isValidEmail(formData.email)) && (!formData.phoneNumber || formData.phoneNumber.trim().length < 9), message: 'Veuillez saisir une adresse email valide ou un numéro de téléphone' },
      { field: formData.subject, condition: !formData.subject || formData.subject.trim().length < 3, message: 'Le sujet doit contenir au moins 3 caractères' },
      { field: formData.message, condition: !formData.message || formData.message.trim().length < 5, message: 'Le message doit contenir au moins 5 caractères' }
    ];

    for (const validation of validations) {
      if (validation.condition) {
        this.showValidationError(validation.message);
        return false;
      }
    }

    return true;
  }

  private isValidEmail(email: string): boolean {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email.trim());
  }

  private showValidationError(message: string): void {
    this.toastr.warning(message, 'Validation du formulaire', {
      timeOut: 4000,
      positionClass: 'toast-bottom-right'
    });
  }

  private getBrowserInfo(): string {
    const nav = navigator;
    const userAgent = nav.userAgent;
    
    // Extraction simplifiée du navigateur
    let browser = 'Navigateur inconnu';
    if (userAgent.includes('Chrome')) browser = 'Chrome';
    else if (userAgent.includes('Firefox')) browser = 'Firefox';
    else if (userAgent.includes('Safari')) browser = 'Safari';
    else if (userAgent.includes('Edge')) browser = 'Edge';
    
    return `${browser} - ${nav.language || 'fr'}`;
  }

  // Méthode de diagnostic améliorée
  async diagnoseEmailJSConfiguration(): Promise<void> {
    console.log('🔍 === DIAGNOSTIC EMAILJS ===');

    const config = environment.emailjs;
    const diagnosis = {
      publicKey: config.publicKey ? `✅ Défini (${config.publicKey.substring(0, 8)}...)` : '❌ Manquant',
      serviceId: config.serviceId ? `✅ Défini (${config.serviceId})` : '❌ Manquant',
      templateIdEmail: config.templateIdEmail ? `✅ Défini (${config.templateIdEmail})` : '❌ Manquant',
      contactEmail: config.contactEmail ? `✅ ${config.contactEmail}` : '❌ MANQUANT - ERREUR CRITIQUE',
      careerEmail: config.careerEmail ? `✅ ${config.careerEmail}` : '❌ MANQUANT - ERREUR CRITIQUE'
    };

    console.table(diagnosis);

    if (!config.contactEmail || !config.careerEmail) {
      console.error('❌ ERREUR CRITIQUE: contactEmail ou careerEmail manquant dans environment !');
      console.error('📝 Action requise: Mettez à jour vos fichiers environment.ts et environment.prod.ts');
      
      this.toastr.error(
        'Configuration EmailJS incomplète : adresse(s) email de destination manquante(s)',
        'Erreur de configuration',
        { timeOut: 8000, closeButton: true }
      );
    }

    // Vérification de la connectivité EmailJS
    try {
      const testResponse = await fetch('https://api.emailjs.com', { method: 'GET', mode: 'no-cors' });
      console.log('✅ Connectivité EmailJS: OK');
    } catch (error) {
      console.log('❌ Problème de connectivité avec EmailJS:', error);
    }
  }

  // Test rapide de configuration
  async quickConfigTest(): Promise<boolean> {
    const config = environment.emailjs;
    const isConfigValid = !!(config.publicKey && config.serviceId && config.templateIdEmail && config.contactEmail && config.careerEmail);
    
    if (!isConfigValid) {
      console.error('❌ Configuration EmailJS incomplète');
      await this.diagnoseEmailJSConfiguration();
      return false;
    }
    
    console.log('✅ Configuration EmailJS complète');
    return true;
  }
}
