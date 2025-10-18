import { NIGHT_MODE_STORAGE_KEY } from './astro-core.js';

const nightModeToggle = document.getElementById('nightModeToggle');
const canvas = document.getElementById('starMapCanvas');
const canvasContainer = document.getElementById('starMapCanvasContainer');
const tooltip = document.getElementById('starMapTooltip');
const rotationInput = document.getElementById('starMapRotation');
const rotationValue = document.getElementById('starMapRotationValue');
const resetButton = document.getElementById('starMapReset');
const constellationsToggle = document.getElementById('starMapConstellations');
const milkyWayToggle = document.getElementById('starMapMilkyWay');
const legendList = document.getElementById('constellationLegend');
const detailsPanel = document.getElementById('starMapDetails');
const autoRotateButton = document.getElementById('starMapAutoRotate');
const centerButton = document.getElementById('starMapCenterSelection');
const fullscreenButton = document.getElementById('starMapFullscreen');

if (!canvas || !canvasContainer || !rotationInput || !rotationValue || !legendList || !detailsPanel) {
  console.warn('Carte du ciel : éléments requis introuvables.');
}

const STAR_CATALOG = [
  {
    name: 'Polaris',
    designation: 'α UMi',
    constellation: 'UMi',
    rightAscension: 2.5303,
    declination: 89.2641,
    magnitude: 1.97,
    spectralType: 'F7',
    distance: 447,
    description: 'Étoile polaire actuelle, située presque exactement dans l’axe de rotation terrestre.',
    observation: 'Repère indispensable pour la mise en station d’une monture équatoriale et le cadrage nord.'
  },
  {
    name: 'Dubhe',
    designation: 'α UMa',
    constellation: 'UMa',
    rightAscension: 11.0621,
    declination: 61.7508,
    magnitude: 1.79,
    spectralType: 'K0',
    distance: 123,
    description: 'Étoile orangée marquant le coin supérieur de la Grande Ourse.',
    observation: 'Aligne Dubhe avec Merak pour pointer précisément la Polaire.'
  },
  {
    name: 'Merak',
    designation: 'β UMa',
    constellation: 'UMa',
    rightAscension: 11.0307,
    declination: 56.3824,
    magnitude: 2.37,
    spectralType: 'A1',
    distance: 80,
    description: 'Étoile blanche de la Grande Ourse formant avec Dubhe le repère pour trouver la Polaire.',
    observation: 'La ligne Dubhe → Merak multipliée cinq fois mène directement à Polaris.'
  },
  {
    name: 'Phecda',
    designation: 'γ UMa',
    constellation: 'UMa',
    rightAscension: 11.8987,
    declination: 53.6948,
    magnitude: 2.43,
    spectralType: 'A0',
    distance: 83,
    description: 'Étoile blanche marquant la cuve de la Grande Ourse.',
    observation: 'Servez-vous du trapèze formé par Phecda pour cadrer les galaxies M81/M82.'
  },
  {
    name: 'Megrez',
    designation: 'δ UMa',
    constellation: 'UMa',
    rightAscension: 12.257,
    declination: 57.0326,
    magnitude: 3.31,
    spectralType: 'A3',
    distance: 80,
    description: 'Étoile la plus discrète du chariot mais pivot des segments vers la queue.',
    observation: 'Permet de suivre la courbure menant à Mizar et Alkaid.'
  },
  {
    name: 'Alioth',
    designation: 'ε UMa',
    constellation: 'UMa',
    rightAscension: 12.9005,
    declination: 55.9598,
    magnitude: 1.77,
    spectralType: 'A0',
    distance: 82,
    description: 'Étoile la plus brillante du chariot, visible toute l’année sous nos latitudes.',
    observation: 'Bon point d’ancrage pour balayer la région des galaxies du Bouvier.'
  },
  {
    name: 'Mizar',
    designation: 'ζ UMa',
    constellation: 'UMa',
    rightAscension: 13.3987,
    declination: 54.9253,
    magnitude: 2.23,
    spectralType: 'A2',
    distance: 86,
    description: 'Étoile double emblématique, facilement résolue aux jumelles avec Alcor.',
    observation: 'Test de pouvoir séparateur classique pour un instrument bien collimaté.'
  },
  {
    name: 'Alkaid',
    designation: 'η UMa',
    constellation: 'UMa',
    rightAscension: 13.7923,
    declination: 49.3133,
    magnitude: 1.85,
    spectralType: 'B3',
    distance: 104,
    description: 'Dernière étoile de la queue de la Grande Ourse, bleutée et énergique.',
    observation: 'Dirige ton regard vers le quadrilatère du Bouvier depuis Alkaid pour trouver Arcturus.'
  },
  {
    name: 'Kochab',
    designation: 'β UMi',
    constellation: 'UMi',
    rightAscension: 14.8451,
    declination: 74.1555,
    magnitude: 2.08,
    spectralType: 'K4',
    distance: 131,
    description: 'L’une des deux gardiennes du pôle entourant Polaris.',
    observation: 'Aligne Kochab avec Pherkad pour visualiser le petit chariot.'
  },
  {
    name: 'Pherkad',
    designation: 'γ UMi',
    constellation: 'UMi',
    rightAscension: 15.3455,
    declination: 71.8339,
    magnitude: 3.05,
    spectralType: 'A3',
    distance: 487,
    description: 'Étoile bleutée complétant la poignée du Petit Chariot.',
    observation: 'Forme avec Kochab un axe pratique pour vérifier la mise en station.'
  },
  {
    name: 'Vega',
    designation: 'α Lyr',
    constellation: 'Lyr',
    rightAscension: 18.6156,
    declination: 38.7837,
    magnitude: 0.03,
    spectralType: 'A0',
    distance: 25,
    description: 'Astre phare du ciel d’été, proche du zénith sous nos latitudes.',
    observation: 'Point de départ idéal pour repérer la Lyre et la nébuleuse annulaire M57.'
  },
  {
    name: 'Sheliak',
    designation: 'β Lyr',
    constellation: 'Lyr',
    rightAscension: 18.8346,
    declination: 33.3627,
    magnitude: 3.45,
    spectralType: 'B7',
    distance: 960,
    description: 'Binaire à éclipses représentant la base de la Lyre.',
    observation: 'Observe ses variations de luminosité sur plusieurs nuits claires.'
  },
  {
    name: 'Sulafat',
    designation: 'γ Lyr',
    constellation: 'Lyr',
    rightAscension: 18.9826,
    declination: 32.6896,
    magnitude: 3.25,
    spectralType: 'B9',
    distance: 620,
    description: 'Étoile bleue formant l’angle opposé à Vega dans la Lyre.',
    observation: 'Centre-toi entre Sulafat et Sheliak pour viser M57.'
  },
  {
    name: 'Deneb',
    designation: 'α Cyg',
    constellation: 'Cyg',
    rightAscension: 20.6905,
    declination: 45.2803,
    magnitude: 1.25,
    spectralType: 'A2',
    distance: 2616,
    description: 'Supergéante blanche marquant la queue du Cygne.',
    observation: 'Encadre Deneb avec Sadr et Gienah pour suivre la grande croix du Cygne.'
  },
  {
    name: 'Sadr',
    designation: 'γ Cyg',
    constellation: 'Cyg',
    rightAscension: 20.3705,
    declination: 40.2567,
    magnitude: 2.23,
    spectralType: 'F8',
    distance: 1830,
    description: 'Cœur de la constellation du Cygne baignant dans la Voie lactée.',
    observation: 'Balaye autour de Sadr pour révéler IC 1318 et les nébulosités de Gamma Cygni.'
  },
  {
    name: 'Gienah',
    designation: 'ε Cyg',
    constellation: 'Cyg',
    rightAscension: 20.77,
    declination: 33.9703,
    magnitude: 2.48,
    spectralType: 'B9',
    distance: 72,
    description: 'Aile occidentale du Cygne, étoile double accessible.',
    observation: 'Parfaite pour tester la résolution d’une petite lunette.'
  },
  {
    name: 'Albireo',
    designation: 'β Cyg',
    constellation: 'Cyg',
    rightAscension: 19.512,
    declination: 27.9597,
    magnitude: 3.08,
    spectralType: 'K3 + B8',
    distance: 430,
    description: 'Étoile double célèbre pour son contraste orange/bleu.',
    observation: 'Augmente légèrement le grossissement pour séparer les deux composantes chatoyantes.'
  },
  {
    name: 'Altair',
    designation: 'α Aql',
    constellation: 'Aql',
    rightAscension: 19.8464,
    declination: 8.8683,
    magnitude: 0.77,
    spectralType: 'A7',
    distance: 17,
    description: 'Étoile brillante du Triangle d’été, très rapide en rotation.',
    observation: 'Trace la ligne Altair–Vega pour rejoindre le zénith en été.'
  },
  {
    name: 'Tarazed',
    designation: 'γ Aql',
    constellation: 'Aql',
    rightAscension: 19.7705,
    declination: 10.6132,
    magnitude: 2.72,
    spectralType: 'K3',
    distance: 395,
    description: 'Géante orangée voisinant Altair dans Aquila.',
    observation: 'Offre un joli contraste de couleur avec Altair et Alshain.'
  },
  {
    name: 'Alshain',
    designation: 'β Aql',
    constellation: 'Aql',
    rightAscension: 19.9219,
    declination: 6.4068,
    magnitude: 3.71,
    spectralType: 'G8',
    distance: 45,
    description: 'Compagne plus discrète d’Altair, étoile double accessible.',
    observation: 'Un grossissement modéré révèle la compagne Alshain B.'
  },
  {
    name: 'Betelgeuse',
    designation: 'α Ori',
    constellation: 'Ori',
    rightAscension: 5.9195,
    declination: 7.407,
    magnitude: 0.5,
    spectralType: 'M1',
    distance: 548,
    description: 'Supergéante rouge en fin de vie, très variable.',
    observation: 'Comparatif de luminosité avec Rigel pour suivre ses variations.'
  },
  {
    name: 'Bellatrix',
    designation: 'γ Ori',
    constellation: 'Ori',
    rightAscension: 5.4188,
    declination: 6.3497,
    magnitude: 1.64,
    spectralType: 'B2',
    distance: 252,
    description: 'Guerrière brillante marquant l’épaule droite d’Orion.',
    observation: 'Servez-vous de Bellatrix pour cadrer la boucle de Barnard.'
  },
  {
    name: 'Mintaka',
    designation: 'δ Ori',
    constellation: 'Ori',
    rightAscension: 5.5334,
    declination: -0.2991,
    magnitude: 2.25,
    spectralType: 'O9',
    distance: 1200,
    description: 'Étoile occidentale de la ceinture d’Orion, double serrée.',
    observation: 'Bon test de turbulence : la composante secondaire devient visible par nuit stable.'
  },
  {
    name: 'Alnilam',
    designation: 'ε Ori',
    constellation: 'Ori',
    rightAscension: 5.6036,
    declination: -1.2019,
    magnitude: 1.69,
    spectralType: 'B0',
    distance: 1342,
    description: 'Étoile centrale de la ceinture d’Orion, entourée de poussières.',
    observation: 'Viser Alnilam en photo révèle la nébuleuse de la Tête de Cheval à proximité.'
  },
  {
    name: 'Alnitak',
    designation: 'ζ Ori',
    constellation: 'Ori',
    rightAscension: 5.6793,
    declination: -1.9426,
    magnitude: 1.74,
    spectralType: 'O9',
    distance: 817,
    description: 'Étoile orientale de la ceinture, triple spectaculaire.',
    observation: 'Centre la flamme d’Orion (NGC 2024) à quelques minutes d’arc vers l’est.'
  },
  {
    name: 'Rigel',
    designation: 'β Ori',
    constellation: 'Ori',
    rightAscension: 5.2423,
    declination: -8.2016,
    magnitude: 0.18,
    spectralType: 'B8',
    distance: 863,
    description: 'Supergéante bleue dominant l’hémisphère sud hivernal.',
    observation: 'Pousse le grossissement pour séparer la compagne Rigel B.'
  },
  {
    name: 'Saiph',
    designation: 'κ Ori',
    constellation: 'Ori',
    rightAscension: 5.7959,
    declination: -9.6696,
    magnitude: 2.06,
    spectralType: 'B0',
    distance: 650,
    description: 'Coin sud-est d’Orion, marque la limite de la boucle d’Orion.',
    observation: 'Repère pour encadrer la nébuleuse de la Rosette plus à l’est.'
  },
  {
    name: 'Sirius',
    designation: 'α CMa',
    constellation: 'CMa',
    rightAscension: 6.7525,
    declination: -16.7161,
    magnitude: -1.46,
    spectralType: 'A1',
    distance: 8.6,
    description: 'Étoile la plus brillante du ciel nocturne, visible même en ville.',
    observation: 'Attends qu’elle culmine pour tenter d’apercevoir sa naine blanche compagne.'
  },
  {
    name: 'Adhara',
    designation: 'ε CMa',
    constellation: 'CMa',
    rightAscension: 6.9771,
    declination: -28.9721,
    magnitude: 1.5,
    spectralType: 'B2',
    distance: 430,
    description: 'Deuxième étoile de la constellation du Grand Chien.',
    observation: 'Constitue avec Wezen un triangle pointant vers M41.'
  },
  {
    name: 'Wezen',
    designation: 'δ CMa',
    constellation: 'CMa',
    rightAscension: 7.1399,
    declination: -26.3932,
    magnitude: 1.82,
    spectralType: 'F8',
    distance: 1600,
    description: 'Supergéante jaune marquant le centre du Grand Chien.',
    observation: 'Base idéale pour localiser la nébuleuse de la Rosette en remontant vers Monoceros.'
  },
  {
    name: 'Procyon',
    designation: 'α CMi',
    constellation: 'CMi',
    rightAscension: 7.655,
    declination: 5.225,
    magnitude: 0.38,
    spectralType: 'F5',
    distance: 11.5,
    description: 'Une des composantes du Triangle d’hiver, proche de la Terre.',
    observation: 'Combine Procyon avec Sirius et Betelgeuse pour dessiner le triangle hivernal.'
  },
  {
    name: 'Capella',
    designation: 'α Aur',
    constellation: 'Aur',
    rightAscension: 5.2782,
    declination: 46.0,
    magnitude: 0.08,
    spectralType: 'G3',
    distance: 42,
    description: 'Système quadruple dominant l’hiver boréal.',
    observation: 'Utilise Capella pour t’orienter vers l’amas des Hyades.'
  },
  {
    name: 'Aldebaran',
    designation: 'α Tau',
    constellation: 'Tau',
    rightAscension: 4.5987,
    declination: 16.5092,
    magnitude: 0.87,
    spectralType: 'K5',
    distance: 65,
    description: 'Géante orangée traversant l’amas ouvert des Hyades.',
    observation: 'Filtre UHC déconseillé : privilégie un oculaire grand champ pour les Hyades.'
  },
  {
    name: 'Elnath',
    designation: 'β Tau',
    constellation: 'Tau',
    rightAscension: 5.4382,
    declination: 28.6074,
    magnitude: 1.65,
    spectralType: 'B7',
    distance: 134,
    description: 'Étoile bleutée à la frontière du Cocher et du Taureau.',
    observation: 'Aide à tracer la corne nord du Taureau vers la nébuleuse du Crabe.'
  },
  {
    name: 'Castor',
    designation: 'α Gem',
    constellation: 'Gem',
    rightAscension: 7.5767,
    declination: 31.8883,
    magnitude: 1.6,
    spectralType: 'A1',
    distance: 52,
    description: 'Sextuple système stellaire facilement dédoublable.',
    observation: 'Grossissement moyen pour séparer les composantes A et B.'
  },
  {
    name: 'Pollux',
    designation: 'β Gem',
    constellation: 'Gem',
    rightAscension: 7.7553,
    declination: 28.0262,
    magnitude: 1.14,
    spectralType: 'K0',
    distance: 34,
    description: 'Géante orangée abritant une exoplanète confirmée.',
    observation: 'Une paire parfaite avec Castor pour débuter les repérages hivernaux.'
  },
  {
    name: 'Regulus',
    designation: 'α Leo',
    constellation: 'Leo',
    rightAscension: 10.1395,
    declination: 11.9672,
    magnitude: 1.35,
    spectralType: 'B7',
    distance: 79,
    description: 'Étoile principale du Lion alignée avec le Sphinx céleste.',
    observation: 'Utilise Regulus pour balayer la chaîne de galaxies de l’arrière du Lion.'
  },
  {
    name: 'Algieba',
    designation: 'γ Leo',
    constellation: 'Leo',
    rightAscension: 10.3329,
    declination: 19.8416,
    magnitude: 2.01,
    spectralType: 'K1',
    distance: 130,
    description: 'Magnifique double dorée dans la crinière du Lion.',
    observation: 'Sépare les composantes avec un grossissement supérieur à 120×.'
  },
  {
    name: 'Denebola',
    designation: 'β Leo',
    constellation: 'Leo',
    rightAscension: 11.8177,
    declination: 14.5719,
    magnitude: 2.14,
    spectralType: 'A3',
    distance: 36,
    description: 'Queue du Lion, marque l’accès au Champ de Coma.',
    observation: 'Prolonge la ligne Zosma–Denebola pour atteindre l’amas de la Chevelure.'
  },
  {
    name: 'Arcturus',
    designation: 'α Boo',
    constellation: 'Boo',
    rightAscension: 14.261,
    declination: 19.1825,
    magnitude: -0.05,
    spectralType: 'K1',
    distance: 36,
    description: 'Géante orangée visible en fin de printemps, se lève après la Grande Ourse.',
    observation: 'Prolonge la courbure de la queue de la Grande Ourse pour atteindre Arcturus.'
  },
  {
    name: 'Spica',
    designation: 'α Vir',
    constellation: 'Vir',
    rightAscension: 13.4199,
    declination: -11.1614,
    magnitude: 0.98,
    spectralType: 'B1',
    distance: 250,
    description: 'Binaire spectroscopique bleu-blanc marquant la Vierge.',
    observation: 'Trace Arcturus → Spica pour localiser la Vierge et ses galaxies.'
  },
  {
    name: 'Antares',
    designation: 'α Sco',
    constellation: 'Sco',
    rightAscension: 16.4901,
    declination: -26.4319,
    magnitude: 1.06,
    spectralType: 'M1',
    distance: 555,
    description: 'Supergéante rouge flamboyante au cœur du Scorpion.',
    observation: 'Compare sa teinte rouge à celle de Mars lors des oppositions.'
  },
  {
    name: 'Shaula',
    designation: 'λ Sco',
    constellation: 'Sco',
    rightAscension: 17.5601,
    declination: -37.1038,
    magnitude: 1.62,
    spectralType: 'B2',
    distance: 570,
    description: 'Étoile bleutée marquant le dard du Scorpion.',
    observation: 'Cadre la région pour révéler l’amas ouvert M7.'
  },
  {
    name: 'Sargas',
    designation: 'θ Sco',
    constellation: 'Sco',
    rightAscension: 17.6219,
    declination: -42.9978,
    magnitude: 1.86,
    spectralType: 'F0',
    distance: 270,
    description: 'Supergéante jaune du Scorpion austral.',
    observation: 'Accueille les nébulosités de la région de la queue du Scorpion.'
  },
  {
    name: 'Fomalhaut',
    designation: 'α PsA',
    constellation: 'PsA',
    rightAscension: 22.9608,
    declination: -29.6222,
    magnitude: 1.16,
    spectralType: 'A4',
    distance: 25,
    description: 'Étoile solitaire de l’automne, hôte d’un disque protoplanétaire.',
    observation: 'Choisis un horizon dégagé vers le sud pour la saisir.'
  },
  {
    name: 'Achernar',
    designation: 'α Eri',
    constellation: 'Eri',
    rightAscension: 1.6286,
    declination: -57.2368,
    magnitude: 0.46,
    spectralType: 'B6',
    distance: 139,
    description: 'Étoile aplatie très rapide, visible près de l’horizon sud.',
    observation: 'Observation difficile depuis la France métropolitaine : privilégie les nuits sans turbulence.'
  },
  {
    name: 'Canopus',
    designation: 'α Car',
    constellation: 'Car',
    rightAscension: 6.3992,
    declination: -52.6957,
    magnitude: -0.62,
    spectralType: 'F0',
    distance: 310,
    description: 'Deuxième étoile la plus brillante du ciel, réservée aux latitudes méridionales.',
    observation: 'Accessible depuis le sud de l’Europe lors de conditions exceptionnelles.'
  }
];

const CONSTELLATIONS = [
  {
    id: 'uma',
    name: 'Grande Ourse',
    abbreviation: 'UMa',
    description: 'Asterisme du « grand chariot », point de départ de nombreuses recherches nocturnes.',
    bestSeason: 'Printemps et nuits circumpolaires',
    observation: 'Prolonge la queue vers Arcturus puis Spica pour balayer le ciel de printemps.',
    notableStars: ['Dubhe', 'Merak', 'Alioth', 'Mizar', 'Alkaid'],
    segments: [
      ['Dubhe', 'Merak'],
      ['Merak', 'Phecda'],
      ['Phecda', 'Megrez'],
      ['Megrez', 'Alioth'],
      ['Alioth', 'Mizar'],
      ['Mizar', 'Alkaid'],
      ['Dubhe', 'Megrez'],
      ['Merak', 'Dubhe']
    ],
    anchor: { rightAscension: 11.3, declination: 57.5 }
  },
  {
    id: 'umi',
    name: 'Petite Ourse',
    abbreviation: 'UMi',
    description: 'Petit chariot tournant autour du pôle nord céleste.',
    bestSeason: 'Toute l’année dans l’hémisphère nord',
    observation: 'Serre la base Polaris–Kochab pour vérifier la dérive polaire.',
    notableStars: ['Polaris', 'Kochab', 'Pherkad'],
    segments: [
      ['Polaris', 'Pherkad'],
      ['Pherkad', 'Kochab'],
      ['Kochab', 'Polaris']
    ],
    anchor: { rightAscension: 15.0, declination: 80.0 }
  },
  {
    id: 'lyr',
    name: 'Lyre',
    abbreviation: 'Lyr',
    description: 'Petite constellation estivale abritant la nébuleuse annulaire M57.',
    bestSeason: 'Été',
    observation: 'Balaye la zone entre Sulafat et Sheliak pour faire ressortir la nébuleuse M57.',
    notableStars: ['Vega', 'Sheliak', 'Sulafat'],
    segments: [
      ['Vega', 'Sheliak'],
      ['Sheliak', 'Sulafat'],
      ['Sulafat', 'Vega']
    ],
    anchor: { rightAscension: 18.8, declination: 36.0 }
  },
  {
    id: 'cyg',
    name: 'Cygne',
    abbreviation: 'Cyg',
    description: 'Grande croix traversant la Voie lactée et reliant Deneb à Albireo.',
    bestSeason: 'Été et début d’automne',
    observation: 'Suis l’axe Deneb → Albireo pour explorer les nébuloses du Cygne.',
    notableStars: ['Deneb', 'Sadr', 'Gienah', 'Albireo'],
    segments: [
      ['Deneb', 'Sadr'],
      ['Sadr', 'Gienah'],
      ['Sadr', 'Albireo'],
      ['Albireo', 'Deneb']
    ],
    anchor: { rightAscension: 20.3, declination: 39.0 }
  },
  {
    id: 'aql',
    name: 'Aigle',
    abbreviation: 'Aql',
    description: 'Constellation marquant l’axe sud du Triangle d’été.',
    bestSeason: 'Été',
    observation: 'Triangle Altair–Tarazed–Alshain pour repérer rapidement l’Aigle.',
    notableStars: ['Altair', 'Tarazed', 'Alshain'],
    segments: [
      ['Altair', 'Tarazed'],
      ['Tarazed', 'Alshain'],
      ['Alshain', 'Altair']
    ],
    anchor: { rightAscension: 19.9, declination: 9.0 }
  },
  {
    id: 'ori',
    name: 'Orion',
    abbreviation: 'Ori',
    description: 'Constellation hivernale emblématique, riche en nébuleuses.',
    bestSeason: 'Hiver',
    observation: 'Aligne la ceinture vers le sud-est pour atteindre Sirius et M42.',
    notableStars: ['Betelgeuse', 'Rigel', 'Alnitak', 'Alnilam', 'Mintaka'],
    segments: [
      ['Betelgeuse', 'Bellatrix'],
      ['Bellatrix', 'Mintaka'],
      ['Mintaka', 'Alnilam'],
      ['Alnilam', 'Alnitak'],
      ['Alnitak', 'Rigel'],
      ['Rigel', 'Saiph'],
      ['Saiph', 'Betelgeuse']
    ],
    anchor: { rightAscension: 5.7, declination: -1.0 }
  },
  {
    id: 'cma',
    name: 'Grand Chien',
    abbreviation: 'CMa',
    description: 'Berceau de Sirius, l’étoile la plus brillante de la nuit.',
    bestSeason: 'Hiver',
    observation: 'Sirius culmine bas sur l’horizon sud : privilégie les nuits sans turbulence.',
    notableStars: ['Sirius', 'Adhara', 'Wezen'],
    segments: [
      ['Sirius', 'Adhara'],
      ['Adhara', 'Wezen'],
      ['Wezen', 'Sirius']
    ],
    anchor: { rightAscension: 6.9, declination: -22.0 }
  },
  {
    id: 'tau',
    name: 'Taureau',
    abbreviation: 'Tau',
    description: 'Constellation zodiacale abritant les Hyades et le célèbre amas des Pléiades.',
    bestSeason: 'Fin d’automne et hiver',
    observation: 'Trace Aldebaran → Elnath pour suivre les cornes et viser M1.',
    notableStars: ['Aldebaran', 'Elnath'],
    segments: [
      ['Aldebaran', 'Elnath'],
      ['Aldebaran', 'Capella']
    ],
    anchor: { rightAscension: 4.8, declination: 18.0 }
  },
  {
    id: 'leo',
    name: 'Lion',
    abbreviation: 'Leo',
    description: 'Signe de printemps, idéal pour la chasse aux galaxies.',
    bestSeason: 'Mars à mai',
    observation: 'Utilise le Sphinx (faucille) pour te repérer dans le ciel printanier.',
    notableStars: ['Regulus', 'Algieba', 'Denebola'],
    segments: [
      ['Regulus', 'Algieba'],
      ['Algieba', 'Denebola']
    ],
    anchor: { rightAscension: 10.8, declination: 18.0 }
  },
  {
    id: 'sco',
    name: 'Scorpion',
    abbreviation: 'Sco',
    description: 'Constellation spectaculaire des nuits estivales méridionales.',
    bestSeason: 'Été',
    observation: 'Repère Antares et déroule le dard vers Shaula pour atteindre M6 et M7.',
    notableStars: ['Antares', 'Shaula', 'Sargas'],
    segments: [
      ['Antares', 'Shaula'],
      ['Shaula', 'Sargas']
    ],
    anchor: { rightAscension: 17.2, declination: -32.0 }
  }
];

const MILKY_WAY_NODES = [
  { rightAscension: 17.6, declination: -33, width: 0.24 },
  { rightAscension: 18.9, declination: -12, width: 0.2 },
  { rightAscension: 20.2, declination: 12, width: 0.18 },
  { rightAscension: 21.3, declination: 40, width: 0.16 },
  { rightAscension: 0.5, declination: 25, width: 0.15 },
  { rightAscension: 2.5, declination: 5, width: 0.16 },
  { rightAscension: 5.2, declination: -5, width: 0.18 },
  { rightAscension: 6.8, declination: -20, width: 0.22 },
  { rightAscension: 8.5, declination: -30, width: 0.2 },
  { rightAscension: 10.7, declination: -18, width: 0.18 },
  { rightAscension: 13.0, declination: -5, width: 0.16 },
  { rightAscension: 15.2, declination: -15, width: 0.2 }
];

const SPECTRAL_COLOR_MAP = new Map([
  ['O', '#87b7ff'],
  ['B', '#9cc5ff'],
  ['A', '#d6e8ff'],
  ['F', '#f8f1d9'],
  ['G', '#ffe9b3'],
  ['K', '#ffd1a3'],
  ['M', '#ffb48a']
]);

const LABELLED_STARS = new Set([
  'Polaris',
  'Vega',
  'Deneb',
  'Altair',
  'Betelgeuse',
  'Rigel',
  'Sirius',
  'Procyon',
  'Aldebaran',
  'Capella',
  'Arcturus',
  'Spica',
  'Antares',
  'Fomalhaut'
]);

const TWO_PI = Math.PI * 2;
const mapState = {
  devicePixelRatio: window.devicePixelRatio || 1,
  canvasSize: 0,
  radius: 0,
  centerX: 0,
  centerY: 0,
  rotationHours: 0,
  showConstellations: true,
  showMilkyWay: true,
  hoveredStar: null,
  selectedStar: null,
  activeConstellation: null,
  previewConstellation: null,
  projectedStars: [],
  projectedPositions: new Map(),
  autoRotate: false,
  autoRotateFrame: null,
  lastAutoRotateTime: null
};

const pointerState = {
  active: false,
  pointerId: null,
  startAngle: 0,
  startRotation: 0,
  moved: false
};

let ctx = null;

function normaliseHours(value) {
  if (Number.isNaN(value)) {
    return 0;
  }
  let hours = value % 24;
  if (hours < 0) {
    hours += 24;
  }
  return hours;
}

function formatHours(value) {
  const hours = Math.floor(value);
  const minutes = Math.round((value - hours) * 60);
  return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
}

function formatRightAscension(hours) {
  const normalised = normaliseHours(hours);
  const h = Math.floor(normalised);
  const minutesFloat = (normalised - h) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${h} h ${m.toString().padStart(2, '0')} min ${s.toString().padStart(2, '0')} s`;
}

function formatDeclination(degrees) {
  const sign = degrees >= 0 ? '+' : '−';
  const abs = Math.abs(degrees);
  const d = Math.floor(abs);
  const minutesFloat = (abs - d) * 60;
  const m = Math.floor(minutesFloat);
  const s = Math.round((minutesFloat - m) * 60);
  return `${sign}${d}° ${m.toString().padStart(2, '0')}' ${s.toString().padStart(2, '0')}"`;
}

function formatMagnitude(magnitude) {
  if (typeof magnitude !== 'number' || Number.isNaN(magnitude)) {
    return '—';
  }
  return magnitude.toFixed(2);
}

function formatDistance(distance) {
  if (typeof distance !== 'number' || Number.isNaN(distance)) {
    return '—';
  }
  if (distance < 50) {
    return `${distance.toFixed(1)} al`;
  }
  return `${Math.round(distance)} al`;
}

function getSpectralColor(type) {
  if (!type || typeof type !== 'string') {
    return '#f5f8ff';
  }
  const family = type.trim()[0]?.toUpperCase();
  return SPECTRAL_COLOR_MAP.get(family) || '#f5f8ff';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const MAP_PADDING = 24;
const MAX_CANVAS_SIZE = 1080;
const AUTO_ROTATE_SPEED = 0.12;
const DEFAULT_FOCUS_STAR = 'Polaris';

function projectCoordinates(rightAscension, declination) {
  if (!mapState.radius) {
    return { x: 0, y: 0, radius: 0 };
  }
  const effectiveRA = normaliseHours(rightAscension - mapState.rotationHours);
  const angle = (effectiveRA / 24) * TWO_PI;
  const clampedDec = clamp(declination, -90, 90);
  const radial = ((90 - clampedDec) / 180) * mapState.radius;
  const x = mapState.centerX + Math.sin(angle) * radial;
  const y = mapState.centerY - Math.cos(angle) * radial;
  return { x, y, radius: radial };
}

function computeProjections() {
  mapState.projectedStars = [];
  mapState.projectedPositions.clear();
  STAR_CATALOG.forEach((star) => {
    const coords = projectCoordinates(star.rightAscension, star.declination);
    mapState.projectedPositions.set(star.name, coords);
    mapState.projectedStars.push({ star, ...coords });
  });
}
function drawBackground() {
  if (!ctx || !mapState.radius) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.centerX, mapState.centerY, mapState.radius, 0, TWO_PI);
  ctx.closePath();
  const gradient = ctx.createRadialGradient(
    mapState.centerX,
    mapState.centerY,
    mapState.radius * 0.1,
    mapState.centerX,
    mapState.centerY,
    mapState.radius
  );
  gradient.addColorStop(0, '#071a36');
  gradient.addColorStop(1, '#02050f');
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(140, 185, 255, 0.25)';
  ctx.stroke();
  ctx.restore();
}

function drawGraticule() {
  if (!ctx || !mapState.radius) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.centerX, mapState.centerY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
  for (let dec = -60; dec <= 60; dec += 30) {
    const radius = ((90 - dec) / 180) * mapState.radius;
    ctx.beginPath();
    ctx.arc(mapState.centerX, mapState.centerY, radius, 0, TWO_PI);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  const innerStart = mapState.radius * 0.18;
  for (let hour = 0; hour < 24; hour += 1) {
    const angle = (hour / 24) * TWO_PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    ctx.beginPath();
    ctx.moveTo(
      mapState.centerX + sin * innerStart,
      mapState.centerY - cos * innerStart
    );
    ctx.lineTo(
      mapState.centerX + sin * mapState.radius,
      mapState.centerY - cos * mapState.radius
    );
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = 'rgba(204, 224, 255, 0.65)';
  ctx.font = `${Math.max(11, mapState.radius * 0.06)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let hour = 0; hour < 24; hour += 3) {
    const angle = (hour / 24) * TWO_PI;
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    const labelRadius = mapState.radius + 14;
    const x = mapState.centerX + sin * labelRadius;
    const y = mapState.centerY - cos * labelRadius;
    ctx.fillText(`${hour} h`, x, y);
  }
  ctx.restore();
}

function drawMilkyWay() {
  if (!ctx || !mapState.radius || !mapState.showMilkyWay) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.centerX, mapState.centerY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  MILKY_WAY_NODES.forEach((node) => {
    const coords = projectCoordinates(node.rightAscension, node.declination);
    const width = mapState.radius * node.width;
    const gradient = ctx.createRadialGradient(
      coords.x,
      coords.y,
      width * 0.2,
      coords.x,
      coords.y,
      width
    );
    gradient.addColorStop(0, 'rgba(96, 150, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(20, 40, 90, 0)');
    ctx.beginPath();
    ctx.fillStyle = gradient;
    ctx.arc(coords.x, coords.y, width, 0, TWO_PI);
    ctx.fill();
  });
  ctx.restore();
}

function drawConstellations() {
  if (!ctx || !mapState.radius || !mapState.showConstellations) {
    return;
  }
  ctx.save();
  ctx.beginPath();
  ctx.arc(mapState.centerX, mapState.centerY, mapState.radius, 0, TWO_PI);
  ctx.clip();
  const activeId = mapState.activeConstellation?.id;
  const previewId = mapState.previewConstellation?.id;
  CONSTELLATIONS.forEach((constellation) => {
    const highlight = activeId === constellation.id;
    const preview = !highlight && previewId === constellation.id;
    ctx.strokeStyle = highlight
      ? 'rgba(255, 206, 128, 0.95)'
      : preview
        ? 'rgba(255, 214, 170, 0.7)'
        : 'rgba(132, 188, 255, 0.35)';
    ctx.lineWidth = highlight ? 2.4 : preview ? 1.6 : 1.1;
    constellation.segments.forEach(([fromName, toName]) => {
      const from = mapState.projectedPositions.get(fromName);
      const to = mapState.projectedPositions.get(toName);
      if (!from || !to) {
        return;
      }
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
  });
  ctx.restore();
}

function drawConstellationLabel(constellation, { preview = false } = {}) {
  if (!ctx || !constellation || !constellation.anchor) {
    return;
  }
  const coords = projectCoordinates(constellation.anchor.rightAscension, constellation.anchor.declination);
  if (coords.radius > mapState.radius) {
    return;
  }
  ctx.save();
  const isActive = mapState.activeConstellation?.id === constellation.id;
  const color = isActive
    ? 'rgba(255, 222, 160, 0.95)'
    : preview
      ? 'rgba(240, 234, 210, 0.92)'
      : 'rgba(180, 210, 255, 0.85)';
  ctx.fillStyle = color;
  ctx.font = `${Math.max(13, mapState.radius * 0.07)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = constellation.abbreviation || constellation.name;
  ctx.fillText(label, coords.x, coords.y);
  ctx.restore();
}

function drawStars() {
  if (!ctx || !mapState.radius) {
    return;
  }
  const activeConstellation = mapState.activeConstellation;
  const previewConstellation = mapState.previewConstellation
    && (!activeConstellation || mapState.previewConstellation.id !== activeConstellation.id)
    ? mapState.previewConstellation
    : null;
  const activeStarNames = new Set();
  const previewStarNames = new Set();
  if (activeConstellation) {
    activeConstellation.segments.forEach(([fromName, toName]) => {
      activeStarNames.add(fromName);
      activeStarNames.add(toName);
    });
    if (Array.isArray(activeConstellation.notableStars)) {
      activeConstellation.notableStars.forEach((name) => activeStarNames.add(name));
    }
  }
  if (previewConstellation) {
    previewConstellation.segments.forEach(([fromName, toName]) => {
      previewStarNames.add(fromName);
      previewStarNames.add(toName);
    });
    if (Array.isArray(previewConstellation.notableStars)) {
      previewConstellation.notableStars.forEach((name) => previewStarNames.add(name));
    }
  }

  mapState.projectedStars.forEach(({ star, x, y, radius }) => {
    if (radius > mapState.radius + 8) {
      return;
    }
    const baseSize = Math.max(1.3, 4.6 - (star.magnitude ?? 5) * 0.6);
    let size = baseSize;
    const isHovered = mapState.hoveredStar?.name === star.name;
    const isSelected = mapState.selectedStar?.name === star.name;
    const inActiveConstellation = activeStarNames.has(star.name);
    const inPreviewConstellation = !inActiveConstellation && previewStarNames.has(star.name);
    if (isSelected) {
      size += 1.6;
    } else if (isHovered) {
      size += 1.1;
    } else {
      if (inActiveConstellation) {
        size += 0.75;
      } else if (inPreviewConstellation) {
        size += 0.45;
      }
    }
    ctx.beginPath();
    ctx.fillStyle = getSpectralColor(star.spectralType);
    const alpha = isSelected || isHovered
      ? 1
      : inActiveConstellation
        ? 0.98
        : inPreviewConstellation
          ? 0.86
          : 0.75;
    ctx.globalAlpha = alpha;
    ctx.arc(x, y, size, 0, TWO_PI);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (isSelected || isHovered) {
      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = isSelected ? 'rgba(255, 210, 130, 0.9)' : 'rgba(160, 210, 255, 0.85)';
      ctx.lineWidth = isSelected ? 2.4 : 1.8;
      ctx.arc(x, y, size + 2.8, 0, TWO_PI);
      ctx.stroke();
      ctx.restore();
    }
  });
}

function drawStarLabels() {
  if (!ctx || !mapState.radius) {
    return;
  }
  ctx.save();
  ctx.fillStyle = 'rgba(235, 244, 255, 0.85)';
  ctx.font = `${Math.max(11, mapState.radius * 0.045)}px "Inter", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  const limit = (mapState.radius - 16) ** 2;
  mapState.projectedStars.forEach(({ star, x, y }) => {
    const shouldLabel = LABELLED_STARS.has(star.name)
      || mapState.selectedStar?.name === star.name
      || mapState.hoveredStar?.name === star.name;
    if (!shouldLabel) {
      return;
    }
    const dx = x - mapState.centerX;
    const dy = y - mapState.centerY;
    if (dx * dx + dy * dy > limit) {
      return;
    }
    ctx.fillText(star.name, x + 6, y - 6);
  });
  ctx.restore();
}
function renderStarMap() {
  if (!ctx || !canvas) {
    return;
  }
  ctx.setTransform(mapState.devicePixelRatio, 0, 0, mapState.devicePixelRatio, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  computeProjections();
  drawBackground();
  drawGraticule();
  if (mapState.showMilkyWay) {
    drawMilkyWay();
  }
  if (mapState.showConstellations) {
    drawConstellations();
  }
  drawStars();
  drawStarLabels();
  if (mapState.activeConstellation) {
    drawConstellationLabel(mapState.activeConstellation);
  }
  if (mapState.previewConstellation
    && (!mapState.activeConstellation || mapState.previewConstellation.id !== mapState.activeConstellation.id)) {
    drawConstellationLabel(mapState.previewConstellation, { preview: true });
  }
}
function ensureContext() {
  if (ctx || !canvas) {
    return;
  }
  ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }
}

function resizeCanvas() {
  if (!canvas || !canvasContainer) {
    return;
  }
  ensureContext();
  const rect = canvasContainer.getBoundingClientRect();
  const containerWidth = rect.width || 600;
  const viewportWidth = window.innerWidth || containerWidth;
  const viewportHeight = window.innerHeight || containerWidth;
  const fullscreenWidth = document.fullscreenElement === canvasContainer ? viewportWidth : containerWidth;
  const fullscreenHeight = document.fullscreenElement === canvasContainer ? viewportHeight : viewportHeight * 0.85;
  const size = Math.max(420, Math.min(fullscreenWidth, fullscreenHeight, MAX_CANVAS_SIZE));
  const devicePixelRatio = window.devicePixelRatio || 1;
  mapState.devicePixelRatio = devicePixelRatio;
  mapState.canvasSize = size;
  mapState.radius = size / 2 - MAP_PADDING;
  mapState.centerX = size / 2;
  mapState.centerY = size / 2;
  canvas.width = Math.round(size * devicePixelRatio);
  canvas.height = Math.round(size * devicePixelRatio);
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  if (ctx) {
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  }
}
function handleResize() {
  resizeCanvas();
  renderStarMap();
  updateTooltip(null);
}
const CONSTELLATION_LABELS = new Map();
CONSTELLATIONS.forEach((constellation) => {
  if (constellation.abbreviation) {
    CONSTELLATION_LABELS.set(constellation.abbreviation, constellation.name);
  }
  CONSTELLATION_LABELS.set(constellation.id, constellation.name);
});
function buildConstellationLegend() {
  if (!legendList) {
    return;
  }
  legendList.innerHTML = '';
  CONSTELLATIONS.forEach((constellation) => {
    const item = document.createElement('li');
    item.className = 'star-map__legend-item';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'star-map__legend-button';
    button.dataset.constellationId = constellation.id;
    button.innerHTML = `
      <span class="star-map__legend-badge">${constellation.abbreviation || constellation.id.toUpperCase()}</span>
      <span class="star-map__legend-label">${constellation.name}</span>
    `;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      toggleConstellation(constellation);
    });
    button.addEventListener('mouseenter', () => {
      previewConstellation(constellation);
    });
    button.addEventListener('mouseleave', () => {
      clearConstellationPreview(constellation);
    });
    button.addEventListener('focus', () => {
      previewConstellation(constellation);
    });
    button.addEventListener('blur', () => {
      clearConstellationPreview(constellation);
    });
    item.appendChild(button);
    legendList.appendChild(item);
  });
}

function updateLegendActive() {
  if (!legendList) {
    return;
  }
  const buttons = legendList.querySelectorAll('.star-map__legend-button');
  buttons.forEach((button) => {
    const id = button.dataset.constellationId;
    const isActive = mapState.activeConstellation?.id === id;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
}
function setRotation(hours) {
  mapState.rotationHours = normaliseHours(hours);
  if (rotationInput) {
    rotationInput.value = mapState.rotationHours.toFixed(2);
  }
  if (rotationValue) {
    const formatted = formatHours(mapState.rotationHours).replace('.', ',');
    rotationValue.textContent = formatted;
  }
  renderStarMap();
  updateDetails();
}

function toggleConstellation(constellation) {
  if (!constellation) {
    return;
  }
  if (mapState.activeConstellation?.id === constellation.id) {
    mapState.activeConstellation = null;
  } else {
    mapState.activeConstellation = constellation;
  }
  mapState.previewConstellation = null;
  mapState.selectedStar = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
}

function selectStar(star) {
  if (!star) {
    return;
  }
  if (mapState.selectedStar?.name === star.name) {
    mapState.selectedStar = null;
  } else {
    mapState.selectedStar = star;
  }
  if (mapState.selectedStar) {
    mapState.activeConstellation = CONSTELLATIONS.find(
      (constellation) => constellation.abbreviation === star.constellation || constellation.name === star.constellation
    ) || mapState.activeConstellation;
  }
  mapState.previewConstellation = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
}

function clearSelection() {
  mapState.selectedStar = null;
  mapState.activeConstellation = null;
  mapState.previewConstellation = null;
  updateLegendActive();
  updateDetails();
  renderStarMap();
}

function previewConstellation(constellation) {
  if (!constellation || mapState.activeConstellation?.id === constellation.id) {
    return;
  }
  mapState.previewConstellation = constellation;
  updateDetails();
  renderStarMap();
}

function clearConstellationPreview(constellation, { skipRender = false, skipDetails = false } = {}) {
  if (!mapState.previewConstellation) {
    return;
  }
  if (constellation && mapState.previewConstellation.id !== constellation.id) {
    return;
  }
  mapState.previewConstellation = null;
  if (!skipDetails) {
    updateDetails();
  }
  if (!skipRender) {
    renderStarMap();
  }
}
function updateDetails() {
  if (!detailsPanel) {
    updateCenterButtonLabel();
    return;
  }
  if (mapState.selectedStar) {
    renderStarDetails(mapState.selectedStar, { locked: true });
  } else if (mapState.hoveredStar) {
    renderStarDetails(mapState.hoveredStar, { locked: false });
  } else if (mapState.activeConstellation) {
    renderConstellationDetails(mapState.activeConstellation);
  } else if (mapState.previewConstellation) {
    renderConstellationDetails(mapState.previewConstellation);
  } else {
    setDefaultDetails();
  }
  updateCenterButtonLabel();
}

function setDefaultDetails() {
  if (!detailsPanel) {
    return;
  }
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">Fiche rapide</h3>
    <p>Survole une étoile brillante ou sélectionne une constellation pour obtenir des conseils d’observation.</p>
  `;
}

function renderStarDetails(star, { locked = false } = {}) {
  if (!detailsPanel || !star) {
    return;
  }
  const constellationName = CONSTELLATION_LABELS.get(star.constellation) || star.constellation;
  const heading = locked ? 'Étoile sélectionnée' : 'Étoile survolée';
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">${heading}</h3>
    <p class="star-map__details-subtitle">${star.name} · ${star.designation} (${constellationName})</p>
    <dl class="star-map__facts">
      <div class="star-map__fact"><dt>Ascension droite</dt><dd>${formatRightAscension(star.rightAscension)}</dd></div>
      <div class="star-map__fact"><dt>Déclinaison</dt><dd>${formatDeclination(star.declination)}</dd></div>
      <div class="star-map__fact"><dt>Magnitude</dt><dd>${formatMagnitude(star.magnitude)}</dd></div>
      <div class="star-map__fact"><dt>Distance</dt><dd>${formatDistance(star.distance)}</dd></div>
      <div class="star-map__fact"><dt>Type spectral</dt><dd>${star.spectralType || '—'}</dd></div>
    </dl>
    <p class="star-map__details-text">${star.description}</p>
    <p class="star-map__details-tip">${star.observation}</p>
  `;
}

function updateCenterButtonLabel() {
  if (!centerButton) {
    return;
  }
  const target = mapState.selectedStar || mapState.hoveredStar;
  if (target) {
    centerButton.textContent = `🎯 Centrer ${target.name}`;
    centerButton.setAttribute('aria-label', `Centrer la carte sur ${target.name}`);
    centerButton.disabled = false;
  } else {
    centerButton.textContent = `🎯 Centrer ${DEFAULT_FOCUS_STAR}`;
    centerButton.setAttribute('aria-label', `Centrer la carte sur ${DEFAULT_FOCUS_STAR}`);
    centerButton.disabled = false;
  }
}

function renderConstellationDetails(constellation) {
  if (!detailsPanel || !constellation) {
    return;
  }
  const notable = Array.isArray(constellation.notableStars) && constellation.notableStars.length > 0
    ? constellation.notableStars.join(', ')
    : '—';
  const isActive = mapState.activeConstellation?.id === constellation.id;
  const heading = isActive ? 'Constellation sélectionnée' : 'Constellation à explorer';
  const abbreviation = (constellation.abbreviation || constellation.id || '').toUpperCase();
  detailsPanel.innerHTML = `
    <h3 class="star-map__details-title">${heading}</h3>
    <p class="star-map__details-subtitle">${constellation.name}${abbreviation ? ` (${abbreviation})` : ''}</p>
    <dl class="star-map__facts">
      <div class="star-map__fact"><dt>Saison idéale</dt><dd>${constellation.bestSeason}</dd></div>
      <div class="star-map__fact"><dt>Étoiles repères</dt><dd>${notable}</dd></div>
    </dl>
    <p class="star-map__details-text">${constellation.description}</p>
    <p class="star-map__details-tip">${constellation.observation}</p>
  `;
}
function updateTooltip(star, event) {
  if (!tooltip) {
    return;
  }
  if (!star) {
    tooltip.hidden = true;
    return;
  }
  tooltip.innerHTML = `
    <strong>${star.name}</strong>
    <span>${star.designation} · ${star.constellation}</span>
    <span>${formatRightAscension(star.rightAscension)} · ${formatDeclination(star.declination)} · mag ${formatMagnitude(star.magnitude)}</span>
  `;
  const rect = canvasContainer.getBoundingClientRect();
  const offsetX = event ? event.clientX - rect.left : mapState.centerX;
  const offsetY = event ? event.clientY - rect.top : mapState.centerY;
  const maxLeft = rect.width - 190;
  const maxTop = rect.height - 80;
  const clampedLeft = Math.min(maxLeft, Math.max(12, offsetX + 14));
  const clampedTop = Math.min(maxTop, Math.max(12, offsetY + 14));
  tooltip.style.left = `${clampedLeft}px`;
  tooltip.style.top = `${clampedTop}px`;
  tooltip.hidden = false;
}
function getRelativePosition(event) {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * (mapState.canvasSize / rect.width);
  const y = (event.clientY - rect.top) * (mapState.canvasSize / rect.height);
  return { x, y };
}

function findStarAtPosition(x, y) {
  let closest = null;
  let minDistance = Infinity;
  mapState.projectedStars.forEach(({ star, x: sx, y: sy }) => {
    const dx = x - sx;
    const dy = y - sy;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const threshold = Math.max(12, 6 + Math.max(1.2, 4.6 - (star.magnitude ?? 5) * 0.6));
    if (distance <= threshold && distance < minDistance) {
      closest = star;
      minDistance = distance;
    }
  });
  return closest;
}

function updateAutoRotateButton() {
  if (!autoRotateButton) {
    return;
  }
  autoRotateButton.setAttribute('aria-pressed', mapState.autoRotate ? 'true' : 'false');
  autoRotateButton.textContent = mapState.autoRotate ? '⏸️ Pause rotation' : '⟳ Rotation auto';
  autoRotateButton.setAttribute(
    'title',
    mapState.autoRotate ? 'Suspendre la rotation automatique' : 'Lancer la rotation automatique'
  );
}

function autoRotateStep(timestamp) {
  if (!mapState.autoRotate) {
    mapState.autoRotateFrame = null;
    mapState.lastAutoRotateTime = null;
    return;
  }
  if (typeof mapState.lastAutoRotateTime === 'number') {
    const deltaSeconds = (timestamp - mapState.lastAutoRotateTime) / 1000;
    const deltaHours = deltaSeconds * AUTO_ROTATE_SPEED;
    if (deltaHours) {
      setRotation(mapState.rotationHours + deltaHours);
    }
  }
  mapState.lastAutoRotateTime = timestamp;
  mapState.autoRotateFrame = requestAnimationFrame(autoRotateStep);
}

function startAutoRotate() {
  if (mapState.autoRotate) {
    return;
  }
  mapState.autoRotate = true;
  mapState.lastAutoRotateTime = null;
  updateAutoRotateButton();
  mapState.autoRotateFrame = requestAnimationFrame(autoRotateStep);
}

function stopAutoRotate({ updateButton = true } = {}) {
  if (mapState.autoRotateFrame) {
    cancelAnimationFrame(mapState.autoRotateFrame);
  }
  mapState.autoRotateFrame = null;
  mapState.lastAutoRotateTime = null;
  const wasActive = mapState.autoRotate;
  mapState.autoRotate = false;
  if (updateButton || wasActive) {
    updateAutoRotateButton();
  }
}

function toggleAutoRotate() {
  if (mapState.autoRotate) {
    stopAutoRotate();
  } else {
    startAutoRotate();
  }
}

function focusOnStar(star) {
  if (!star) {
    return;
  }
  stopAutoRotate();
  mapState.hoveredStar = null;
  mapState.previewConstellation = null;
  mapState.selectedStar = star;
  const constellation = CONSTELLATIONS.find(
    (item) => item.abbreviation === star.constellation || item.name === star.constellation
  );
  if (constellation) {
    mapState.activeConstellation = constellation;
  }
  updateLegendActive();
  setRotation(star.rightAscension);
}

function handleCenterSelection() {
  const target = mapState.selectedStar
    || mapState.hoveredStar
    || STAR_CATALOG.find((star) => star.name === DEFAULT_FOCUS_STAR)
    || mapState.projectedStars[0]?.star;
  if (target) {
    focusOnStar(target);
  }
}

function handleDoubleClick(event) {
  if (!canvas) {
    return;
  }
  event.preventDefault();
  const { x, y } = getRelativePosition(event);
  const star = findStarAtPosition(x, y);
  if (star) {
    focusOnStar(star);
  }
}

function isFullscreenActive() {
  return document.fullscreenElement === canvasContainer;
}

function updateFullscreenButton() {
  if (!fullscreenButton) {
    return;
  }
  const fullscreen = isFullscreenActive();
  fullscreenButton.setAttribute('aria-pressed', fullscreen ? 'true' : 'false');
  fullscreenButton.textContent = fullscreen ? '⤺ Fermer le plein écran' : '⤢ Plein écran';
  fullscreenButton.setAttribute(
    'title',
    fullscreen ? 'Revenir à la taille normale' : 'Afficher la carte du ciel en plein écran'
  );
}

function handleFullscreenToggle() {
  if (!canvasContainer) {
    return;
  }
  if (isFullscreenActive()) {
    if (document.exitFullscreen) {
      const exitResult = document.exitFullscreen();
      if (exitResult && typeof exitResult.catch === 'function') {
        exitResult.catch(() => {});
      }
    }
  } else if (canvasContainer.requestFullscreen) {
    const requestResult = canvasContainer.requestFullscreen();
    if (requestResult && typeof requestResult.catch === 'function') {
      requestResult.catch(() => {});
    }
  }
}

function handleFullscreenChange() {
  updateFullscreenButton();
  resizeCanvas();
  renderStarMap();
}

function handleVisibilityChange() {
  if (document.hidden) {
    stopAutoRotate();
  }
}
function handlePointerDown(event) {
  if (!canvas) {
    return;
  }
  stopAutoRotate();
  clearConstellationPreview();
  pointerState.active = true;
  pointerState.pointerId = event.pointerId;
  pointerState.moved = false;
  const { x, y } = getRelativePosition(event);
  pointerState.startAngle = Math.atan2(y - mapState.centerY, x - mapState.centerX);
  pointerState.startRotation = mapState.rotationHours;
  canvas.setPointerCapture(event.pointerId);
}

function handlePointerMove(event) {
  if (!canvas) {
    return;
  }
  if (pointerState.active && event.pointerId === pointerState.pointerId) {
    const { x, y } = getRelativePosition(event);
    const angle = Math.atan2(y - mapState.centerY, x - mapState.centerX);
    let delta = pointerState.startAngle - angle;
    if (delta > Math.PI) {
      delta -= TWO_PI;
    } else if (delta < -Math.PI) {
      delta += TWO_PI;
    }
    const deltaHours = (delta / TWO_PI) * 24;
    if (Math.abs(deltaHours) > 0.01) {
      pointerState.moved = true;
      clearConstellationPreview(undefined, { skipRender: true, skipDetails: true });
      setRotation(pointerState.startRotation + deltaHours);
    }
  } else {
    const { x, y } = getRelativePosition(event);
    const hovered = findStarAtPosition(x, y);
    let previewCleared = false;
    if (hovered && mapState.previewConstellation) {
      clearConstellationPreview(undefined, { skipRender: true });
      previewCleared = true;
    }
    if (hovered?.name !== mapState.hoveredStar?.name) {
      mapState.hoveredStar = hovered || null;
      if (!mapState.selectedStar) {
        updateDetails();
      }
      renderStarMap();
      previewCleared = false;
    } else if (previewCleared) {
      renderStarMap();
    }
    updateTooltip(hovered, event);
  }
}

function handlePointerUp(event) {
  if (!canvas) {
    return;
  }
  if (pointerState.active && event.pointerId === pointerState.pointerId) {
    canvas.releasePointerCapture(event.pointerId);
    if (!pointerState.moved && mapState.hoveredStar) {
      selectStar(mapState.hoveredStar);
    }
    pointerState.active = false;
    pointerState.pointerId = null;
    pointerState.moved = false;
  }
}

function handlePointerLeave() {
  if (pointerState.active) {
    return;
  }
  mapState.hoveredStar = null;
  updateDetails();
  updateTooltip(null);
  renderStarMap();
}
function handleRotationInput(event) {
  const value = parseFloat(event.target.value);
  stopAutoRotate();
  setRotation(Number.isNaN(value) ? 0 : value);
}

function handleResetOrientation() {
  stopAutoRotate();
  setRotation(0);
  clearSelection();
}

function handleConstellationToggle(event) {
  mapState.showConstellations = Boolean(event.target.checked);
  renderStarMap();
}

function handleMilkyWayToggle(event) {
  mapState.showMilkyWay = Boolean(event.target.checked);
  renderStarMap();
}
function applyNightMode(enabled) {
  document.documentElement.classList.toggle('night-mode', enabled);
  if (nightModeToggle) {
    nightModeToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    nightModeToggle.classList.toggle('is-active', enabled);
    nightModeToggle.textContent = enabled ? '🌅 Mode jour' : '🔦 Mode nuit';
  }
}

function readNightModePreference() {
  let stored = null;
  try {
    stored = localStorage.getItem(NIGHT_MODE_STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  if (stored === '1') {
    applyNightMode(true);
  } else if (stored === '0') {
    applyNightMode(false);
  } else {
    applyNightMode(false);
  }
}
function initialiseStarMap() {
  if (!canvas) {
    readNightModePreference();
    if (nightModeToggle) {
      nightModeToggle.addEventListener('click', () => {
        const enabled = !document.documentElement.classList.contains('night-mode');
        applyNightMode(enabled);
        try {
          localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
        } catch (error) {
          /* ignore */
        }
      });
    }
    return;
  }

  ensureContext();
  buildConstellationLegend();
  updateLegendActive();

  mapState.showConstellations = constellationsToggle ? Boolean(constellationsToggle.checked) : true;
  mapState.showMilkyWay = milkyWayToggle ? Boolean(milkyWayToggle.checked) : true;

  setDefaultDetails();
  resizeCanvas();
  setRotation(0);
  renderStarMap();

  readNightModePreference();
  if (nightModeToggle) {
    nightModeToggle.addEventListener('click', () => {
      const enabled = !document.documentElement.classList.contains('night-mode');
      applyNightMode(enabled);
      try {
        localStorage.setItem(NIGHT_MODE_STORAGE_KEY, enabled ? '1' : '0');
      } catch (error) {
        /* ignore */
      }
    });
  }

  window.addEventListener('resize', handleResize);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      clearSelection();
    }
  });

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerLeave);
  canvas.addEventListener('dblclick', handleDoubleClick);

  if (rotationInput) {
    rotationInput.addEventListener('input', handleRotationInput);
    rotationInput.addEventListener('change', handleRotationInput);
  }
  if (resetButton) {
    resetButton.addEventListener('click', handleResetOrientation);
  }
  if (constellationsToggle) {
    constellationsToggle.addEventListener('change', handleConstellationToggle);
  }
  if (milkyWayToggle) {
    milkyWayToggle.addEventListener('change', handleMilkyWayToggle);
  }
  if (autoRotateButton) {
    autoRotateButton.addEventListener('click', toggleAutoRotate);
    updateAutoRotateButton();
  }
  if (centerButton) {
    centerButton.addEventListener('click', handleCenterSelection);
    centerButton.setAttribute('title', 'Aligner la carte sur l’étoile suivie');
    updateCenterButtonLabel();
  }
  if (fullscreenButton) {
    fullscreenButton.addEventListener('click', handleFullscreenToggle);
    updateFullscreenButton();
  }
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('visibilitychange', handleVisibilityChange);
}

initialiseStarMap();
