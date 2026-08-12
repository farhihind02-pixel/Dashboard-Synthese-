/**
 * config.js — Configuration SGTM BIM Dashboard
 */
const BIM_CONFIG = {
  colors: {
    realise:     '#B8960C',
    enCours:     '#B8960C',
    nonRealise:  '#D93025',
    nonConcerne: '#9AA0A6',
    sgtmOrange:  '#B8960C',
    sgtmGray:    '#4A4A4A',
  },
  labels: {
    realise:     'Réalisé',
    nonRealise:  'Non réalisé',
  },
};

function getStatusColor(statut) {
  const map = {
    'realise':      BIM_CONFIG.colors.realise,
    'en_cours':     BIM_CONFIG.colors.enCours,
    'non_realise':  BIM_CONFIG.colors.nonRealise,
    'non_concerne': BIM_CONFIG.colors.nonConcerne,
  };
  return map[statut] || BIM_CONFIG.colors.nonConcerne;
}

function getStatusLabel(statut) {
  const map = {
    'realise':      'Réalisé',
    'non_realise':  'Non réalisé',
  };
  return map[statut] || 'Non concerné';
}

function getStatusBadgeClass(statut) {
  const map = {
    'realise':      'status-realise',
    'non_realise':  'status-non-realise',
  };
  return map[statut] || 'status-non-concerne';
}

// Couleurs APS pour le viewer (THREE.Vector4)
const APS_COLORS = {
  realise:      { x:0.722, y:0.588, z:0.047, w:1 },
  en_cours:     { x:0.910, y:0.467, z:0.133, w:1 },
  non_realise:  { x:0.851, y:0.188, z:0.145, w:1 },
  non_concerne: { x:0.604, y:0.627, z:0.639, w:1 },
};

function getAPSColor(statut) {
  const c = APS_COLORS[statut] || APS_COLORS.non_concerne;
  return new THREE.Vector4(c.x, c.y, c.z, c.w);
}

// ── État (paramètre Revit Res_État) ───────────────────────────────────────────
const ETAT_COLORS = {
  'Levé':                        '#22b07d',
  'À lever':                     '#E87722',
  'À créer dans le chantier':    '#D93025',
  'À modéliser':                 '#4A78D9',
};

const ETAT_APS_COLORS = {
  'Levé':                        { x:0.133, y:0.690, z:0.490, w:1 },
  'À lever':                     { x:0.910, y:0.467, z:0.133, w:1 },
  'À créer dans le chantier':    { x:0.851, y:0.188, z:0.145, w:1 },
  'À modéliser':                 { x:0.290, y:0.471, z:0.851, w:1 },
};

function getEtatColor(etat) {
  return ETAT_COLORS[etat] || '#9AA0A6';
}

function getEtatAPSColor(etat) {
  const c = ETAT_APS_COLORS[etat] || { x:0.604, y:0.627, z:0.639, w:1 };
  return new THREE.Vector4(c.x, c.y, c.z, c.w);
}