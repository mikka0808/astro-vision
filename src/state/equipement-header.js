import { Equipements } from './equipement.js';
import { echantillonnage, focaleEffective, fovDeg } from '../utils/optique.js';
function formatDegrees(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return '—';
    }
    if (value >= 10) {
        return value.toFixed(1);
    }
    if (value >= 1) {
        return value.toFixed(2);
    }
    return value.toFixed(3);
}
function formatArcseconds(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return '—';
    }
    if (value >= 2) {
        return value.toFixed(2);
    }
    return value.toFixed(3);
}
function formatFocale(value) {
    if (!Number.isFinite(value) || value <= 0) {
        return '—';
    }
    if (value >= 1000) {
        return value.toFixed(0);
    }
    return value.toFixed(0);
}
function describeProfile(profile) {
    var _a;
    if (!profile) {
        return 'Aucun profil d’équipement actif. Configure ton matériel pour obtenir un suivi personnalisé.';
    }
    const ratio = (_a = profile.reducteur) !== null && _a !== void 0 ? _a : 1;
    const focaleEff = focaleEffective(profile.focaleMm, ratio);
    const champLargeur = fovDeg(profile.capteur.largeurMm, focaleEff);
    const champHauteur = fovDeg(profile.capteur.hauteurMm, focaleEff);
    const binning = profile.bin && profile.bin > 0 ? profile.bin : 1;
    const sampling = echantillonnage(profile.capteur.pixelUm, focaleEff, binning);
    const ratioF = profile.ouvertureMm > 0 ? profile.focaleMm / profile.ouvertureMm : 0;
    const ratioText = Number.isFinite(ratioF) && ratioF > 0 ? `f/${ratioF.toFixed(1)}` : null;
    const reducerText = Math.abs(ratio - 1) > 0.001 ? ` • Réducteur ${ratio.toFixed(2)}×` : '';
    const focaleText = focaleEff > 0 ? ` • Focale eff. ${formatFocale(focaleEff)} mm` : '';
    const ratioDisplay = ratioText ? ` • ${ratioText}` : '';
    return `Champ ${formatDegrees(champLargeur)}° × ${formatDegrees(champHauteur)}° • ${formatArcseconds(sampling)}″/px${focaleText}${ratioDisplay}${reducerText}`;
}
function ensureRoots() {
    const nodes = Array.from(document.querySelectorAll('[data-equipment-switcher]'));
    return nodes.map((root) => ({
        root,
        select: root.querySelector('[data-equipment-select]'),
        summary: root.querySelector('[data-equipment-summary]')
    }));
}
function populateOptions(select, profiles, currentId) {
    select.innerHTML = '';
    profiles.forEach((profile) => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.nom;
        select.appendChild(option);
    });
    if (profiles.length === 0) {
        const option = document.createElement('option');
        option.value = '';
        option.textContent = 'Aucun profil défini';
        select.appendChild(option);
        select.disabled = true;
    }
    else {
        select.disabled = false;
    }
    if (currentId && profiles.some((profile) => profile.id === currentId)) {
        select.value = currentId;
    }
    else if (profiles.length > 0) {
        select.value = profiles[0].id;
    }
    else {
        select.value = '';
    }
}
function updateSummary(summary, profile) {
    if (!summary) {
        return;
    }
    summary.textContent = describeProfile(profile);
}
function attachToRoot(elements) {
    const { root, select, summary } = elements;
    const render = () => {
        var _a;
        const profiles = Equipements.list();
        const currentId = Equipements.getCurrentId();
        if (select) {
            populateOptions(select, profiles, currentId);
        }
        const activeProfile = currentId ? Equipements.getById(currentId) : (_a = profiles[0]) !== null && _a !== void 0 ? _a : null;
        updateSummary(summary, activeProfile);
        root.hidden = false;
        root.dataset.ready = 'true';
    };
    if (select) {
        select.addEventListener('change', (event) => {
            const value = event.target.value;
            if (!value) {
                return;
            }
            Equipements.setCurrent(value);
        });
    }
    Equipements.subscribe(render);
    render();
}
function initHeaderSelectors() {
    const roots = ensureRoots();
    if (roots.length === 0) {
        return;
    }
    roots.forEach((elements) => attachToRoot(elements));
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderSelectors);
}
else {
    initHeaderSelectors();
}
