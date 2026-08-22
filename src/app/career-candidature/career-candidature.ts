import { Component, OnInit, signal, effect, inject, PLATFORM_ID, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { SubmissionsService } from '../../services/submissions.service';
import { EmailService } from '../../services/email-service';
import { PdfService } from '../../services/pdf-service';
import { JobApplication } from '../../types/submissions';
import { SeoService } from '../../services/seo.service';
import { ActivatedRoute } from '@angular/router';
import { firstValueFrom } from 'rxjs';

type AttachmentKey = 'demande' | 'cni' | 'recommandation' | 'cv' | 'ecole' | 'planLocalisation'
  | 'lettreMotivation' | 'diplome1' | 'diplome2';

@Component({
  selector: 'app-career-candidature',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './career-candidature.html',
  styleUrl: './career-candidature.scss'
})
export class CareerCandidature implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);
  private readonly toastr = inject(ToastrService);
  private readonly submissions = inject(SubmissionsService);
  private readonly emailService = inject(EmailService);
  private readonly pdfService = inject(PdfService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly seoService = inject(SeoService);
  private readonly route = inject(ActivatedRoute);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  candidatureForm!: FormGroup;
  selectedFile: File | null = null;
  selectedFiles: Partial<Record<AttachmentKey, File>> = {};
  fileErrors = signal<Partial<Record<AttachmentKey, string>>>({});
  isStageApplication = signal(false);
  isCollectorApplication = signal(false);
  isSupervisionApplication = signal(false);
  isSubmitting = signal(false);
  isUploading = signal(false);
  submitted = signal(false);

  // Valeurs fixes
  minAge = 18;
  maxAge = 65;
  villes = ['Yaoundé', 'Douala', 'Bafoussam', 'Bangangté', 'Nkongsamba', 'Kye-Ossi'];

  // États pour les vues conditionnelles
  showExperienceField = signal(false);
  showConditionsField = signal(false);

  ngOnInit() {
    this.seoService.updatePageSeo('CAREER');
    this.initializeForm();
  }

  private initializeForm() {
    const villeControls: any = {};
    this.villes.forEach(ville => {
      villeControls['ville_' + this.normalizeVilleName(ville)] = [false];
    });

    this.candidatureForm = this.fb.group({
      posteSouhaite: ['', Validators.required],
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      villeResidence: ['', Validators.required],
      age: ['', [Validators.required, Validators.min(this.minAge), Validators.max(this.maxAge)]],
      telephone: ['', [Validators.required, Validators.pattern(/^[0-9]{9}$/)]],
      email: ['', [Validators.email, Validators.pattern(/^[^@]+@[^@]+\.[^@]+$/)]],
      dernierDiplome: ['', Validators.required],
      situationMatrimmoniale: ['', Validators.required],
      nombreEnfants: [0, Validators.min(0)],

      // Expérience professionnelle
      dejaTravaille: ['', Validators.required],
      ouTravaille: [''],

      // Conditions de travail
      lundiSamedi: [false],
      parfoisDimanche: [false],
      joursFeries: [false],
      horaires: ['07h30-18h30', Validators.required],
      travailHorsVille: ['', Validators.required],
      conditions: [''],

      // Rémunération
      salaireSouhaite: ['', [Validators.required, Validators.min(1)]],
      salaireRefuse: [0],
      methodeRemuneration: ['', Validators.required],
      typeStage: ['academique'],
      dureeStage: [''],
      themeStage: [''],
      serviceStage: [''],
      etablissement: [''],
      avaliste: [''],
      avalisteNom: [''],
      avalistePrenom: [''],
      avalisteTelephone: [''],
      avalisteAdresse: [''],
      avalisteRelation: [''],
      cautionAcceptee: [false],
      ...villeControls
    });

    // Auto-remplissage du poste souhaité
    if (isPlatformBrowser(this.platformId)) {
      // 1. Chercher dans les queryParams
      this.route.queryParams.subscribe(params => {
        const jobFromUrl = params['job'];
        if (jobFromUrl) {
          this.candidatureForm.patchValue({ posteSouhaite: jobFromUrl });
          this.configureApplication(jobFromUrl);
        } else {
          // 2. Chercher dans le localStorage (fallback)
          const savedJob = localStorage.getItem('selectedJob');
          if (savedJob) {
            this.candidatureForm.patchValue({ posteSouhaite: savedJob });
            this.configureApplication(savedJob);
            localStorage.removeItem('selectedJob');
          } else {
            // Fallback pour éviter que le champ readonly reste vide (bloque la soumission)
            const defaultPost = this.translate.instant('CONTACT.SPONTANEOUS_CANDIDACY');
            this.candidatureForm.patchValue({ posteSouhaite: defaultPost });
          }
        }
      });
    }
  }

  private configureApplication(jobTitle: string): void {
    const label = jobTitle.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const stage = label.includes('stage') || label.includes('stagiaire') || label.includes('internship');
    const collector = label.includes('collectrice') || label.includes('collection officer');
    const supervision = (label.includes('agent') && label.includes('encadrement')) || label.includes('supervisor');
    this.isStageApplication.set(stage);
    this.isCollectorApplication.set(collector);
    this.isSupervisionApplication.set(supervision);

    const employmentControls = ['situationMatrimmoniale', 'dejaTravaille', 'horaires', 'travailHorsVille', 'salaireSouhaite', 'methodeRemuneration'];
    for (const name of employmentControls) {
      const control = this.candidatureForm.get(name);
      if (stage) control?.clearValidators();
      control?.updateValueAndValidity({ emitEvent: false });
    }
    const avalistControls = ['avalisteNom', 'avalistePrenom', 'avalisteTelephone', 'avalisteAdresse', 'avalisteRelation'];
    const deposit = this.candidatureForm.get('cautionAcceptee');
    for (const name of avalistControls) {
      const control = this.candidatureForm.get(name);
      if (collector) {
        control?.setValidators(name === 'avalisteTelephone'
          ? [Validators.required, Validators.pattern(/^[0-9]{9}$/)]
          : Validators.required);
      } else {
        control?.clearValidators();
      }
      control?.updateValueAndValidity({ emitEvent: false });
    }
    if (collector) deposit?.setValidators(Validators.requiredTrue);
    else deposit?.clearValidators();
    deposit?.updateValueAndValidity({ emitEvent: false });
  }

  onStageTypeChange(): void {
    const academic = this.candidatureForm.get('typeStage')?.value === 'academique';
    this.candidatureForm.patchValue(academic ? { serviceStage: '' } : { themeStage: '', etablissement: '' });
  }

  onPhoneInput(event: Event, controlName: 'telephone' | 'avalisteTelephone'): void {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, 9);
    input.value = digits;
    this.candidatureForm.get(controlName)?.setValue(digits, { emitEvent: false });
  }

  private buildApplicationPayload(formData: any, ficheFileId: string = ''): JobApplication {
    const villesSelectionnees = this.villes.filter(ville => {
      const controlName = 'ville_' + this.normalizeVilleName(ville);
      return formData[controlName];
    });

    const joursHoraires: string[] = [];
    if (formData.lundiSamedi) joursHoraires.push(this.translate.instant('CANDIDATURE.WORK_CONDITIONS.MONDAY_SATURDAY'));
    if (formData.parfoisDimanche) joursHoraires.push(this.translate.instant('CANDIDATURE.WORK_CONDITIONS.SOMETIMES_SUNDAY'));
    if (formData.joursFeries) joursHoraires.push(this.translate.instant('CANDIDATURE.WORK_CONDITIONS.HOLIDAYS'));
    if (formData.horaires) joursHoraires.push(`${this.translate.instant('CANDIDATURE.WORK_CONDITIONS.WORK_HOURS')}: ${formData.horaires}`);
    if (this.isStageApplication()) {
      joursHoraires.push(`Type de stage : ${formData.typeStage}`);
      joursHoraires.push(`Durée souhaitée : ${formData.dureeStage || 'Non précisée'}`);
      if (formData.themeStage) joursHoraires.push(`Thème : ${formData.themeStage}`);
      if (formData.etablissement) joursHoraires.push(`Établissement : ${formData.etablissement}`);
      if (formData.serviceStage) joursHoraires.push(`Service : ${formData.serviceStage}`);
    }

    return {
      nom: formData.nom,
      prenom: formData.prenom,
      age: Number(formData.age),
      ville_residence: formData.villeResidence,
      telephone: formData.telephone.replace(/\D/g, ''),
      email: formData.email,
      dernier_diplome: formData.dernierDiplome,
      situation_matrimoniale: formData.situationMatrimmoniale,
      nombre_enfants: formData.nombreEnfants.toString(),
      a_deja_travaille: formData.dejaTravaille,
      dernier_emploi: formData.ouTravaille || null,
      disponibilites: joursHoraires,
      travail_hors_ville: formData.travailHorsVille,
      condition_hors_ville: this.isCollectorApplication()
        ? `${this.translate.instant('CANDIDATURE.PDF.AVALIST_SECTION')} : ${this.formatAvaliste(formData)} ; ${formData.cautionAcceptee ? this.translate.instant('COMMON.YES') : this.translate.instant('COMMON.NO')}`
        : formData.conditions || null,
      salaire_souhaite: formData.salaireSouhaite.toString().replace(/\./g, ''),
      mode_remuneration: this.mapMethodeRemuneration(formData.methodeRemuneration),
      villes_preference: villesSelectionnees,
      poste_souhaite: formData.posteSouhaite,
      cv: formData.cvFileId || null,
      fiche_recapitulative: ficheFileId || null,
      type_candidature: this.isStageApplication() ? 'stage' : (this.isCollectorApplication() ? 'collectrice' : (this.isSupervisionApplication() ? 'agent_encadrement' : 'emploi')),
      type_stage: this.isStageApplication() ? formData.typeStage : null,
      duree_stage: this.isStageApplication() ? formData.dureeStage || null : null,
      theme_stage: this.isStageApplication() ? formData.themeStage || null : null,
      etablissement: this.isStageApplication() ? formData.etablissement || null : null,
      service_stage: this.isStageApplication() ? formData.serviceStage || null : null,
      avaliste: this.isCollectorApplication() ? this.formatAvaliste(formData) || null : null,
      avaliste_nom: this.isCollectorApplication() ? formData.avalisteNom || null : null,
      avaliste_prenom: this.isCollectorApplication() ? formData.avalistePrenom || null : null,
      avaliste_telephone: this.isCollectorApplication() ? formData.avalisteTelephone || null : null,
      avaliste_adresse: this.isCollectorApplication() ? formData.avalisteAdresse || null : null,
      avaliste_relation: this.isCollectorApplication() ? formData.avalisteRelation || null : null,
      caution_acceptee: this.isCollectorApplication() ? Boolean(formData.cautionAcceptee) : null
    };
  }

  private mapMethodeRemuneration(methode: string): string {
    const mapping: { [key: string]: string } = {
      'salaire-fixe': this.translate.instant('CANDIDATURE.SALARY.FIXED_SALARY'),
      'salaire-commissions': this.translate.instant('CANDIDATURE.SALARY.FIXED_PLUS_COMMISSION'),
      'commissions-uniquement': this.translate.instant('CANDIDATURE.SALARY.COMMISSION_ONLY')
    };
    return mapping[methode] || methode;
  }

  private formatAvaliste(formData: any): string {
    if (!this.isCollectorApplication()) return '';
    const fullName = `${formData.avalistePrenom || ''} ${formData.avalisteNom || ''}`.trim();
    return [
      fullName,
      formData.avalisteTelephone ? `Tél. ${formData.avalisteTelephone}` : '',
      formData.avalisteAdresse || '',
      formData.avalisteRelation ? `Lien : ${formData.avalisteRelation}` : ''
    ].filter(Boolean).join(' — ');
  }

  normalizeVilleName(ville: string): string {
    return ville.toLowerCase()
      .replace(/é/g, 'e')
      .replace(/à/g, 'a')
      .replace(/è/g, 'e')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]/g, '_');
  }

  onTravailleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.showExperienceField.set(target.value === 'oui');
    if (!this.showExperienceField()) {
      this.candidatureForm.patchValue({ ouTravaille: '' });
    }
  }

  onHorsVilleChange(event: Event) {
    const target = event.target as HTMLInputElement;
    this.showConditionsField.set(target.value === 'oui');
    if (!this.showConditionsField()) {
      this.candidatureForm.patchValue({ conditions: '' });
    }
  }

  onSalaireInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, ''); // Uniquement les chiffres
    if (value) {
      const formatted = value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      this.candidatureForm.get(controlName)?.setValue(formatted, { emitEvent: false });
    } else {
      this.candidatureForm.get(controlName)?.setValue('', { emitEvent: false });
    }
  }

  onFileChange(event: any, key: AttachmentKey = 'cv'): void {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { 
        this.toastr.error(
          this.translate.instant('CONTACT.ERRORS.FILE_TOO_LARGE'), 
          this.translate.instant('ERROR.TITLE')
        );
        event.target.value = '';
        delete this.selectedFiles[key];
        if (key === 'cv') this.selectedFile = null;
        return;
      }
      this.selectedFiles = { ...this.selectedFiles, [key]: file };
      if (key === 'cv') this.selectedFile = file;
      this.fileErrors.update(errors => ({ ...errors, [key]: '' }));
    }
  }

  fileName(key: AttachmentKey): string {
    return this.selectedFiles[key]?.name ?? '';
  }

  fileError(key: AttachmentKey): string {
    return this.fileErrors()[key] ?? '';
  }

  requiredAttachments(): AttachmentKey[] {
    if (this.isStageApplication()) return ['demande', 'cni', 'cv'];
    if (this.isCollectorApplication()) return ['demande', 'cni', 'cv', 'planLocalisation'];
    if (this.isSupervisionApplication()) return ['cv', 'lettreMotivation', 'diplome1'];
    return [];
  }

  private validateAttachments(): boolean {
    const missing = this.requiredAttachments().filter(key => !this.selectedFiles[key]);
    const errors: Partial<Record<AttachmentKey, string>> = {};
    missing.forEach(key => errors[key] = this.translate.instant('VALIDATION.REQUIRED'));
    this.fileErrors.set(errors);
    return missing.length === 0;
  }

  /**
   * Dépose les pièces jointes et renvoie, pour chacune, l'identifiant Directus
   * (enregistré dans la candidature) et le lien signé (envoyé dans l'e-mail).
   */
  private async uploadAttachments(
    namePart: string,
    jobPart: string,
    uniqueId: number,
  ): Promise<{ ids: Record<string, string>; links: Record<string, string> }> {
    const ids: Record<string, string> = {};
    const links: Record<string, string> = {};
    this.isUploading.set(true);
    try {
      for (const key of Object.keys(this.selectedFiles) as AttachmentKey[]) {
        const file = this.selectedFiles[key];
        if (!file) continue;
        const extension = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '';
        const fileName = `candidature-${namePart}-${jobPart}-${key}-${uniqueId}${extension}`;
        const uploaded = await this.submissions.uploadFile(file, fileName, 'candidatures');
        ids[key] = uploaded.id;
        links[key] = uploaded.url;
      }
      return { ids, links };
    } finally {
      this.isUploading.set(false);
    }
  }

  normalizeForFilename(text: string): string {
    return text.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  async onSubmit() {
    if (this.isSubmitting()) return;

    this.candidatureForm.markAllAsTouched();
    const attachmentsValid = this.validateAttachments();
    if (this.candidatureForm.valid && attachmentsValid) {
      try {
        this.isSubmitting.set(true);
        const formDataRaw = this.candidatureForm.getRawValue();

        const villesSelectionnees = this.villes.filter(ville =>
          formDataRaw['ville_' + this.normalizeVilleName(ville)]
        );

        // Préparation des noms de fichiers
        const namePart = this.normalizeForFilename(`${formDataRaw.nom}-${formDataRaw.prenom}`);
        const jobPart = this.normalizeForFilename(formDataRaw.posteSouhaite);
        const uniqueId = Date.now();
        
        const recapPrefix = this.isStageApplication()
          ? 'fiche-demande-stage'
          : (this.isCollectorApplication()
            ? 'fiche-candidature-collectrice'
            : (this.isSupervisionApplication() ? 'fiche-candidature-agent-encadrement' : 'fiche-candidature'));
        const recapFileName = `${recapPrefix}-${namePart}-${jobPart}-${uniqueId}.pdf`;

        // Deux vues du même dépôt : les identifiants Directus sont enregistrés
        // avec la candidature, les liens signés partent dans la notification.
        const { ids: documentIds, links: documentLinks } = await this.uploadAttachments(namePart, jobPart, uniqueId);
        const cvFileId = documentIds['cv'] ?? '';

        const formDataFull = { 
          ...formDataRaw,
          avaliste: this.formatAvaliste(formDataRaw),
          cvFileId,
          villesDePreference: villesSelectionnees,
          typeCandidature: this.isStageApplication()
            ? `stage_${formDataRaw.typeStage}`
            : (this.isCollectorApplication()
              ? 'collectrice'
              : (this.isSupervisionApplication() ? 'agent_encadrement' : undefined)),
          documents: documentIds
        };

        // Génération du PDF récapitulatif
        let recapFileId = '';
        let recapLink = '';
        try {
          const pdfBlob = await this.pdfService.generateCandidaturePdf(formDataFull as any);
          const uploaded = await this.submissions.uploadFile(pdfBlob, recapFileName, 'candidatures');
          recapFileId = uploaded.id;
          recapLink = uploaded.url;
        } catch (pdfError) {
          console.error('Erreur lors de la génération/upload du PDF:', pdfError);
          this.toastr.error(this.translate.instant('ERROR.UPLOAD_FAILED'), this.translate.instant('ERROR.TITLE'));
          this.isSubmitting.set(false);
          return;
        }

        // Enregistrement de la candidature dans Directus (via le serveur SSR).
        const dbDataToSave = this.buildApplicationPayload(formDataFull, recapFileId);
        
        try {
          await this.submissions.submitApplication({ ...dbDataToSave, documents: documentIds });
        } catch (dbError) {
          console.error('Erreur lors de la sauvegarde DB:', dbError);
          this.toastr.error(this.translate.instant('ERROR.DB_SAVE_FAILED'), this.translate.instant('ERROR.TITLE'));
          this.isSubmitting.set(false);
          return;
        }

        // Envoi Email EmailJS
        try {
          // L'e-mail ne transporte que des liens signés : jamais d'identifiant nu,
          // qui n'était de toute façon pas cliquable.
          const resultEmailData = {
            ...formDataFull,
            documents: documentLinks,
            candidaturePdfUrl: recapLink,
            cvUrl: documentLinks['cv'] || '',
          } as any;
          const emailSuccess = await this.emailService.sendCandidatureEmail(resultEmailData);
          if (!emailSuccess) throw new Error('Email sending failed');
        } catch (emailError) {
          console.error('Erreur lors de l\'envoi email:', emailError);
          this.toastr.error(this.translate.instant('ERROR.EMAIL_FAILED'), this.translate.instant('ERROR.TITLE'));
          this.isSubmitting.set(false);
          return;
        }

        // Succès
        this.submitted.set(true);
        this.toastr.success(this.translate.instant('CANDIDATURE.SUCCESS.TOAST_MESSAGE'), this.translate.instant('COMMON.SUCCESS'));
        
        // Vider le formulaire
        this.candidatureForm.reset({
          horaires: '07h30-18h30',
          dejaTravaille: '',
          travailHorsVille: ''
        });
        
        // Vider l'input fichier
        if (this.fileInput) {
          this.fileInput.nativeElement.value = '';
        }
        
        this.selectedFile = null;
        this.selectedFiles = {};
        this.fileErrors.set({});
        this.isSubmitting.set(false);

        // Optionnel: Faire défiler vers le haut pour voir le message
        window.scrollTo({ top: 0, behavior: 'smooth' });

      } catch (error) {
        console.error('Erreur globale lors de la soumission:', error);
        this.toastr.error(this.translate.instant('ERROR.MESSAGE'), this.translate.instant('ERROR.TITLE'));
        this.isSubmitting.set(false);
      }
    } else {
      Object.keys(this.candidatureForm.controls).forEach(key => {
        const control = this.candidatureForm.get(key);
        if (control?.invalid) {
          control.markAsTouched();
        }
      });
      this.toastr.warning(this.translate.instant('CANDIDATURE.VALIDATION.FORM_INCOMPLETE'), this.translate.instant('ERROR.TITLE'));
      if (typeof document !== 'undefined') {
        const firstInvalid = document.querySelector<HTMLElement>('.form [aria-invalid="true"], .form .error');
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }
}