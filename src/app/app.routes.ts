import { inject } from '@angular/core';
import { Routes, CanMatchFn } from '@angular/router';
import { LanguageDetectionService } from '../services/language-detection.service';

const supportedLangCanMatch: CanMatchFn = (route, segments) => {
    const languageDetection = inject(LanguageDetectionService);

    const first = segments[0]?.path;
    const normalized = languageDetection.normalizeLanguage(first);
    if (!normalized || !languageDetection.supportedLanguages.includes(normalized as any)) {
        return false;
    }

    return true;
};

export const routes: Routes = [
    // Routes avec préfixe de langue
    {
        path: ':lang',
        canMatch: [supportedLangCanMatch],
        children: [
            { path: '', redirectTo: 'home', pathMatch: 'full' },
            { path: 'home', loadComponent: () => import('./pages/home/home').then(m => m.Home) },
            { path: 'career', loadComponent: () => import('./pages/career/career').then(m => m.Career) },
            { path: 'career/candidature', loadComponent: () => import('./career-candidature/career-candidature').then(m => m.CareerCandidature) },
            { path: 'contacts', loadComponent: () => import('./pages/contacts/contacts').then(m => m.Contacts) },
            { path: 'agencies', loadComponent: () => import('./pages/agencies/agencies').then(m => m.Agencies) },
            { path: 'agences', redirectTo: 'agencies', pathMatch: 'full' },
            { path: 'faq', loadComponent: () => import('./pages/faq/faq').then(m => m.Faq) },
            { path: 'about', loadComponent: () => import('./pages/about/about').then(m => m.About) },
            { path: 'services', loadComponent: () => import('./pages/services/services').then(m => m.Services) },
            { path: 'admin', loadComponent: () => import('./pages/metrics/metrics').then(m => m.Metrics) },
        ]
    },

    // Route racine - charge le composant Home avec la langue par défaut
    { path: '', loadComponent: () => import('./pages/home/home').then(m => m.Home), pathMatch: 'full' },

    // Route wildcard
    { path: '**', redirectTo: '', pathMatch: 'full' }
];
