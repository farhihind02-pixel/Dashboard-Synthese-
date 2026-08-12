/**
 * data.js — Données BIM
 * 
 * LEVÉE = groupe d'éléments ayant le même Bloc + Zone + Niveau (ME_ELEMENT LEVEL)
 * Le dashboard affiche des LEVÉES, pas des éléments individuels.
 */

const AppState = {
  allElements:   [],
  allLevees:     [],
  filteredLevees:[],
  activeFilter:  null,
  stats:         null,
  filteredStats: null,
  dbIdMap:       new Map(),
};

async function loadDataFromJSON() {
  try {
    const [elemResp, levResp] = await Promise.all([
      fetch('/assets/data.json'),
      fetch('/assets/levees.json'),
    ]);
    AppState.allElements = await elemResp.json();
    AppState.allLevees   = await levResp.json();
    AppState.dbIdMap.clear();
    AppState.allElements.forEach(el => {
      const id = parseInt(el.id);
      if (!isNaN(id)) AppState.dbIdMap.set(id, el);
    });
    console.log('[Data] dbIdMap:', AppState.dbIdMap.size, 'entrées');

    AppState.filteredLevees = [...AppState.allLevees];
    AppState.stats          = computeStats(AppState.allLevees);
    AppState.filteredStats  = AppState.stats;

    console.log(`[Data] ${AppState.allElements.length} éléments, ${AppState.allLevees.length} levées`);
    return true;
  } catch (err) {
    console.warn('[Data] Chargement JSON échoué:', err);
    return false;
  }
}

async function loadDataFromViewer(viewer) {
  return new Promise((resolve, reject) => {
    viewer.model.getBulkProperties(
      null,
      {
        propFilter: [
          'BLOC', 'Bloc', 'Res_Bloc', 'RES_BLOC',
          'ZONE', 'Zone', 'ME_ELEMENT ZONE', 'Res_Zone', 'RES_ZONE',
          'ME_ELEMENT LEVEL',
          'ME_ELEMENT TYPE',
          'Phase 1', 'RESTE', 'Coulé 1', 'Coulé 2',
          'BB FERR', 'BB COULAGE', 'BB POSE',
          'Volume', 'Inaccessible',
          'Res_État', 'Res_Etat', 'RES_ÉTAT', 'RES_ETAT', 'res_état', 'res_etat',
          'Res_Famille', 'RES_FAMILLE', 'res_famille',
          'Res_Orientation', 'RES_ORIENTATION', 'res_orientation',
        ],
      },
      (results) => {
        AppState.allElements = [];
        AppState.dbIdMap.clear();

        for (const r of results) {
          const el = normalizeElementFromViewer(r);
          AppState.allElements.push(el);
          AppState.dbIdMap.set(r.dbId, el);
        }

        const avecBloc = AppState.allElements.filter(e => e.bloc);
        console.log('[Data] Éléments avec bloc:', avecBloc.length, avecBloc.slice(0,3).map(e=>({bloc:e.bloc,zone:e.zone})));

        const zoneCounts = {};
        let sansZone = 0;
        for (const e of AppState.allElements) {
          if (e.zone) zoneCounts[e.zone] = (zoneCounts[e.zone]||0) + 1;
          else sansZone++;
        }
        console.log('[Data] Distribution zones:', zoneCounts, '| Sans zone:', sansZone, '/', AppState.allElements.length);

        const blocCounts = {};
        let sansBloc = 0;
        for (const e of AppState.allElements) {
          if (e.bloc) blocCounts[e.bloc] = (blocCounts[e.bloc]||0) + 1;
          else sansBloc++;
        }
        console.log('[Data] Distribution blocs:', blocCounts, '| Sans bloc:', sansBloc, '/', AppState.allElements.length);

        // Debug : distribution ME_ELEMENT TYPE
        const typeCounts = {};
        for (const e of AppState.allElements) {
          const t = e.elementType || '(vide)';
          typeCounts[t] = (typeCounts[t]||0) + 1;
        }
        console.log('[Data] Distribution elementType:', typeCounts);

        // Debug : distribution Res_État (pour diagnostiquer le filtre État)
        const etatCounts = {};
        for (const e of AppState.allElements) {
          const v = e.resEtat || '(vide/non trouvé)';
          etatCounts[v] = (etatCounts[v]||0) + 1;
        }
        console.log('[Data] Distribution resEtat:', etatCounts);

        // Diagnostic global : si BLOC, ZONE ou Res_Orientation sont vides pour TOUS les
        // éléments, le nom de propriété ne correspond pas à ce que le viewer connaît
        // (propFilter restreint déjà la réponse, donc on ne peut pas le voir depuis
        // "results"). On fait un appel SANS filtre pour lister toutes les vraies
        // propriétés et retrouver les bons noms.
        // IMPORTANT : on ne prend PAS results[0] au hasard — ça peut être une feuille
        // (Sheet) Revit sans aucun rapport avec les éléments 3D du modèle. On cible un
        // élément dont on SAIT que c'est un vrai élément BIM (il a un Res_État valide).
        const blocVide        = sansBloc === AppState.allElements.length;
        const zoneVide        = sansZone === AppState.allElements.length;
        const orientationVide = AppState.allElements.every(e => !e.orientation);
        if (blocVide || zoneVide || orientationVide) {
          const sampleEl = results.find(r => {
            const el = AppState.dbIdMap.get(r.dbId);
            return el && el.resEtat;
          }) || results[0];
          if (sampleEl) {
            viewer.model.getProperties(sampleEl.dbId, (fullProps) => {
              const allNames = (fullProps.properties || []).map(p => p.displayName);
              console.log('[Data] ⚠️ BLOC/ZONE/Orientation introuvables (au moins un des trois est vide pour tous les éléments).');
              console.log('[Data] ⚠️ Toutes les propriétés d\'un VRAI élément BIM (dbId', sampleEl.dbId, ') :', allNames);
              if (blocVide)        console.log('[Data] ⚠️ Suspects pour BLOC :',        allNames.filter(n => /bloc/i.test(n)));
              if (zoneVide)        console.log('[Data] ⚠️ Suspects pour ZONE :',        allNames.filter(n => /zone/i.test(n)));
              if (orientationVide) console.log('[Data] ⚠️ Suspects pour Orientation :', allNames.filter(n => /orient/i.test(n)));
            }, (err) => console.warn('[Data] Erreur getProperties diagnostic:', err));
          }
        }

        AppState.allLevees      = buildLeveesFromElements(AppState.allElements);
        AppState.filteredLevees = [...AppState.allLevees];
        AppState.stats          = computeStats(AppState.allLevees);
        AppState.filteredStats  = AppState.stats;

        console.log(`[Data] ${AppState.allElements.length} éléments, ${AppState.allLevees.length} levées (viewer)`);
        resolve();
      },
      reject
    );
  });
}

function normalizeElementFromViewer(raw) {
  const props = {};
  for (const p of (raw.properties || [])) {
    props[p.displayName?.toLowerCase()] = p.displayValue;
    if (p.attributeName) props[p.attributeName.toLowerCase()] = p.displayValue;
  }
  const get = (...keys) => {
    for (const k of keys) {
      const v = props[k.toLowerCase()];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return null;
  };

  const phase1 = get('Phase 1', 'phase 1');
  const reste  = get('RESTE');
  const coule1 = get('Coulé 1', 'Coule 1');
  const coule2 = get('Coulé 2', 'Coule 2');
  const isTrue = v => v === true || v === 'true' || v === 1 || v === '.T.';

  let statut;
  if (isTrue(phase1))                        statut = 'realise';
  else if (isTrue(coule1) || isTrue(coule2)) statut = 'en_cours';
  else if (isTrue(reste))                    statut = 'non_realise';
  else                                       statut = 'non_concerne';

  // ME_ELEMENT TYPE — ex: 'GD', 'MS', 'VO', etc.
  const elementTypeRaw = get('ME_ELEMENT TYPE', 'me_element type');
  const elementType    = elementTypeRaw ? String(elementTypeRaw).trim().toUpperCase() : null;

  // Res_État — paramètre Revit dédié (distinct de l'avancement Phase1/Coulé/Reste ci-dessus)
  const resEtatRaw = get('Res_État', 'Res_Etat', 'RES_ÉTAT', 'RES_ETAT');
  const resEtat     = resEtatRaw ? String(resEtatRaw).trim() : null;

  // Res_Famille — utilisé pour le filtre "Type"
  const resFamilleRaw = get('Res_Famille', 'RES_FAMILLE', 'res_famille');
  const resFamille     = resFamilleRaw ? String(resFamilleRaw).trim() : null;

  // Res_Orientation — utilisé pour le filtre "Orientation" (remplace l'ancien filtre Niveau)
  const orientationRaw = get('Res_Orientation', 'RES_ORIENTATION', 'res_orientation');
  const orientation     = orientationRaw ? String(orientationRaw).trim() : null;

  return {
    id:          String(raw.dbId),
    expressId:   raw.dbId,
    elementType,                              // ← ME_ELEMENT TYPE (ex: 'GD')
    bloc:        get('Res_Bloc', 'BLOC', 'Bloc', 'RES_BLOC') ? String(get('Res_Bloc', 'BLOC', 'Bloc', 'RES_BLOC')).trim() : null,
    zone:        get('ME_ELEMENT ZONE', 'ZONE', 'Zone', 'Res_Zone', 'RES_ZONE') ? String(get('ME_ELEMENT ZONE', 'ZONE', 'Zone', 'Res_Zone', 'RES_ZONE')).trim() : null,
    level:       get('ME_ELEMENT LEVEL') ? String(get('ME_ELEMENT LEVEL')).trim() : null,
    orientation,                               // ← Res_Orientation
    resFamille,                                // ← Res_Famille (filtre Type)
    grue:        toBBFlag(get('Inaccessible')) === 1 ? 'XCMG' : 'GRUE_TOUR',
    ferr:        toBBFlag(get('BB FERR', 'BB_FERR')),
    coul:        toBBFlag(get('BB COULAGE', 'BB_COULAGE')),
    pose:        toBBFlag(get('BB POSE', 'BB_POSE')),
    volume:      parseVolumeValue(get('Volume')),
    statut,
    resEtat,
  };
}

function parseVolumeValue(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  const match = String(v).replace(',', '.').match(/-?\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : 0;
}

function toBBFlag(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v === true || v === 1 || v === '1' || v === '.T.' || v === 'true')  return 1;
  if (v === false || v === 0 || v === '0' || v === '.F.' || v === 'false') return 0;
  return null;
}

function buildLeveesFromElements(elements) {
  const dict = {};
  for (const el of elements) {
    const level = el.level || 'L?';
    const key   = `${el.bloc}|${el.zone}|${level}`;
    if (!dict[key]) dict[key] = { key, bloc: el.bloc, zone: el.zone, orientation: el.orientation, grue: el.grue, level, statuts: [], resEtats: [], resFamilles: [], nb_elements: 0 };
    dict[key].statuts.push(el.statut);
    if (el.resEtat)    dict[key].resEtats.push(el.resEtat);
    if (el.resFamille) dict[key].resFamilles.push(el.resFamille);
    dict[key].nb_elements++;
  }
  return Object.values(dict).map(d => ({
    key:         d.key,
    bloc:        d.bloc,
    zone:        d.zone,
    orientation: d.orientation,
    grue:        d.grue,
    level:       d.level,
    statut:      leveeStatus(d.statuts),
    resEtats:    [...new Set(d.resEtats)],
    resFamilles: [...new Set(d.resFamilles)],
    nb_elements: d.nb_elements,
  }));
}

function leveeStatus(statuts) {
  const n = statuts.length;
  const c = { realise:0, en_cours:0, non_realise:0, non_concerne:0 };
  statuts.forEach(s => c[s] = (c[s]||0)+1);
  if (c.realise === n)   return 'realise';
  if (c.en_cours > 0)    return 'en_cours';
  if (c.non_realise > 0) return 'non_realise';
  return 'non_concerne';
}

function computeStats(levees) {
  const total    = levees.length;
  const byStatut = { realise:0, en_cours:0, non_realise:0, non_concerne:0 };
  const byBloc   = {};
  const byZone   = {};
  const byOrientation = {};
  const byGrue   = {};

  for (const l of levees) {
    byStatut[l.statut] = (byStatut[l.statut]||0) + 1;
    if (l.bloc) {
      if (!byBloc[l.bloc]) byBloc[l.bloc] = { total:0, realise:0, en_cours:0, non_realise:0, non_concerne:0 };
      byBloc[l.bloc].total++;
      byBloc[l.bloc][l.statut] = (byBloc[l.bloc][l.statut]||0) + 1;
    }
    if (l.zone) {
      if (!byZone[l.zone]) byZone[l.zone] = { total:0, realise:0, en_cours:0, non_realise:0, non_concerne:0 };
      byZone[l.zone].total++;
      byZone[l.zone][l.statut] = (byZone[l.zone][l.statut]||0) + 1;
    }
    if (l.orientation) {
      if (!byOrientation[l.orientation]) byOrientation[l.orientation] = { total:0, realise:0, en_cours:0, non_realise:0, non_concerne:0 };
      byOrientation[l.orientation].total++;
      byOrientation[l.orientation][l.statut] = (byOrientation[l.orientation][l.statut]||0) + 1;
    }
    if (l.grue) {
      if (!byGrue[l.grue]) byGrue[l.grue] = { total:0, realise:0, en_cours:0, non_realise:0, non_concerne:0 };
      byGrue[l.grue].total++;
      byGrue[l.grue][l.statut] = (byGrue[l.grue][l.statut]||0) + 1;
    }
  }

  return {
    total, byStatut, byBloc, byZone, byOrientation, byGrue,
    pctGlobal: total > 0 ? Math.round((byStatut.realise / total) * 100) : 0,
  };
}

function applyFilter(type, value) {
  AppState.activeFilter = { type, value };
  const filtered = AppState.allLevees.filter(l => {
    if (type === 'bloc')        return l.bloc === value;
    if (type === 'zone')        return l.zone === value;
    if (type === 'orientation') return l.orientation === value;
    if (type === 'grue')        return l.grue === value;
    if (type === 'statut')      return l.statut === value;
    if (type === 'type')        return (l.resFamilles || []).includes(value);
    if (type === 'etat')        return (l.resEtats || []).includes(value);
    return true;
  });
  AppState.filteredLevees = filtered;
  AppState.filteredStats  = computeStats(filtered);
  const bar = document.getElementById('filterBar');
  const lbl = document.getElementById('filterLabel');
  if (bar) bar.style.display = 'flex';
  if (lbl) lbl.textContent = `Filtre actif : ${type === 'bloc' ? 'Bloc ' : ''}${value}`;
  return AppState.filteredStats;
}

function clearFilter() {
  AppState.activeFilter   = null;
  AppState.filteredLevees = [...AppState.allLevees];
  AppState.filteredStats  = AppState.stats;
  const bar = document.getElementById('filterBar');
  if (bar) bar.style.display = 'none';
}

function getDbIdsForFilter(type, value) {
  return AppState.allElements
    .filter(el => {
      if (type === 'bloc')        return el.bloc === value;
      if (type === 'zone')        return el.zone === value;
      if (type === 'orientation') return el.orientation === value;
      if (type === 'grue')        return el.grue === value;
      if (type === 'statut')      return el.statut === value;
      if (type === 'type')        return el.resFamille === value;
      if (type === 'etat')        return el.resEtat === value;
      return false;
    })
    .map(el => el.expressId || parseInt(el.id))
    .filter(Boolean);
}

function computeActivityStats(elements) {
  let ferrVolume = 0, coulVolume = 0, poseVolume = 0, totalVolume = 0;
  for (const el of elements) {
    const v = el.volume || 0;
    totalVolume += v;
    const effFerr = el.pose === 1 || el.coul === 1 || el.ferr === 1;
    if (effFerr) ferrVolume += v;
    const effCoul = el.pose === 1 || el.coul === 1;
    if (effCoul) coulVolume += v;
    if (el.pose === 1) poseVolume += v;
  }
  const pct = (v) => totalVolume > 0 ? Math.round((v / totalVolume) * 100) : 0;
  return {
    ferr: { label: 'Ferraillage', doneVolume: ferrVolume, totalVolume, pct: pct(ferrVolume) },
    coul: { label: 'Coulage',     doneVolume: coulVolume, totalVolume, pct: pct(coulVolume) },
    pose: { label: 'Pose',        doneVolume: poseVolume, totalVolume, pct: pct(poseVolume) },
  };
}

function computeBlocActivityStats(elements) {
  const byBloc = {};
  for (const el of (elements || [])) {
    if (!el.bloc) continue;
    if (!byBloc[el.bloc]) byBloc[el.bloc] = { ferrVolume:0, coulVolume:0, poseVolume:0, totalVolume:0 };
    const v = el.volume || 0;
    const d = byBloc[el.bloc];
    d.totalVolume += v;
    const effFerr = el.pose === 1 || el.coul === 1 || el.ferr === 1;
    if (effFerr) d.ferrVolume += v;
    const effCoul = el.pose === 1 || el.coul === 1;
    if (effCoul) d.coulVolume += v;
    if (el.pose === 1) d.poseVolume += v;
  }
  const result = {};
  for (const [bloc, d] of Object.entries(byBloc)) {
    const pct = (v) => d.totalVolume > 0 ? Math.round((v / d.totalVolume) * 100) : 0;
    result[bloc] = {
      ferrPct: pct(d.ferrVolume),
      coulPct: pct(d.coulVolume),
      posePct: pct(d.poseVolume),
      totalVolume: d.totalVolume,
    };
  }
  return result;
}

// ── État (Res_État) — stats pour les 5 cartes KPI ─────────────────────────────
function computeEtatStats(elements) {
  const ETATS = ['Levé', 'À lever', 'À modéliser', 'À créer dans le chantier'];
  const byEtat = {};
  ETATS.forEach(e => byEtat[e] = { count: 0, volume: 0 });

  let totalCount = 0, totalVolume = 0;
  for (const el of (elements || [])) {
    totalCount++;
    totalVolume += el.volume || 0;
    if (el.resEtat && byEtat[el.resEtat]) {
      byEtat[el.resEtat].count++;
      byEtat[el.resEtat].volume += el.volume || 0;
    }
  }
  const pct = (c) => totalCount > 0 ? Math.round((c / totalCount) * 100) : 0;

  // "Total" = somme des 4 catégories (Levé + À lever + À modéliser + À créer sur
  // chantier) — n'inclut PAS les éléments sans Res_État du tout.
  const totalRestantCount  = byEtat['Levé'].count  + byEtat['À lever'].count  + byEtat['À modéliser'].count  + byEtat['À créer dans le chantier'].count;
  const totalRestantVolume = byEtat['Levé'].volume + byEtat['À lever'].volume + byEtat['À modéliser'].volume + byEtat['À créer dans le chantier'].volume;

  return {
    total:      { count: totalRestantCount, volume: totalRestantVolume },
    leve:       { count: byEtat['Levé'].count,                    volume: byEtat['Levé'].volume,                    pct: pct(byEtat['Levé'].count) },
    aLever:     { count: byEtat['À lever'].count,                 volume: byEtat['À lever'].volume,                 pct: pct(byEtat['À lever'].count) },
    aModeliser: { count: byEtat['À modéliser'].count,              volume: byEtat['À modéliser'].volume,              pct: pct(byEtat['À modéliser'].count) },
    aCreer:     { count: byEtat['À créer dans le chantier'].count, volume: byEtat['À créer dans le chantier'].volume, pct: pct(byEtat['À créer dans le chantier'].count) },
  };
}
// ── Type (Res_Famille) × Orientation (Res_Orientation) — pour le carousel KPI ──
function computeTypeOrientationStats(elements) {
  const byType = {};
  const byOrientation = {};
  const cross = {}; // cross[type][orientation] = count

  for (const el of (elements || [])) {
    const type = el.resFamille || null;
    const orient = el.orientation || null;
    if (type) byType[type] = (byType[type] || 0) + 1;
    if (orient) byOrientation[orient] = (byOrientation[orient] || 0) + 1;
    if (type && orient) {
      if (!cross[type]) cross[type] = {};
      cross[type][orient] = (cross[type][orient] || 0) + 1;
    }
  }

  const typeList = Object.entries(byType).sort((a, b) => b[1] - a[1]);
  const orientationList = Object.entries(byOrientation).sort((a, b) => b[1] - a[1]);
  const orientationNames = orientationList.map(([name]) => name);

  return { typeList, orientationList, orientationNames, cross };
}

// ── État × Type / État × Orientation — pour la page 3 du carousel KPI ─────────
const ETAT_ORDER = ['Levé', 'À lever', 'À modéliser', 'À créer dans le chantier'];
const ETAT_DOT_COLORS = {
  'Levé': '#22b07d',
  'À lever': '#E87722',
  'À modéliser': '#4A78D9',
  'À créer dans le chantier': '#D93077',
};

function computeEtatCrossStats(elements) {
  const typeCols = new Set();
  const orientCols = new Set();
  const byEtatType = {};
  const byEtatOrient = {};

  for (const el of (elements || [])) {
    const etat = el.resEtat;
    if (!etat || !ETAT_ORDER.includes(etat)) continue;

    if (el.resFamille) {
      typeCols.add(el.resFamille);
      if (!byEtatType[etat]) byEtatType[etat] = {};
      byEtatType[etat][el.resFamille] = (byEtatType[etat][el.resFamille] || 0) + 1;
    }
    if (el.orientation) {
      orientCols.add(el.orientation);
      if (!byEtatOrient[etat]) byEtatOrient[etat] = {};
      byEtatOrient[etat][el.orientation] = (byEtatOrient[etat][el.orientation] || 0) + 1;
    }
  }

  return {
    typeCols: [...typeCols].sort(),
    orientCols: [...orientCols].sort(),
    byEtatType,
    byEtatOrient,
  };
}