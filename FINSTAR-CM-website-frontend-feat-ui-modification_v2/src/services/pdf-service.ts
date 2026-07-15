import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CandidatureData } from './email-service';

@Injectable({ providedIn: 'root' })
export class PdfService {
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

  private summary(title: string, subtitle: string, sections: Array<{title: string; rows: string[][]}>, documents: string[], logo: string | null): Blob {
    const doc = new jsPDF(); const w = doc.internal.pageSize.getWidth(); const h = doc.internal.pageSize.getHeight(); const navy: [number,number,number] = [29,35,48]; const pink: [number,number,number] = [212,47,126];
    doc.setFillColor(255,255,255); doc.rect(0,0,w,40,'F'); if (logo) doc.addImage(logo,'PNG',14,7,48,19); doc.setTextColor(...navy); doc.setFont('helvetica','bold'); doc.setFontSize(14); doc.text(title,w-14,15,{align:'right'}); doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(85,91,103); doc.text(subtitle,w-14,23,{align:'right'}); doc.setDrawColor(220,174,20); doc.setLineWidth(1.2); doc.line(14,32,w-14,32);
    let y=47; for (const s of sections) { doc.setFillColor(249,247,248); doc.roundedRect(14,y-5,w-28,9,1.5,1.5,'F'); doc.setTextColor(...pink); doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.text(s.title,18,y+1); y+=7; autoTable(doc,{startY:y,body:s.rows,theme:'plain',styles:{fontSize:8.5,cellPadding:2.2,textColor:navy},columnStyles:{0:{fontStyle:'bold',cellWidth:48,fillColor:[253,250,252]}},margin:{left:14,right:14}}); y=(doc as any).lastAutoTable.finalY+9; }
    doc.setTextColor(...pink); doc.setFont('helvetica','bold'); doc.text(this.t('DOCUMENTS_SECTION'),18,y+1); y+=7; autoTable(doc,{startY:y,body:(documents.length?documents:[this.t('NO_DOCUMENT')]).map(n=>[[`— ${n}`]]),theme:'plain',styles:{fontSize:8.5,cellPadding:1.8,textColor:navy},margin:{left:18,right:14}});
    const fy=h-14;
    const footerMargin=22;
    doc.setDrawColor(220,174,20);
    doc.setLineWidth(0.6);
    doc.line(footerMargin,fy-8,w-footerMargin,fy-8);
    doc.setFont('helvetica','normal');
    doc.setFontSize(7.5);
    doc.setTextColor(90,90,90);
    doc.text(this.t('CONFIDENTIAL'),footerMargin,fy);
    doc.text(`${this.t('GENERATED_ON')} ${new Date().toLocaleDateString()}`,w-footerMargin,fy,{align:'right'});
    return doc.output('blob');
  }
  private formatFcfa(v: any): string { return String(v || '').replace(/\D/g,'').replace(/\B(?=(\d{3})+(?!\d))/g,'.'); }
  private async loadLogoDataUrl(): Promise<string|null> { try { const r=await fetch('/assets/logo-finstar.png'); if(!r.ok)return null; const b=await r.blob(); return await new Promise<string>((res,rej)=>{const rd=new FileReader(); rd.onload=()=>res(String(rd.result)); rd.onerror=()=>rej(rd.error); rd.readAsDataURL(b);}); } catch { return null; } }
}
