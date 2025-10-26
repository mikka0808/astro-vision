import { Equipements } from '../state/equipement.js';
import { focaleEffective, fovDeg, echantillonnage } from '../utils/optique.js';
import { getAstrophotoProfile } from '../core/astro.js';

const listContainer = document.getElementById('equipmentList');
const listHint = document.getElementById('equipmentListHint');
const createButton = document.getElementById('createEquipmentProfile');
const form = document.getElementById('equipmentForm');
const formTitle = document.getElementById('equipmentFormTitle');
const submitButton = document.getElementById('saveEquipmentProfile');
const deleteButton = document.getElementById('deleteEquipmentProfile');
const statusMessage = document.getElementById('equipmentStatus');
const presetButtons = document.querySelectorAll('[data-equipment-preset]');

const inputs = {
  nom: document.getElementById('equipmentName'),
  focale: document.getElementById('equipmentFocale'),
  ouverture: document.getElementById('equipmentOuverture'),
  reducteur: document.getElementById('equipmentReducteur'),
  bin: document.getElementById('equipmentBin'),
  rotation: document.getElementById('equipmentRotation'),
  capteurLargeur: document.getElementById('equipmentSensorWidth'),
  capteurHauteur: document.getElementById('equipmentSensorHeight'),
  pixel: document.getElementById('equipmentPixel'),
  miroirX: document.getElementById('equipmentMirrorX'),
  miroirY: document.getElementById('equipmentMirrorY'),
  setActive: document.getElementById('equipmentSetActive')
};

const previewFields = {
  focale: document.getElementById('previewFocale'),
  fov: document.getElementById('previewFov'),
  sampling: document.getElementById('previewSampling'),
  ratio: document.getElementById('previewRatio')
};

let editingId = null;
let createMode = false;

function toNumber(value) {
  if (typeof value !== 'string') {
    return Number(value);
  }
  const normalized = value.replace(',', '.');
  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric : NaN;
}

function toInteger(value) {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) {
    return NaN;
  }
  return Math.round(numeric);
}

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

function formatRatio(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return '—';
  }
  return `f/${value.toFixed(1)}`;
}

function getFormSnapshot() {
  const focale = toNumber(inputs.focale.value);
  const ouverture = toNumber(inputs.ouverture.value);
  const reducteurValue = toNumber(inputs.reducteur.value);
  const largeur = toNumber(inputs.capteurLargeur.value);
  const hauteur = toNumber(inputs.capteurHauteur.value);
  const pixel = toNumber(inputs.pixel.value);
  const bin = toInteger(inputs.bin.value);
  const rotation = toNumber(inputs.rotation.value);
  return {
    nom: inputs.nom.value.trim(),
    focaleMm: Number.isFinite(focale) ? focale : NaN,
    ouvertureMm: Number.isFinite(ouverture) ? ouverture : NaN,
    reducteur: Number.isFinite(reducteurValue) && reducteurValue > 0 ? reducteurValue : null,
    capteur: {
      largeurMm: Number.isFinite(largeur) ? largeur : NaN,
      hauteurMm: Number.isFinite(hauteur) ? hauteur : NaN,
      pixelUm: Number.isFinite(pixel) ? pixel : NaN
    },
    bin: Number.isFinite(bin) && bin > 0 ? bin : 1,
    rotationDeg: Number.isFinite(rotation) ? rotation : 0,
    miroirX: Boolean(inputs.miroirX.checked),
    miroirY: Boolean(inputs.miroirY.checked)
  };
}

function updatePreview() {
  const snapshot = getFormSnapshot();
  const ratio = snapshot.reducteur ?? 1;
  const focaleEff = focaleEffective(snapshot.focaleMm, ratio);
  const champLargeur = fovDeg(snapshot.capteur.largeurMm, focaleEff);
  const champHauteur = fovDeg(snapshot.capteur.hauteurMm, focaleEff);
  const sampling = echantillonnage(snapshot.capteur.pixelUm, focaleEff, snapshot.bin);
  const ratioF = snapshot.ouvertureMm > 0 ? snapshot.focaleMm / snapshot.ouvertureMm : NaN;

  if (previewFields.focale) {
    previewFields.focale.textContent = focaleEff > 0 ? `${formatFocale(focaleEff)} mm` : '—';
  }
  if (previewFields.fov) {
    const largeur = formatDegrees(champLargeur);
    const hauteur = formatDegrees(champHauteur);
    previewFields.fov.textContent = largeur === '—' || hauteur === '—' ? '—' : `${largeur}° × ${hauteur}°`;
  }
  if (previewFields.sampling) {
    const samplingText = formatArcseconds(sampling);
    previewFields.sampling.textContent = samplingText === '—' ? '—' : `${samplingText}″/px`;
  }
  if (previewFields.ratio) {
    const ratioText = formatRatio(ratioF);
    previewFields.ratio.textContent = ratioText;
  }
}

function clearStatus() {
  if (statusMessage) {
    statusMessage.textContent = '';
    statusMessage.hidden = true;
  }
}

function showStatus(message) {
  if (!statusMessage) {
    return;
  }
  statusMessage.textContent = message;
  statusMessage.hidden = false;
}

function fillFormFromProfile(profile) {
  if (!profile) {
    return;
  }
  inputs.nom.value = profile.nom;
  inputs.focale.value = profile.focaleMm.toString();
  inputs.ouverture.value = profile.ouvertureMm.toString();
  inputs.reducteur.value = profile.reducteur ? profile.reducteur.toString() : '';
  inputs.capteurLargeur.value = profile.capteur.largeurMm.toString();
  inputs.capteurHauteur.value = profile.capteur.hauteurMm.toString();
  inputs.pixel.value = profile.capteur.pixelUm.toString();
  inputs.bin.value = profile.bin.toString();
  inputs.rotation.value = profile.rotationDeg.toString();
  inputs.miroirX.checked = Boolean(profile.miroirX);
  inputs.miroirY.checked = Boolean(profile.miroirY);
  inputs.setActive.checked = Equipements.getCurrentId() === profile.id;
  updatePreview();
}

function resetFormFields() {
  form.reset();
  inputs.nom.value = '';
  inputs.focale.value = '';
  inputs.ouverture.value = '';
  inputs.reducteur.value = '';
  inputs.capteurLargeur.value = '';
  inputs.capteurHauteur.value = '';
  inputs.pixel.value = '';
  inputs.bin.value = '1';
  inputs.rotation.value = '0';
  inputs.miroirX.checked = false;
  inputs.miroirY.checked = false;
  inputs.setActive.checked = !Equipements.getCurrentId();
  updatePreview();
}

function sanitizePresetPayload(setup, label) {
  if (!setup || !setup.sensor) {
    return null;
  }
  const focaleMm = Number(setup.focaleMm);
  const ouvertureMm = Number(setup.apertureMm);
  const largeurMm = Number(setup.sensor.widthMm);
  const hauteurMm = Number(setup.sensor.heightMm);
  const pixelUm = Number(setup.sensor.pixelUm);
  if (!Number.isFinite(focaleMm) || focaleMm <= 0) {
    return null;
  }
  if (!Number.isFinite(ouvertureMm) || ouvertureMm <= 0) {
    return null;
  }
  if (!Number.isFinite(largeurMm) || largeurMm <= 0) {
    return null;
  }
  if (!Number.isFinite(hauteurMm) || hauteurMm <= 0) {
    return null;
  }
  if (!Number.isFinite(pixelUm) || pixelUm <= 0) {
    return null;
  }
  const reducteur = Number(setup.reducteur);
  const ratio = Number.isFinite(reducteur) && reducteur > 0 ? reducteur : null;
  const bin = Number.isFinite(setup.bin) && setup.bin > 0 ? Math.round(setup.bin) : 1;
  const rotation = Number.isFinite(setup.rotationDeg) ? setup.rotationDeg : 0;
  return {
    id: typeof setup.presetId === 'string' && setup.presetId.trim() ? setup.presetId.trim() : `preset-${Date.now()}`,
    nom: typeof setup.presetName === 'string' && setup.presetName.trim() ? setup.presetName.trim() : label,
    focaleMm,
    ouvertureMm,
    reducteur: ratio && Math.abs(ratio - 1) > 0.001 ? ratio : null,
    capteur: {
      largeurMm,
      hauteurMm,
      pixelUm
    },
    bin,
    rotationDeg: rotation,
    miroirX: Boolean(setup.mirrorX),
    miroirY: Boolean(setup.mirrorY)
  };
}

function applyPresetProfile(presetId) {
  clearStatus();
  const preset = getAstrophotoProfile(presetId);
  if (!preset || !preset.setup) {
    showStatus('Ce préréglage est indisponible pour le moment.');
    return;
  }
  const payload = sanitizePresetPayload(preset.setup, preset.label);
  if (!payload) {
    showStatus('Impossible de charger ce préréglage. Vérifie les valeurs définies.');
    return;
  }
  const existing = Equipements.getById(payload.id);
  if (existing) {
    showStatus(`Le préréglage « ${existing.nom} » est déjà enregistré.`);
    startEdition(existing.id);
    return;
  }
  try {
    const created = Equipements.create(payload);
    Equipements.setCurrent(created.id);
    showStatus(`Préréglage « ${created.nom} » ajouté et défini comme actif.`);
    startEdition(created.id);
    if (inputs.setActive) {
      inputs.setActive.checked = true;
    }
  } catch (error) {
    console.error('Erreur lors de la création du préréglage :', error);
    showStatus('Impossible d’ajouter ce préréglage automatiquement.');
  }
}

function renderList(profiles, currentId) {
  const allProfiles = Array.isArray(profiles) ? profiles : Equipements.list();
  const activeId = typeof currentId === 'string' ? currentId : Equipements.getCurrentId();
  if (!listContainer) {
    return;
  }
  listContainer.innerHTML = '';
  if (listHint) {
    if (allProfiles.length === 0) {
      listHint.textContent = 'Ajoute ton premier profil pour personnaliser les calculs de champ.';
    } else {
      const activeProfile = allProfiles.find((profile) => profile.id === activeId);
      const activeText = activeProfile ? `Profil actif : ${activeProfile.nom}.` : 'Aucun profil actif.';
      const plural = allProfiles.length > 1 ? 'profils' : 'profil';
      listHint.textContent = `Tu disposes de ${allProfiles.length} ${plural}. ${activeText}`;
    }
  }
  if (allProfiles.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'equipment-list__empty';
    empty.textContent = 'Aucun profil enregistré pour le moment.';
    listContainer.appendChild(empty);
    return;
  }
  allProfiles.forEach((profile) => {
    const ratio = profile.reducteur ?? 1;
    const focaleEff = focaleEffective(profile.focaleMm, ratio);
    const champLargeur = fovDeg(profile.capteur.largeurMm, focaleEff);
    const champHauteur = fovDeg(profile.capteur.hauteurMm, focaleEff);
    const sampling = echantillonnage(profile.capteur.pixelUm, focaleEff, profile.bin);

    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'equipment-card';
    card.dataset.profileId = profile.id;
    if (!createMode && editingId === profile.id) {
      card.classList.add('equipment-card--active');
    }
    if (activeId === profile.id) {
      card.classList.add('equipment-card--current');
    }
    card.setAttribute('aria-pressed', (!createMode && editingId === profile.id).toString());
    const name = document.createElement('span');
    name.className = 'equipment-card__name';
    name.textContent = profile.nom;

    const metrics = document.createElement('span');
    metrics.className = 'equipment-card__metrics';
    const widthText = formatDegrees(champLargeur);
    const heightText = formatDegrees(champHauteur);
    const samplingText = formatArcseconds(sampling);
    metrics.textContent = `${widthText === '—' || heightText === '—' ? 'Champ indéterminé' : `${widthText}° × ${heightText}°`} • ${
      samplingText === '—' ? '—' : `${samplingText}″/px`
    }`;

    card.appendChild(name);
    if (activeId === profile.id) {
      const badge = document.createElement('span');
      badge.className = 'equipment-card__badge';
      badge.textContent = 'Actif';
      card.appendChild(badge);
    }
    card.appendChild(metrics);

    card.addEventListener('click', () => {
      startEdition(profile.id);
    });

    listContainer.appendChild(card);
  });
}

function setFormMode(mode) {
  if (mode === 'create') {
    createMode = true;
    editingId = null;
    form.dataset.mode = 'create';
    if (formTitle) {
      formTitle.textContent = 'Créer un profil d’équipement';
    }
    if (submitButton) {
      submitButton.textContent = 'Ajouter le profil';
    }
    if (deleteButton) {
      deleteButton.disabled = true;
    }
  } else {
    createMode = false;
    form.dataset.mode = 'edit';
    if (formTitle) {
      formTitle.textContent = 'Modifier le profil';
    }
    if (submitButton) {
      submitButton.textContent = 'Enregistrer les modifications';
    }
    if (deleteButton) {
      deleteButton.disabled = !editingId;
    }
  }
}

function startCreation() {
  setFormMode('create');
  resetFormFields();
  renderList();
  clearStatus();
  if (inputs.nom) {
    inputs.nom.focus();
  }
}

function startEdition(id) {
  const profile = Equipements.getById(id);
  if (!profile) {
    return;
  }
  editingId = profile.id;
  setFormMode('edit');
  fillFormFromProfile(profile);
  renderList();
  clearStatus();
}

function ensureInitialSelection() {
  const profiles = Equipements.list();
  const currentId = Equipements.getCurrentId();
  if (profiles.length === 0) {
    startCreation();
    renderList(profiles, currentId);
    return;
  }
  const initialId = currentId || profiles[0].id;
  startEdition(initialId);
}

function handleSubmit(event) {
  event.preventDefault();
  clearStatus();
  if (typeof form.reportValidity === 'function' && !form.reportValidity()) {
    return;
  }
  const snapshot = getFormSnapshot();
  if (!snapshot.nom) {
    showStatus('Le nom du profil est obligatoire.');
    inputs.nom.focus();
    return;
  }
  if (!Number.isFinite(snapshot.focaleMm) || snapshot.focaleMm <= 0) {
    showStatus('La focale doit être un nombre positif.');
    inputs.focale.focus();
    return;
  }
  if (!Number.isFinite(snapshot.ouvertureMm) || snapshot.ouvertureMm <= 0) {
    showStatus('L’ouverture doit être un nombre positif.');
    inputs.ouverture.focus();
    return;
  }
  if (!Number.isFinite(snapshot.capteur.largeurMm) || snapshot.capteur.largeurMm <= 0) {
    showStatus('Renseigne la largeur du capteur (en mm).');
    inputs.capteurLargeur.focus();
    return;
  }
  if (!Number.isFinite(snapshot.capteur.hauteurMm) || snapshot.capteur.hauteurMm <= 0) {
    showStatus('Renseigne la hauteur du capteur (en mm).');
    inputs.capteurHauteur.focus();
    return;
  }
  if (!Number.isFinite(snapshot.capteur.pixelUm) || snapshot.capteur.pixelUm <= 0) {
    showStatus('La taille de pixel doit être positive.');
    inputs.pixel.focus();
    return;
  }

  const payload = {
    nom: snapshot.nom,
    focaleMm: snapshot.focaleMm,
    ouvertureMm: snapshot.ouvertureMm,
    reducteur: snapshot.reducteur,
    capteur: snapshot.capteur,
    bin: snapshot.bin,
    rotationDeg: snapshot.rotationDeg,
    miroirX: snapshot.miroirX,
    miroirY: snapshot.miroirY
  };

  try {
    if (createMode || !editingId) {
      const created = Equipements.create(payload);
      if (inputs.setActive.checked) {
        Equipements.setCurrent(created.id);
      }
      showStatus('Profil ajouté avec succès.');
      startEdition(created.id);
    } else {
      const updated = Equipements.update(editingId, payload);
      if (!updated) {
        showStatus('Impossible de mettre à jour ce profil.');
        return;
      }
      if (inputs.setActive.checked) {
        Equipements.setCurrent(updated.id);
      }
      showStatus('Modifications enregistrées.');
      startEdition(updated.id);
    }
  } catch (error) {
    console.error('Erreur lors de l’enregistrement du profil :', error);
    showStatus('Enregistrement impossible. Vérifie les valeurs saisies.');
  }
}

function handleDelete() {
  if (!editingId) {
    return;
  }
  const profile = Equipements.getById(editingId);
  const name = profile ? profile.nom : 'ce profil';
  const confirmed = window.confirm(`Supprimer ${name} ? Cette action est définitive.`);
  if (!confirmed) {
    return;
  }
  const removed = Equipements.remove(editingId);
  if (!removed) {
    showStatus('Suppression impossible.');
    return;
  }
  const profiles = Equipements.list();
  const currentId = Equipements.getCurrentId();
  if (profiles.length === 0) {
    startCreation();
    renderList(profiles, currentId);
    showStatus('Profil supprimé. Crée un nouveau profil pour continuer.');
    return;
  }
  const fallbackId = currentId || profiles[0].id;
  showStatus('Profil supprimé.');
  startEdition(fallbackId);
}

if (createButton) {
  createButton.addEventListener('click', () => {
    startCreation();
  });
}

if (form) {
  form.addEventListener('submit', handleSubmit);
}

if (deleteButton) {
  deleteButton.addEventListener('click', handleDelete);
}

if (presetButtons && presetButtons.length > 0) {
  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const presetId = button.dataset.equipmentPreset;
      if (!presetId) {
        return;
      }
      applyPresetProfile(presetId);
    });
  });
}

Object.values(inputs).forEach((input) => {
  if (!input) {
    return;
  }
  if (input instanceof HTMLInputElement && input.type === 'checkbox') {
    input.addEventListener('change', () => {
      if (input !== inputs.setActive) {
        clearStatus();
      }
    });
    return;
  }
  input.addEventListener('input', () => {
    updatePreview();
    clearStatus();
  });
});

Equipements.subscribe(() => {
  const profiles = Equipements.list();
  const currentId = Equipements.getCurrentId();
  renderList(profiles, currentId);
  if (createMode) {
    return;
  }
  if (editingId) {
    const currentProfile = profiles.find((profile) => profile.id === editingId);
    if (currentProfile) {
      fillFormFromProfile(currentProfile);
      return;
    }
  }
  if (profiles.length === 0) {
    startCreation();
    renderList(profiles, currentId);
    return;
  }
  const fallbackId = currentId || profiles[0].id;
  startEdition(fallbackId);
});

ensureInitialSelection();
