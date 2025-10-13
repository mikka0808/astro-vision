# astro-vision

propose ce qui est visible la nuit

## Schéma de données des catalogues

Le fichier `objects.json` décrit désormais une collection de catalogues et leurs objets associés :

```json
{
  "catalogues": [
    {
      "id": "messier",
      "name": "Catalogue Messier",
      "abbreviation": "M",
      "type": "catalogue visuel",
      "description": "110 objets compilés par Charles Messier…",
      "observationWeights": {
        "visual": 1.0,
        "astrophoto": 0.85,
        "research": 0.5
      },
      "defaultSelected": true
    }
  ],
  "objects": [
    {
      "number": 1,
      "name": "M1 - Nébuleuse du Crabe",
      "type": "Reste de supernova",
      "constellation": "Taureau",
      "raHours": 5.575,
      "decDeg": 22.0167,
      "magnitude": 8.4,
      "angularSizeArcmin": null,
      "surfaceBrightness": null,
      "bestMonths": [11, 12, 1, 2],
      "minBortle": 5,
      "description": "Vestige de supernova…",
      "primaryCatalogueId": "messier",
      "catalogueRefs": ["messier"]
    }
  ]
}
```

- Chaque entrée `catalogues` fournit des métadonnées, un acronyme et des pondérations par type d'observation (`visual`, `astrophoto`, `research`).
- Les objets peuvent être associés à plusieurs catalogues via `catalogueRefs`, tout en conservant un catalogue principal (`primaryCatalogueId`).
- Les attributs complémentaires (`angularSizeArcmin`, `surfaceBrightness`, etc.) permettent d'étendre facilement les métadonnées disponibles dans l'application.

## Sources de données externes

- Les objets du catalogue IC sont téléchargés à la demande via le service [SIMBAD TAP](https://simbad.u-strasbg.fr/simbad/sim-tap), en interrogeant uniquement les colonnes essentielles (position, magnitude, type). Cela permet d'intégrer l'ensemble des 5 387 entrées sans charger un fichier massif dans le navigateur.

## Tests

L'application dispose d'un petit ensemble de tests Node.js pour vérifier la cohérence des fonctions de normalisation et de filtrage des catalogues. Pour les exécuter :

```bash
npm test
```

Le moteur de tests intégré (`node --test`) valide notamment que les objets comptabilisés pour un catalogue correspondent bien à ceux affichés lors du filtrage.
