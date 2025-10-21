import { readStorage, writeStorage } from '../utils/storage.js';

export interface Capteur {
  largeurMm: number;
  hauteurMm: number;
  pixelUm: number;
}

export interface ProfilEquipement {
  id: string;
  nom: string;
  focaleMm: number;
  ouvertureMm: number;
  reducteur: number | null;
  capteur: Capteur;
  bin: number;
  rotationDeg: number;
  miroirX: boolean;
  miroirY: boolean;
}

type ProfilBrut = Partial<ProfilEquipement> & { capteur?: Partial<Capteur> | null };

type EquipementSubscriber = () => void;

type EquipementState = {
  profils: ProfilEquipement[];
  currentId: string | null;
};

const STORAGE_KEY = 'astro:equipement';

const DEFAULT_PROFILES: readonly ProfilEquipement[] = [
  {
    id: 'apo-80-384',
    nom: 'Lunette APO 80/480 + réducteur 0,8×',
    focaleMm: 480,
    ouvertureMm: 80,
    reducteur: 0.8,
    capteur: { largeurMm: 17.7, hauteurMm: 13.4, pixelUm: 3.8 },
    bin: 1,
    rotationDeg: 0,
    miroirX: false,
    miroirY: false
  },
  {
    id: 'objectif-135-apn',
    nom: 'APN plein format + objectif 135 mm',
    focaleMm: 135,
    ouvertureMm: 67,
    reducteur: null,
    capteur: { largeurMm: 36, hauteurMm: 24, pixelUm: 5.3 },
    bin: 1,
    rotationDeg: 0,
    miroirX: false,
    miroirY: false
  },
  {
    id: 'newton-200-cmos',
    nom: 'Newton 200/1000 + caméra APS-C',
    focaleMm: 1000,
    ouvertureMm: 200,
    reducteur: null,
    capteur: { largeurMm: 23.5, hauteurMm: 15.7, pixelUm: 3.76 },
    bin: 1,
    rotationDeg: 0,
    miroirX: false,
    miroirY: false
  }
];

const subscribers = new Set<EquipementSubscriber>();

function ensureId(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function ensureName(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }
  return fallback;
}

function ensurePositiveNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  return numeric;
}

function ensureOptionalPositive(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }
  return numeric;
}

function ensurePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return fallback;
  }
  const rounded = Math.round(numeric);
  return rounded > 0 ? rounded : fallback;
}

function ensureFiniteNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function ensureBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'oui') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'non') {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return value !== 0;
  }
  return Boolean(value);
}

function normalizeCapteur(value: unknown): Capteur | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const raw = value as Partial<Capteur>;
  const largeurMm = ensurePositiveNumber(raw.largeurMm);
  const hauteurMm = ensurePositiveNumber(raw.hauteurMm);
  const pixelUm = ensurePositiveNumber(raw.pixelUm);
  if (!largeurMm || !hauteurMm || !pixelUm) {
    return null;
  }
  return { largeurMm, hauteurMm, pixelUm };
}

function cloneProfile(profile: ProfilEquipement): ProfilEquipement {
  return {
    ...profile,
    capteur: { ...profile.capteur }
  };
}

function normalizeProfile(raw: ProfilBrut | null | undefined): ProfilEquipement | null {
  if (!raw) {
    return null;
  }
  const id = ensureId(raw.id);
  if (!id) {
    return null;
  }
  const nom = ensureName(raw.nom, 'Profil sans titre');
  const focaleMm = ensurePositiveNumber(raw.focaleMm);
  const ouvertureMm = ensurePositiveNumber(raw.ouvertureMm);
  const capteur = normalizeCapteur(raw.capteur);
  if (!focaleMm || !ouvertureMm || !capteur) {
    return null;
  }
  const reducteur = ensureOptionalPositive(raw.reducteur);
  const bin = ensurePositiveInteger(raw.bin ?? 1, 1);
  const rotationDeg = ensureFiniteNumber(raw.rotationDeg, 0);
  const miroirX = ensureBoolean(raw.miroirX, false);
  const miroirY = ensureBoolean(raw.miroirY, false);
  return {
    id,
    nom,
    focaleMm,
    ouvertureMm,
    reducteur,
    capteur,
    bin,
    rotationDeg,
    miroirX,
    miroirY
  };
}

function sortProfiles(profils: ProfilEquipement[]): ProfilEquipement[] {
  return [...profils].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' }));
}

function generateProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `equip-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function getDefaultProfiles(): ProfilEquipement[] {
  return DEFAULT_PROFILES.map((profile) => cloneProfile(profile));
}

function loadState(): EquipementState {
  const stored = readStorage<{ profils?: unknown; currentId?: unknown }>(STORAGE_KEY, { fallback: null });
  const storedProfiles = Array.isArray(stored?.profils)
    ? (stored!.profils as unknown[])
        .map((entry: unknown) => normalizeProfile(entry as ProfilBrut))
        .filter((value): value is ProfilEquipement => value !== null)
    : [];
  const profils = storedProfiles.length > 0 ? sortProfiles(storedProfiles) : getDefaultProfiles();
  const currentIdRaw = ensureId(stored?.currentId);
  const currentId = currentIdRaw && profils.some((profile) => profile.id === currentIdRaw)
    ? currentIdRaw
    : profils.length > 0
      ? profils[0].id
      : null;
  return { profils, currentId };
}

function persistState() {
  writeStorage(STORAGE_KEY, {
    profils: state.profils,
    currentId: state.currentId
  });
}

function notifySubscribers() {
  subscribers.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error('Erreur dans un écouteur de profils d\'équipement :', error);
    }
  });
}

const state: EquipementState = loadState();

function setProfiles(profils: ProfilEquipement[]) {
  state.profils = sortProfiles(profils);
  if (state.currentId && !state.profils.some((profile) => profile.id === state.currentId)) {
    state.currentId = state.profils.length > 0 ? state.profils[0].id : null;
  }
  persistState();
  notifySubscribers();
}

function setCurrentProfileId(profileId: string | null) {
  const normalized = ensureId(profileId ?? undefined);
  if (normalized && !state.profils.some((profile) => profile.id === normalized)) {
    return;
  }
  const nextId = normalized ?? (state.profils.length > 0 ? state.profils[0].id : null);
  if (state.currentId === nextId) {
    return;
  }
  state.currentId = nextId;
  persistState();
  notifySubscribers();
}

export type ProfilInput = Omit<ProfilEquipement, 'id'> & { id?: string };

export const Equipements = {
  list(): ProfilEquipement[] {
    return state.profils.map((profile) => cloneProfile(profile));
  },
  getById(id: string | null | undefined): ProfilEquipement | null {
    const normalized = ensureId(id);
    if (!normalized) {
      return null;
    }
    const profile = state.profils.find((entry) => entry.id === normalized);
    return profile ? cloneProfile(profile) : null;
  },
  getCurrent(): ProfilEquipement | null {
    if (!state.currentId) {
      return null;
    }
    return this.getById(state.currentId);
  },
  getCurrentId(): string | null {
    return state.currentId ?? null;
  },
  setCurrent(id: string | null | undefined): void {
    setCurrentProfileId(id ?? null);
  },
  create(input: ProfilInput): ProfilEquipement {
    const id = ensureId(input.id) ?? generateProfileId();
    const profile = normalizeProfile({ ...input, id });
    if (!profile) {
      throw new Error('Profil d\'équipement invalide.');
    }
    setProfiles([...state.profils, profile]);
    return cloneProfile(profile);
  },
  update(id: string, updates: Partial<ProfilInput>): ProfilEquipement | null {
    const normalized = ensureId(id);
    if (!normalized) {
      return null;
    }
    const index = state.profils.findIndex((profile) => profile.id === normalized);
    if (index === -1) {
      return null;
    }
    const merged: ProfilBrut = { ...state.profils[index], ...updates, id: normalized };
    const profile = normalizeProfile(merged);
    if (!profile) {
      return null;
    }
    const nextProfiles = [...state.profils];
    nextProfiles.splice(index, 1, profile);
    setProfiles(nextProfiles);
    return cloneProfile(profile);
  },
  remove(id: string): boolean {
    const normalized = ensureId(id);
    if (!normalized) {
      return false;
    }
    const nextProfiles = state.profils.filter((profile) => profile.id !== normalized);
    if (nextProfiles.length === state.profils.length) {
      return false;
    }
    setProfiles(nextProfiles);
    return true;
  },
  subscribe(listener: EquipementSubscriber): () => void {
    if (typeof listener !== 'function') {
      return () => undefined;
    }
    subscribers.add(listener);
    return () => {
      subscribers.delete(listener);
    };
  }
};
