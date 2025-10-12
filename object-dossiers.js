const OBJECT_DOSSIERS = {
  1: {
    aliases: ['Nébuleuse du Crabe', 'Crab Nebula', 'NGC 1952'],
    distanceLy: 6500,
    angularSize: "7'×5'",
    discovery: 'John Bevis (1731), Charles Messier (1758)',
    story:
      "Vestige d'une supernova observée en 1054 par les astronomes chinois, M1 s'étend encore aujourd'hui sous l'effet d'un pulsar central très énergique.",
    observation:
      "À faible grossissement, repère une lueur ovale diffuse. Des filtres UHC ou OIII révèlent les filaments les plus contrastés sous un ciel sombre.",
    sources: [
      { label: 'NASA — M1 Overview', url: 'https://science.nasa.gov/messier/messier-1/' },
      { label: 'ESA / Hubble — Crab Nebula', url: 'https://esahubble.org/images/opo0327a/' }
    ]
  },
  8: {
    aliases: ['Nébuleuse de la Lagune', 'Lagoon Nebula', 'NGC 6523'],
    distanceLy: 4100,
    angularSize: "90'×40'",
    discovery: 'Giovanni Hodierna (1654), Charles Messier (1764)',
    story:
      "M8 est une pouponnière stellaire de la Voie lactée dont les gaz ionisés par de jeunes étoiles sculptent des colonnes et cavités spectaculaires.",
    observation:
      "Utilise un filtre UHC et un faible grossissement pour embrasser la nébuleuse entière et repérer la division sombre surnommée 'la Lagune'.",
    sources: [
      { label: 'ESO — Lagoon Nebula', url: 'https://www.eso.org/public/france/images/eso0936a/' }
    ]
  },
  13: {
    aliases: ['Grand amas d’Hercule', 'Great Hercules Cluster', 'NGC 6205'],
    distanceLy: 22000,
    angularSize: "20'",
    discovery: 'Edmond Halley (1714), Charles Messier (1764)',
    story:
      "Un des amas globulaires les plus brillants de l’hémisphère nord, réputé pour son cœur dense et ses multiples couches stellaires.",
    observation:
      "Commence au faible grossissement pour isoler l’amas puis augmente progressivement : les étoiles se détachent dès 120× avec un instrument de 200 mm.",
    sources: [
      { label: 'NASA — M13 Overview', url: 'https://science.nasa.gov/messier/messier-13/' }
    ]
  },
  31: {
    aliases: ['Galaxie d’Andromède', 'Andromeda Galaxy', 'NGC 224'],
    distanceLy: 2540000,
    angularSize: '3°×1°',
    discovery: 'Abd al-Rahman al-Sufi (964), Charles Messier (1764)',
    story:
      "Plus grande galaxie spirale voisine de la Voie lactée, M31 domine le ciel d’automne et révèle une bande poussiéreuse sur les photographies longues poses.",
    observation:
      "Observe sous un ciel très sombre avec une paire de jumelles ou un télescope court pour embrasser son disque étendu et ses compagnes M32 et M110.",
    sources: [
      { label: 'ESA / Hubble — Andromeda', url: 'https://www.spacetelescope.org/images/heic1502a/' },
      { label: 'NASA — M31 Overview', url: 'https://science.nasa.gov/messier/messier-31/' }
    ]
  },
  33: {
    aliases: ['Galaxie du Triangle', 'Triangulum Galaxy', 'NGC 598'],
    distanceLy: 2730000,
    angularSize: "70'×40'",
    discovery: 'Giovanni Battista Hodierna (1654), Charles Messier (1764)',
    story:
      "M33 est une galaxie spirale vue de face dont les bras peu contrastés exigent un ciel d’excellente transparence pour se révéler visuellement.",
    observation:
      "Utilise un faible grossissement et de la vision décalée pour déceler les nodosités HII ; la région NGC 604 est la plus lumineuse.",
    sources: [
      { label: 'NASA — M33 Overview', url: 'https://science.nasa.gov/messier/messier-33/' }
    ]
  },
  42: {
    aliases: ['Grande Nébuleuse d’Orion', 'Orion Nebula', 'NGC 1976'],
    distanceLy: 1350,
    angularSize: "65'×60'",
    discovery: 'Nicolas-Claude Fabri de Peiresc (1610), Charles Messier (1769)',
    story:
      "Nébuleuse d’émission emblématique, M42 abrite le Trapèze, un amas d’étoiles massives qui sculpte et illumine les nuages moléculaires voisins.",
    observation:
      "Déploie la vision périphérique pour saisir les ailes en forme de papillon ; un filtre UHC accentue les contrastes tout en conservant des détails.",
    sources: [
      { label: 'ESA / Hubble — Orion', url: 'https://www.spacetelescope.org/images/heic0601a/' }
    ]
  },
  45: {
    aliases: ['Amas des Pléiades', 'Seven Sisters', 'NGC 1432'],
    distanceLy: 444,
    angularSize: '110′',
    discovery: 'Antiquité — décrit par Aratos (IIIe siècle av. J.-C.)',
    story:
      "Un jeune amas ouvert enveloppé de nébulosités réfléchissantes bleutées ; sa silhouette est connue depuis l’Antiquité.",
    observation:
      "Privilégie un instrument grand champ (jumelles, lunette courte) pour faire tenir les sept étoiles principales dans le champ.",
    sources: [
      { label: 'NASA — M45 Overview', url: 'https://science.nasa.gov/messier/messier-45/' }
    ]
  },
  51: {
    aliases: ['Galaxie du Tourbillon', 'Whirlpool Galaxy', 'NGC 5194'],
    distanceLy: 23000000,
    angularSize: "11'×7'",
    discovery: 'Charles Messier (1773)',
    story:
      "Galaxie spirale interagissant avec M51b, célèbre pour ses bras bien découpés visibles en astrophotographie.",
    observation:
      "Un télescope de 200 mm et un ciel transparent laissent deviner la structure spiralée ; cherche la passerelle de matière vers la galaxie compagne.",
    sources: [
      { label: 'ESA / Hubble — Whirlpool Galaxy', url: 'https://www.spacetelescope.org/images/opo0328a/' }
    ]
  },
  57: {
    aliases: ['Nébuleuse de la Lyre', 'Ring Nebula', 'NGC 6720'],
    distanceLy: 2300,
    angularSize: "1.4'×1.0'",
    discovery: 'Antoine Darquier de Pellepoix (1779)',
    story:
      "Restes d’une étoile semblable au Soleil expulsée en coquilles successives, laissant une structure annulaire fluorescente.",
    observation:
      "Le filtre OIII ou UHC met en évidence l’anneau ; pousse le grossissement au-delà de 150× pour percevoir le centre plus sombre.",
    sources: [
      { label: 'NASA — M57 Overview', url: 'https://science.nasa.gov/messier/messier-57/' }
    ]
  },
  81: {
    aliases: ['Galaxie de Bode', 'Bode’s Galaxy', 'NGC 3031'],
    distanceLy: 12000000,
    angularSize: "27'×14'",
    discovery: 'Johann Elert Bode (1774)',
    story:
      "Galaxie spirale brillante accompagnée de M82 dans la Grande Ourse ; son bulbe lumineux est aisément visible même avec un petit instrument.",
    observation:
      "Balaye le champ autour de γ UMa pour repérer le duo M81/M82 ; augmente légèrement le grossissement pour distinguer le noyau.",
    sources: [
      { label: 'NASA — M81 Overview', url: 'https://science.nasa.gov/messier/messier-81/' }
    ]
  },
  82: {
    aliases: ['Galaxie du Cigare', 'Cigar Galaxy', 'NGC 3034'],
    distanceLy: 12000000,
    angularSize: "11'×5'",
    discovery: 'Johann Elert Bode (1774)',
    story:
      "Galaxie starburst soufflée par des vents stellaires intenses provoqués par son interaction avec M81.",
    observation:
      "Après avoir localisé M81, décale légèrement le champ vers l’est pour découvrir M82 en forme de fuseau strié.",
    sources: [
      { label: 'NASA — M82 Overview', url: 'https://science.nasa.gov/messier/messier-82/' }
    ]
  },
  104: {
    aliases: ['Galaxie du Sombrero', 'Sombrero Galaxy', 'NGC 4594'],
    distanceLy: 29000000,
    angularSize: "9'×4'",
    discovery: 'Pierre Méchain (1781)',
    story:
      "Une galaxie lenticulaire inclinée dont la bande de poussière centrale évoque la forme d’un sombrero mexicain.",
    observation:
      "Un télescope de 150 mm suffit pour discerner le bulbe brillant ; la bande sombre apparaît sous un ciel stable de printemps.",
    sources: [
      { label: 'NASA — M104 Overview', url: 'https://science.nasa.gov/messier/messier-104/' }
    ]
  }
};

export function getObjectDossier(number) {
  const key = Number(number);
  if (!Number.isFinite(key)) {
    return null;
  }
  return OBJECT_DOSSIERS[key] || null;
}

export function listKnownDossiers() {
  return Object.keys(OBJECT_DOSSIERS).map((key) => Number(key));
}
