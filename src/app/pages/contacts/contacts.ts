import {
  Component,
  inject,
  ChangeDetectionStrategy,
  computed,
  signal,
  effect,
  OnDestroy,
  afterNextRender,
  ViewChild,
  ElementRef,
  NgZone,
  DestroyRef
} from '@angular/core';
import { ContactService } from '../../../services/contact.service';
import { JoinUsComponent } from "../../shared/join-us/join-us";
import { NgOptimizedImage } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { EmailService } from '../../../services/email-service';
import { TranslateModule } from '@ngx-translate/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { I18nService } from '../../../services/i18n.service';
import { Modal, ModalType } from '../../shared/modal/modal';
import { SeoService } from '../../../services/seo.service';
import { SubmissionsService } from '../../../services/submissions.service';
import { environment } from '../../../environments/environment';
import { Subscription } from 'rxjs';
import { ContactSubmission } from '../../../types/submissions';
import { AnalyticsService } from '../../../services/analytics.service';

// Validateur personnalisé pour vérifier qu'au moins un des deux champs (email ou phone) est rempli
function atLeastOneContactFieldValidator(): ValidatorFn {
  return (formGroup: AbstractControl): ValidationErrors | null => {
    const rawEmail = formGroup.get('email')?.value;
    const rawPhone = formGroup.get('phone')?.value;
    
    const email = rawEmail !== null && rawEmail !== undefined ? String(rawEmail) : '';
    const phone = rawPhone !== null && rawPhone !== undefined ? String(rawPhone) : '';
    
    // Si aucun des deux champs n'est rempli, retourner une erreur
    if (email.trim() === '' && phone.trim() === '') {
      return { atLeastOneContactRequired: true };
    }
    
    // Si email est rempli mais invalide, retourner une erreur
    if (email.trim() !== '' && !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email)) {
      return { invalidEmail: true };
    }
    
    // Si phone est rempli mais invalide, retourner une erreur
    if (phone.trim() !== '' && !/^[+]?[0-9\s-]{9,}$/.test(phone.replace(/\s/g, ''))) {
      return { invalidPhone: true };
    }
    
    return null;
  };
}



@Component({
  selector: 'app-contacts',
  imports: [JoinUsComponent, ReactiveFormsModule, TranslateModule, Modal, NgOptimizedImage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts implements OnDestroy {
  private readonly contactService = inject(ContactService);
  private readonly i18nService = inject(I18nService);
  private readonly fb = inject(FormBuilder);
  private readonly emailService = inject(EmailService);
  private readonly toastrService = inject(ToastrService);
  private readonly seoService = inject(SeoService);
  private readonly submissions = inject(SubmissionsService);
  private readonly analytics = inject(AnalyticsService);
  private readonly ngZone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);

  private formSubscription?: Subscription;
  private backgroundStartTimeout?: ReturnType<typeof setTimeout>;
  private invalidFieldFrame?: number;
  selectedFile: File | null = null;

  // États du modal
  readonly showModal = signal(false);
  readonly modalType = signal<ModalType>('info');
  readonly modalTitle = signal('');
  readonly modalMessage = signal('');

  // Données réactives du service
  contactData = this.contactService.contactData;
  contactInfoSection = this.contactService.contactInfoSection;
  backgroundImages = this.contactService.backgroundImages;
  isLoading = this.contactService.isLoading;
  staticTranslations = this.contactService.staticTranslations;

  // États locaux
  isUploading = signal(false);
  isSubmitting = signal(false);
  
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  
  formData!: FormGroup;

  // ✅ Stream des traductions pour les textes dynamiques
  private readonly dynamicTranslationsStream = this.i18nService.translate.stream([
    'ERROR.TITLE',
    'ERROR.MESSAGE',
    'ERROR.RETRY',
    'COMMON.LOADING'
  ]);

  // Conversion des observables en signaux
  dynamicTranslations = toSignal(this.dynamicTranslationsStream, { initialValue: {} });

  // Aperçu court sur la page contact ; la FAQ complète dispose de sa page dédiée.
  readonly faqPreviewRange = [1, 2, 8];
  readonly faqTitle = computed(() => this.staticFaq()['FAQ.TITLE'] || 'Questions fréquentes');
  readonly faqSubtitle = computed(() => this.staticFaq()['FAQ.SUBTITLE'] || '');
  readonly faqLink = computed(() => this.i18nService.createLocalizedLink('/faq'));
  private readonly staticFaq = toSignal(
    this.i18nService.translate.stream(['FAQ.TITLE', 'FAQ.SUBTITLE']),
    { initialValue: {} as Record<string, string> }
  );

  // Textes traduits réactifs
  readonly errorTitle = computed(() => this.dynamicTranslations()['ERROR.TITLE'] || 'Erreur de chargement');
  readonly errorMessage = computed(() => this.dynamicTranslations()['ERROR.MESSAGE'] || 'Impossible de charger les données de contact');
  readonly retryButton = computed(() => this.dynamicTranslations()['ERROR.RETRY'] || 'Réessayer');
  readonly loadingText = computed(() => this.dynamicTranslations()['COMMON.LOADING'] || 'Chargement...');

  // Textes statiques traduits
  readonly emailsLabel = computed(() => this.staticTranslations()['CONTACT.EMAILS'] || 'Emails');
  readonly phoneLabel = computed(() => this.staticTranslations()['CONTACT.PHONE'] || 'Téléphone');
  readonly customerServiceLabel = computed(() => this.staticTranslations()['CONTACT.CUSTOMER_SERVICE'] || 'Service client');
  readonly followUsLabel = computed(() => this.staticTranslations()['CONTACT.FOLLOW_US'] || 'Suivez-nous');
  readonly whatsappLabel = computed(() => this.staticTranslations()['CONTACT.WHATSAPP'] || 'WhatsApp');

  emailHref(email: string): string {
    return `mailto:${email.trim()}`;
  }

  phoneHref(phone: string): string {
    return `tel:${phone.replace(/[^+\d]/g, '')}`;
  }

  whatsappHref(phone: string): string {
    const normalizedPhone = phone.replace(/\D/g, '');
    const message = encodeURIComponent("Bonjour FINSTAR-CM S.A., j'aimerais avoir plus d'informations sur vos services.");
    return `https://wa.me/${normalizedPhone}?text=${message}`;
  }

  // Background slideshow state - Transitions fluides et continues
  readonly displayDurationPerImage = 4000; // 4 secondes pour transition plus fluide
  currentBackgroundIndex = signal(0);
  isBackgroundPaused = signal(false);
  private backgroundInterval: any = null;
  private transitionTimeout: any = null;

  // Get current background URL
  readonly currentBackgroundUrl = computed(() => {
    const images = this.backgroundImages();
    const index = this.currentBackgroundIndex();
    if (images.length === 0) return null;
    return images[index % images.length];
  });

  constructor() {
    this.initializeForm();

    // Réagir aux changements de langue : on rafraîchit le SEO uniquement.
    // Les libellés (options du select, placeholders) sont traduits via le pipe
    // dans le template, donc on NE réinitialise PAS le formulaire — cela
    // effacerait la saisie en cours de l'utilisateur qui bascule FR/EN.
    effect(() => {
      this.i18nService.currentLanguage();
      this.seoService.updatePageSeo('CONTACTS');
    });

    // Start slideshow after render to avoid blocking
    afterNextRender(() => {
      this.ngZone.runOutsideAngular(() => {
        this.backgroundStartTimeout = setTimeout(() => {
          if (this.destroyRef.destroyed) return;

          const images = this.backgroundImages();
          if (images.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            this.startBackgroundSlideshow();
          } else if (images.length > 1) {
            this.ngZone.run(() => {
              if (!this.destroyRef.destroyed) {
                this.isBackgroundPaused.set(true);
              }
            });
          }
        }, 100);
      });
    });
  }

  private startBackgroundSlideshow(): void {
    if (this.destroyRef.destroyed) {
      return;
    }

    // Clear any existing intervals and timeouts
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }

    // Only start slideshow if we have multiple images
    if (this.backgroundImages().length > 1) {
      this.ngZone.runOutsideAngular(() => {
        this.backgroundInterval = setInterval(() => {
          if (this.destroyRef.destroyed) return;

          if (!this.isBackgroundPaused() && document.visibilityState === 'visible') {
            this.ngZone.run(() => {
              if (!this.destroyRef.destroyed) {
                this.currentBackgroundIndex.update(i => (i + 1) % this.backgroundImages().length);
              }
            });
          }
        }, this.displayDurationPerImage);
      });
    }
  }

  ngOnDestroy(): void {
    if (this.backgroundStartTimeout) {
      clearTimeout(this.backgroundStartTimeout);
    }
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }
    if (this.transitionTimeout) {
      clearTimeout(this.transitionTimeout);
    }
    if (this.invalidFieldFrame) {
      cancelAnimationFrame(this.invalidFieldFrame);
    }
    if (this.formSubscription) {
      this.formSubscription.unsubscribe();
    }
  }

  private initializeForm(): void {
    this.formData = this.fb.group({
      name: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
      ]],
      firstname: ['', [
        Validators.required,
        Validators.minLength(2),
        Validators.pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
      ]],
      email: [''],
      phone: [''],
      subject: ['', [Validators.required]],
      otherSubject: [''],
      message: ['', [
        Validators.required,
        Validators.minLength(10),
        Validators.maxLength(1000)
      ]],
      attachment: [null]
    }, { validators: atLeastOneContactFieldValidator() });

    this.formSubscription = this.formData.get('subject')?.valueChanges.subscribe((value: string) => {
      this.handleSubjectChange(value);
    });
  }

  private handleSubjectChange(value: string): void {
    const otherSubjectControl = this.formData.get('otherSubject');
    const emailControl = this.formData.get('email');
    const nameControl = this.formData.get('name');
    const firstnameControl = this.formData.get('firstname');
    const phoneControl = this.formData.get('phone');

    if (value === 'Autres') {
      otherSubjectControl?.setValidators([Validators.required, Validators.minLength(2)]);
    } else {
      otherSubjectControl?.clearValidators();
      otherSubjectControl?.setValue('');
    }
    otherSubjectControl?.updateValueAndValidity();

    if (value === 'Dénonciations') {
      const anonymousText = this.i18nService.translate.instant('CONTACT.ANONYMOUS');
      emailControl?.setValue(environment.emailjs.careerEmail);
      emailControl?.disable();
      
      nameControl?.setValue(anonymousText);
      nameControl?.disable();
      
      firstnameControl?.setValue(anonymousText);
      firstnameControl?.disable();
      
      phoneControl?.setValue('');
      phoneControl?.disable();
    } else {
      if (emailControl?.disabled) {
          emailControl?.enable();
          emailControl?.setValue('');
      }
      if (nameControl?.disabled) {
          nameControl?.enable();
          nameControl?.setValue('');
      }
      if (firstnameControl?.disabled) {
          firstnameControl?.enable();
          firstnameControl?.setValue('');
      }
      if (phoneControl?.disabled) {
          phoneControl?.enable();
          phoneControl?.setValue('');
      }
    }
  }

  onFileChange(event: any): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { 
        this.toastrService.error(
          this.i18nService.translate.instant('CONTACT.ERRORS.FILE_TOO_LARGE'), 
          this.i18nService.translate.instant('ERROR.TITLE')
        );
        event.target.value = '';
        this.selectedFile = null;
        return;
      }
      this.selectedFile = file;
    }
  }

  get formControls() {
    return this.formData.controls;
  }

  async onSubmit(): Promise<void> {
    if (this.isSubmitting()) {
      return;
    }

    this.markAllFieldsAsTouched();

    if (this.formData.invalid) {
      this.invalidFieldFrame = requestAnimationFrame(() => {
        if (this.destroyRef.destroyed) return;
        document.querySelector<HTMLElement>('#contact-form [aria-invalid="true"]')?.focus();
      });
      return;
    }

    if (this.formData.valid) {
      try {
        this.isSubmitting.set(true);
        const formValue = this.formData.getRawValue();

        let subjectDisplay = formValue.subject;
        let subjectColor = '#1f2937';

        if (formValue.subject === 'Autres' && formValue.otherSubject) {
          subjectDisplay = `Autres : ${formValue.otherSubject}`;
        } else if (formValue.subject === 'Dénonciations') {
          subjectColor = '#ff0000';
        }

        let fileId = '';
        if (this.selectedFile) {
          try {
            this.isUploading.set(true);
            fileId = await this.submissions.uploadFile(this.selectedFile, this.selectedFile.name, 'contacts');
          } catch (fileError) {
            console.error('Erreur lors de l\'upload du fichier:', fileError);
            this.toastrService.error(this.i18nService.translate.instant('ERROR.UPLOAD_FAILED'), this.i18nService.translate.instant('ERROR.TITLE'));
            this.isSubmitting.set(false);
            return; // STOP
          } finally {
            this.isUploading.set(false);
          }
        }

        // Enregistrement du message dans Directus (via le serveur SSR).
        try {
          const dbDataToSave: ContactSubmission = {
            nom: formValue.name,
            prenom: formValue.firstname,
            email: formValue.email || '',
            telephone: formValue.phone || '',
            sujet: formValue.subject === 'Autres' && formValue.otherSubject ? `Autres : ${formValue.otherSubject}` : formValue.subject,
            message: formValue.message,
            fichier: fileId || null
          };
          await this.submissions.submitContact(dbDataToSave);
          this.analytics.track('generate_lead', {
            method: 'contact_form',
            subject: formValue.subject || 'unknown'
          });
        } catch (dbError) {
          console.error("Erreur lors de l'enregistrement du message:", dbError);
          this.toastrService.error(this.i18nService.translate.instant('ERROR.DB_SAVE_FAILED'), this.i18nService.translate.instant('ERROR.TITLE'));
          this.isSubmitting.set(false);
          return; // STOP
        }

        // Le mail transporte un lien public : l'identifiant Directus est résolu
        // via le proxy `/directus`, qui sert les fichiers sans exposer de jeton.
        const fileUrl = fileId
          ? `${environment.siteUrl}${environment.browserApiUrl}/assets/${fileId}`
          : '';

        // Envoi Email
        const emailSuccess = await this.emailService.sendEmail({
          name: formValue.name,
          firstName: formValue.firstname,
          email: formValue.email || '',
          phoneNumber: formValue.phone || '',
          subject: formValue.subject,
          message: formValue.message,
          subjectDisplay,
          subjectColor,
          fileUrl
        });

        if (emailSuccess) {
          this.showSuccessModal();
          this.resetForm();
          if (this.fileInput) {
            this.fileInput.nativeElement.value = '';
          }
          this.selectedFile = null;
        } else {
          console.error('Échec de l\'envoi de l\'email (service a retourné false)');
          this.toastrService.error(this.i18nService.translate.instant('ERROR.EMAIL_FAILED'), this.i18nService.translate.instant('ERROR.TITLE'));
          this.showErrorModal();
        }

      } catch (error) {
        console.error('Erreur globale lors de l\'envoi du formulaire:', error);
        this.toastrService.error(this.i18nService.translate.instant('ERROR.MESSAGE_DETAILS'), this.i18nService.translate.instant('ERROR.TITLE'));
        this.showErrorModal();
      } finally {
        this.isSubmitting.set(false);
      }
    } else {
      this.showValidationErrors();
    }
  }

  private showSuccessModal(): void {
    this.modalType.set('success');
    this.modalTitle.set('SUCCESS.TITLE');
    this.modalMessage.set('SUCCESS.MESSAGE');
    this.showModal.set(true);
  }

  private showErrorModal(): void {
    this.modalType.set('error');
    this.modalTitle.set('ERROR.TITLE');
    this.modalMessage.set('ERROR.MESSAGE_DETAILS');
    this.showModal.set(true);
  }

  onModalClose(): void {
    this.showModal.set(false);
    this.scrollToTop();
  }

  private markAllFieldsAsTouched(): void {
    Object.keys(this.formControls).forEach(key => {
      this.formControls[key].markAsTouched();
    });
  }

  private resetForm(): void {
    this.formData.reset();
    Object.keys(this.formControls).forEach(key => {
      this.formControls[key].markAsUntouched();
      this.formControls[key].markAsPristine();
    });
  }

  private showValidationErrors(): void {
    const errors: string[] = [];
    const t = (key: string, params?: object) => this.i18nService.translate.instant(key, params);

    // Vérifier les erreurs au niveau du formulaire (validateur personnalisé)
    if (this.formData.errors) {
      if (this.formData.errors['atLeastOneContactRequired']) {
        errors.push(t('VALIDATION.AT_LEAST_ONE_CONTACT'));
      }
      if (this.formData.errors['invalidEmail']) {
        errors.push(t('VALIDATION.INVALID_EMAIL'));
      }
      if (this.formData.errors['invalidPhone']) {
        errors.push(t('VALIDATION.INVALID_PHONE'));
      }
    }

    // Vérifier les erreurs au niveau des champs individuels
    Object.keys(this.formControls).forEach(key => {
      const control = this.formControls[key];
      if (control.errors) {
        let fieldKey = key.toUpperCase();
        let fieldNamespace = 'CONTACT.FIELDS.';
        
        if (fieldKey === 'FIRSTNAME') fieldKey = 'FIRST_NAME';
        if (fieldKey === 'OTHERSUBJECT') {
          fieldNamespace = 'CONTACT.';
          fieldKey = 'OTHER_SUBJECT_LABEL';
        }
        
        const fieldName = t(`${fieldNamespace}${fieldKey}`);

        if (control.errors['required']) {
          errors.push(t('VALIDATION.REQUIRED', { field: fieldName }));
        }
        if (control.errors['minlength']) {
          const minLength = control.errors['minlength'].requiredLength;
          errors.push(t('VALIDATION.MIN_LENGTH', { field: fieldName, min: minLength }));
        }
        if (control.errors['maxlength']) {
          const maxLength = control.errors['maxlength'].requiredLength;
          errors.push(t('VALIDATION.MAX_LENGTH', { field: fieldName, max: maxLength }));
        }
      }
    });

    if (errors.length > 0) {
      this.toastrService.warning(
        `${t('CANDIDATURE.VALIDATION.FORM_INCOMPLETE')}:<br>• ${errors.join('<br>• ')}`,
        t('CANDIDATURE.VALIDATION.FORM_INCOMPLETE'),
        {
          timeOut: 7000,
          positionClass: 'toast-bottom-right',
          enableHtml: true
        }
      );
    }
  }

  private scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  reloadPage(): void {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }
}
