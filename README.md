# Astro-Vision

Interface PWA d'astrophotographie construite avec Vite + React + TypeScript. Cette refonte propose un thème sombre inspiré des nuits claires, optimisé pour iOS (portrait/paysage) et prêt pour un déploiement sur GitHub Pages sous `/astro-vision/`.

## Pourquoi pas de binaires dans cette PR ?

Pour respecter les contraintes de l'environnement automatisé, aucun fichier binaire (PNG, ICO, WOFF, etc.) n'est versionné. L'interface utilise uniquement des ressources textuelles (SVG, CSS, JS). Les icônes nécessaires à la PWA seront générées plus tard à l'aide de `pwa-asset-generator` lorsque vous disposerez d'un environnement local.

## Générer les icônes plus tard

1. `npm install`
2. Vérifiez que votre logo SVG est bien dans `src/assets/logo.svg` (déjà fourni dans cette refonte).
3. `npm run gen:icons` — génère les PNG dans `public/icons/*.png` et injecte les références dans `public/manifest.webmanifest` ainsi que dans `public/index.html`.
4. Commitez manuellement les PNG générés (hors Codex) ou uploadez-les via l'interface GitHub.

## PWA & iOS

- Par défaut aucune icône n'est incluse afin d'éviter les binaires. Après génération locale, ajoutez manuellement `icon-192.png`, `icon-512.png` et `ios-180.png` dans `public/icons/` puis référencez-les dans `public/manifest.webmanifest` et réactivez la balise `<link rel="apple-touch-icon">` déjà commentée dans `public/index.html`.
- Le fichier `vite.config.ts` définit `base = "/astro-vision/"` pour que les assets soient servis correctement sur GitHub Pages.
- Les métas `viewport-fit=cover` et les classes utilitaires `safe-pt`, `safe-pb`, `safe-px` garantissent une expérience stable sur iPhone en portrait comme en paysage.

## Développement

```bash
npm install
npm run dev
```

## Build & déploiement

```bash
npm run build
npm run deploy
```

Le déploiement publie le dossier `dist` sur la branche `gh-pages` pour une mise en ligne automatique sous `https://<utilisateur>.github.io/astro-vision/`.
