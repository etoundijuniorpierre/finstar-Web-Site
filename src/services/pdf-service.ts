import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CandidatureData } from './email-service';

@Injectable({ providedIn: 'root' })
export class PdfService {
  private static readonly NAVY: [number, number, number] = [29, 35, 48];
  private static readonly PINK: [number, number, number] = [212, 47, 126];
  private static readonly GOLD: [number, number, number] = [220, 174, 20];

  private readonly translate = inject(TranslateService);
  private t(key: string): string {
    const value = this.translate.instant(`CANDIDATURE.PDF.${key}`);
    return value && value !== `CANDIDATURE.PDF.${key}` ? value : key;
  }

  async generateCandidaturePdf(data: CandidatureData): Promise<Blob> {
    const application = data as any;
    const logo = await this.loadLogoDataUrl();
    if (application.typeCandidature?.startsWith('stage_')) return this.stagePdf(application, logo);
    if (application.typeCandidature === 'collectrice') return this.collectorPdf(application, logo);
    if (application.typeCandidature === 'agent_encadrement') return this.supervisionPdf(application, logo);
    return this.genericPdf(application, logo);
  }

  private stagePdf(d: any, logo: string | null): Blob {
    const academic = d.typeStage === 'academique';
    return this.summary(this.t('STAGE_TITLE'), academic ? this.t('STAGE_ACADEMIC') : this.t('STAGE_PROFESSIONAL'), [
      { title: this.t('CANDIDATE_SECTION'), rows: this.candidateRows(d) },
      { title: this.t('STAGE_REQUEST_SECTION'), rows: [
        [this.t('TYPE'), academic ? this.t('STAGE_ACADEMIC') : this.t('STAGE_PROFESSIONAL')],
        [this.t('DURATION'), d.dureeStage || this.t('NOT_SPECIFIED')],
        ...(academic ? [[this.t('THEME'), d.themeStage || this.t('NOT_SPECIFIED')], [this.t('SCHOOL'), d.etablissement || this.t('NOT_SPECIFIED')]] : [[this.t('SERVICE'), d.serviceStage || this.t('NOT_SPECIFIED')]]),
        [this.t('FINALITY'), this.t('REPORT_VALIDATION')]
      ] }
    ], this.documentNames(d), logo);
  }

  private collectorPdf(d: any, logo: string | null): Blob {
    return this.summary(this.t('COLLECTOR_TITLE'), this.t('COLLECTOR_SUBTITLE'), [
      { title: this.t('CANDIDATE_SECTION'), rows: [...this.candidateRows(d), [this.t('MARITAL_STATUS'), d.situationMatrimmoniale || this.t('NOT_SPECIFIED')], [this.t('CHILDREN'), String(d.nombreEnfants ?? 0)]] },
      { title: this.t('AVALIST_SECTION'), rows: [[this.t('AVALIST_NAME'), `${d.avalistePrenom || ''} ${d.avalisteNom || ''}`.trim() || this.t('NOT_REPORTED')], [this.t('AVALIST_PHONE'), d.avalisteTelephone || this.t('NOT_REPORTED')], [this.t('AVALIST_ADDRESS'), d.avalisteAdresse || this.t('NOT_REPORTED')], [this.t('AVALIST_RELATION'), d.avalisteRelation || this.t('NOT_REPORTED')], [this.t('DEPOSIT'), d.cautionAcceptee ? this.t('YES') : this.t('NO')]] },
      { title: this.t('EMPLOYMENT_SECTION'), rows: this.employmentRows(d) }
    ], this.documentNames(d), logo);
  }

  private supervisionPdf(d: any, logo: string | null): Blob {
    return this.summary(this.t('SUPERVISION_TITLE'), this.t('SUPERVISION_SUBTITLE'), [
      { title: this.t('CANDIDATE_SECTION'), rows: [...this.candidateRows(d), [this.t('MARITAL_STATUS'), d.situationMatrimmoniale || this.t('NOT_SPECIFIED')]] },
      { title: this.t('PROFILE_SECTION'), rows: [[this.t('EXPERIENCE'), d.dejaTravaille === 'oui' ? this.t('YES') : this.t('NO')], ...(d.dejaTravaille === 'oui' ? [[this.t('LAST_JOB'), d.ouTravaille || this.t('NOT_SPECIFIED')]] : []), ...this.employmentRows(d).slice(2)] }
    ], this.documentNames(d), logo);
  }

  private genericPdf(d: any, logo: string | null): Blob {
    return this.summary(this.t('GENERIC_TITLE'), `${this.t('GENERIC_POST')} : ${String(d.posteSouhaite || '').toUpperCase()}`, [
      { title: this.t('PERSONAL_SECTION'), rows: this.candidateRows(d) },
      { title: this.t('CAREER_SECTION'), rows: this.employmentRows(d) }
    ], this.documentNames(d), logo);
  }

  private candidateRows(d: any): string[][] { return [
    [this.t('FULL_NAME'), `${d.nom || ''} ${d.prenom || ''}`.trim() || this.t('NOT_REPORTED')],
    [this.t('AGE'), d.age ? `${d.age} ans` : this.t('NOT_REPORTED')], [this.t('CITY'), d.villeResidence || this.t('NOT_REPORTED')],
    [this.t('PHONE'), d.telephone || this.t('NOT_REPORTED')], [this.t('EMAIL'), d.email || this.t('NOT_REPORTED')], [this.t('LAST_DIPLOMA'), d.dernierDiplome || this.t('NOT_REPORTED')]
  ]; }

  private employmentRows(d: any): string[][] { const cities = Array.isArray(d.villesDePreference) && d.villesDePreference.length ? d.villesDePreference.join(', ') : this.t('NOT_SPECIFIED'); return [
    [this.t('EXPERIENCE'), d.dejaTravaille === 'oui' ? this.t('YES') : this.t('NO')], [this.t('LAST_JOB'), d.dejaTravaille === 'oui' ? (d.ouTravaille || this.t('NOT_SPECIFIED')) : this.t('NOT_APPLICABLE')],
    [this.t('MOBILITY'), d.travailHorsVille || this.t('NOT_SPECIFIED')], [this.t('PREFERRED_CITIES'), cities], [this.t('DESIRED_SALARY'), d.salaireSouhaite ? `${this.formatFcfa(d.salaireSouhaite)} FCFA` : this.t('NOT_SPECIFIED')], [this.t('PAYMENT_METHOD'), d.methodeRemuneration || this.t('NOT_SPECIFIED')]
  ]; }

  private documentNames(d: any): string[] { const labels: Record<string, string> = { demande: 'DOC_APPLICATION', cni: 'DOC_IDENTITY', recommandation: 'DOC_RECOMMENDATION', cv: 'DOC_CV', ecole: 'DOC_SCHOOL', planLocalisation: 'DOC_LOCATION_MAP', lettreMotivation: 'DOC_MOTIVATION_LETTER', diplome1: 'DOC_DIPLOMA_1', diplome2: 'DOC_DIPLOMA_2' }; return Object.keys(d.documents || {}).map(k => this.translate.instant(`CANDIDATURE.${labels[k] || k}`)); }

  /**
   * Paliers de composition, du plus aéré au plus resserré.
   *
   * Une fiche de stage tient en deux sections courtes ; une fiche de collectrice
   * en compte trois, avaliste compris. À réglage unique, la première laissait un
   * tiers de page blanc et la seconde débordait sur le pied de page. Le palier
   * est donc choisi d'après le contenu réel.
   */
  private readonly tiers = [
    { font: 10, padding: 3.6, gap: 13, band: 11 },
    { font: 9.5, padding: 3.1, gap: 11.5, band: 10.5 },
    { font: 9, padding: 2.7, gap: 10, band: 10 },
    { font: 8.5, padding: 2.2, gap: 9, band: 9 },
    { font: 8, padding: 1.8, gap: 7.5, band: 8.5 }
  ];

  private summary(title: string, subtitle: string, sections: Array<{title: string; rows: string[][]}>, documents: string[], logo: string | null): Blob {
    const hauteur = new jsPDF().internal.pageSize.getHeight();
    const limite = hauteur - 27;   // dernière ligne utile avant le trait de pied
    const reserve = 36;            // hauteur du bloc de signature

    // Essai à blanc de chaque palier : on retient le plus aéré qui tient sur une
    // page, en privilégiant celui qui laisse encore place à la signature.
    const essais = this.tiers.map(tier => ({ tier, ...this.body(new jsPDF(), sections, documents, tier, 0, false) }));
    const tiennent = essais.filter(e => e.pages === 1 && e.end <= limite);
    const avecSignature = tiennent.find(e => e.end <= limite - reserve);
    const retenu = avecSignature ?? tiennent[0] ?? essais[essais.length - 1];
    const signature = Boolean(avecSignature);

    // Le reste d'espace est réparti entre les sections plutôt que laissé en bas.
    const interstices = sections.length + 1;
    const gapSup = Math.max(0, Math.min(12, (limite - (signature ? reserve : 0) - retenu.end) / interstices));

    const doc = new jsPDF();
    this.header(doc, title, subtitle, logo);
    this.body(doc, sections, documents, retenu.tier, gapSup, true);
    if (signature) this.signatureBlock(doc, limite - reserve);
    this.footer(doc);
    return doc.output('blob');
  }

  private header(doc: jsPDF, title: string, subtitle: string, logo: string | null): void {
    const w = doc.internal.pageSize.getWidth();
    doc.setFillColor(255,255,255); doc.rect(0,0,w,40,'F');
    if (logo) doc.addImage(logo,'PNG',14,7,48,19);
    doc.setTextColor(...PdfService.NAVY); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(title,w-14,15,{align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(85,91,103); doc.text(subtitle,w-14,23,{align:'right'});
    doc.setDrawColor(...PdfService.GOLD); doc.setLineWidth(1.2); doc.line(14,32,w-14,32);
  }

  /**
   * Corps de la fiche. `draw` à faux sert aux essais de mise en page : seules
   * les hauteurs comptent, rien n'est peint.
   */
  private body(
    doc: jsPDF,
    sections: Array<{title: string; rows: string[][]}>,
    documents: string[],
    tier: { font: number; padding: number; gap: number; band: number },
    gapSup: number,
    draw: boolean,
  ): { end: number; pages: number } {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    let y = 47;

    const block = (heading: string, rows: any[][], left: number, columns?: any) => {
      if (draw) {
        doc.setFillColor(249,247,248); doc.roundedRect(14,y-5,w-28,tier.band,1.5,1.5,'F');
        doc.setTextColor(...PdfService.PINK); doc.setFont('helvetica','bold'); doc.setFontSize(tier.font + 1); doc.text(heading,18,y+1);
      }
      y += tier.band - 2;
      autoTable(doc, {
        startY: y, body: rows, theme: 'plain',
        styles: { fontSize: tier.font, cellPadding: tier.padding, textColor: PdfService.NAVY },
        // Le pied de page est peint après coup : la marge basse empêche une
        // ligne de tableau de venir s'écrire dessus (trait de pied à h - 22).
        margin: { left, right: 14, bottom: 30 },
        ...(columns ? { columnStyles: columns } : {})
      });
      y = (doc as any).lastAutoTable.finalY + tier.gap + gapSup;
    };

    for (const s of sections) {
      block(s.title, s.rows, 14, { 0: { fontStyle: 'bold', cellWidth: 48, fillColor: [253,250,252] } });
    }
    block(this.t('DOCUMENTS_SECTION'), (documents.length ? documents : [this.t('NO_DOCUMENT')]).map(n => [`— ${n}`]), 18);

    return { end: (doc as any).lastAutoTable.finalY, pages: doc.getNumberOfPages() };
  }

  /** Lieu, date et cadres de signature : ce qui reste à remplir à la main. */
  private signatureBlock(doc: jsPDF, y: number): void {
    const w = doc.internal.pageSize.getWidth();
    const largeur = (w - 28 - 12) / 2;
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(...PdfService.NAVY);
    doc.text(this.t('PLACE_DATE'), 14, y + 6);
    doc.setDrawColor(214,214,218); doc.setLineWidth(0.4);
    doc.roundedRect(14, y + 10, largeur, 20, 1.5, 1.5, 'S');
    doc.roundedRect(14 + largeur + 12, y + 10, largeur, 20, 1.5, 1.5, 'S');
    doc.setFontSize(7.5); doc.setTextColor(120,120,128);
    doc.text(this.t('SIGNATURE_CANDIDATE'), 18, y + 15);
    doc.text(this.t('COMPANY_VISA'), 18 + largeur + 12, y + 15);
  }

  /** Pied de page, répété sur chaque page si la fiche en compte plusieurs. */
  private footer(doc: jsPDF): void {
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const fy = h - 14;
    const marge = 22;
    const pages = doc.getNumberOfPages();
    for (let page = 1; page <= pages; page += 1) {
      doc.setPage(page);
      doc.setDrawColor(...PdfService.GOLD); doc.setLineWidth(0.6); doc.line(marge, fy - 8, w - marge, fy - 8);
      doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(90,90,90);
      doc.text(this.t('CONFIDENTIAL'), marge, fy);
      const droite = pages > 1
        ? `${this.t('GENERATED_ON')} ${new Date().toLocaleDateString()} — ${page}/${pages}`
        : `${this.t('GENERATED_ON')} ${new Date().toLocaleDateString()}`;
      doc.text(droite, w - marge, fy, { align: 'right' });
      doc.setFontSize(6.8); doc.setTextColor(130,130,138);
      doc.text(this.t('CONTACT'), w / 2, fy + 5, { align: 'center' });
    }
  }
  private formatFcfa(v: any): string { return String(v || '').replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
  private async loadLogoDataUrl(): Promise<string|null> { try { const r=await fetch('/assets/logo-finstar.png'); if(!r.ok)return null; const b=await r.blob(); return await new Promise<string>((res,rej)=>{const rd=new FileReader(); rd.onload=()=>res(String(rd.result)); rd.onerror=()=>rej(rd.error); rd.readAsDataURL(b);}); } catch { return null; } }
}
