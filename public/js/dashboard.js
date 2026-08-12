/**
 * dashboard.js — Multi-select filters + compact KPI
 */

// État des sélections multi
const MSState = {
  bloc:        new Set(),
  zone:        new Set(),
  orientation: new Set(),
  type:        new Set(),
  etat:        new Set(),
};

document.addEventListener('DOMContentLoaded', async () => {
  const { connected } = await fetch('/api/auth/status').then(r=>r.json());

  if (!connected) {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('dashboardScreen').style.display = 'none';
    const p = new URLSearchParams(window.location.search);
    if (p.get('error')) {
      const el = document.getElementById('loginError');
      el.textContent = 'Erreur : ' + p.get('error');
      el.style.display = 'block';
    }
    return;
  }

  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboardScreen').style.display = 'flex';
  document.getElementById('currentDate').textContent =
    new Date().toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'});

  // Fermer dropdowns au clic extérieur
  document.addEventListener('click', e => {
    if (!e.target.closest('.ms-wrapper')) closeAllDropdowns();
  });

  const jsonLoaded = await loadDataFromJSON();
  if (jsonLoaded && AppState.stats) {
    initCharts(AppState.stats);
    AppState.filteredElements = [...AppState.allElements];
    updateActivityBars(AppState.allElements);
    renderEtatKpis(computeEtatStats(AppState.allElements));
    renderSecteursDeSecteur(computeEtatStats(AppState.allElements));
    renderReservationsParEtat(computeEtatStats(AppState.allElements));
    renderTypeOrientation(AppState.allElements);
    initMultiSelects(AppState.stats);
  }

  await initAPSViewer();
});

window.onViewerReady = async function(viewerInst) {
  // Toujours recharger depuis le viewer et reconstruire les filtres
  await loadDataFromViewer(viewerInst);
  initCharts(AppState.stats);
  AppState.filteredElements = [...AppState.allElements];
  updateActivityBars(AppState.allElements);
  renderEtatKpis(computeEtatStats(AppState.allElements));
  renderSecteursDeSecteur(computeEtatStats(AppState.allElements));
  renderReservationsParEtat(computeEtatStats(AppState.allElements));
  renderTypeOrientation(AppState.allElements);
  // Vider et reconstruire les dropdowns avec les vraies données du viewer
  ['msBlocDrop','msZoneDrop','msOrientationDrop','msTypeDrop','msEtatDrop'].forEach(id => {
    const drop = document.getElementById(id);
    if (drop) drop.innerHTML = '';
  });
  MSState.bloc.clear(); MSState.zone.clear(); MSState.orientation.clear();
  MSState.type.clear(); MSState.etat.clear();
  initMultiSelects(AppState.stats);
};

// ── Multi-select helpers ──────────────────────────────────────────────────────
function buildMultiSelect(containerId, dropId, badgeId, values, labelFn, stateKey) {
  const drop = document.getElementById(dropId);
  if (!drop || drop.querySelector('.ms-option')) return; // already built

  // Tout sélectionner (décoché par défaut = Set vide = tout affiché)
  const allDiv = document.createElement('div');
  allDiv.className = 'ms-select-all';
  allDiv.innerHTML = `<input type="checkbox" id="${dropId}All"> Tout sélectionner`;
  allDiv.querySelector('input').addEventListener('change', function() {
    const chk = this.checked;
    drop.querySelectorAll('.ms-option input').forEach(cb => {
      cb.checked = chk;
      const opt = cb.closest('.ms-option');
      opt?.classList.toggle('checked', chk);
      if (chk) MSState[stateKey].add(cb.value);
      else MSState[stateKey].delete(cb.value);
    });
    if (!chk) MSState[stateKey].clear();
    updateBadge(badgeId, containerId, MSState[stateKey].size);
    onQuickFilter();
  });
  drop.appendChild(allDiv);

  values.forEach(val => {
    const div = document.createElement('div');
    div.className = 'ms-option';
    div.innerHTML = `<input type="checkbox" value="${val}"> ${labelFn(val)}`;
    const cb = div.querySelector('input');
    cb.addEventListener('change', function() {
      if (this.checked) MSState[stateKey].add(val);
      else MSState[stateKey].delete(val);
      div.classList.toggle('checked', this.checked);
      // Update "all" checkbox
      const allCb = drop.querySelector(`#${dropId}All`);
      const totalOptions = drop.querySelectorAll('.ms-option input').length;
      if (allCb) allCb.checked = MSState[stateKey].size === totalOptions;
      updateBadge(badgeId, containerId, MSState[stateKey].size);
      onQuickFilter();
    });
    drop.appendChild(div);
  });
}

function updateBadge(badgeId, wrapperId, count) {
  const badge = document.getElementById(badgeId);
  const btn   = document.querySelector(`#${wrapperId} .ms-btn`);
  if (badge) { badge.style.display = count>0 ? 'inline' : 'none'; if(count>0) badge.textContent = count; }
  if (btn) btn.classList.toggle('active', count>0);
}

window.toggleDropdown = function(wrapperId) {
  const drop = document.querySelector(`#${wrapperId} .ms-dropdown`);
  const isOpen = drop?.classList.contains('open');
  closeAllDropdowns();
  if (!isOpen && drop) drop.classList.add('open');
};

function closeAllDropdowns() {
  document.querySelectorAll('.ms-dropdown.open').forEach(d=>d.classList.remove('open'));
}

function initMultiSelects(stats) {
  // Blocs
  const blocs = Object.keys(stats.byBloc).sort();
  buildMultiSelect('msBloc','msBlocDrop','msBlocBadge', blocs, b=>`Bloc ${b}`, 'bloc');

  // Zones
  const zones = Object.keys(stats.byZone).sort((a, b) => {
  const na = parseInt(a.replace(/\D/g, ''), 10) || 0;
  const nb = parseInt(b.replace(/\D/g, ''), 10) || 0;
  return na - nb;
});
  buildMultiSelect('msZone','msZoneDrop','msZoneBadge', zones, z=>z, 'zone');

  // Orientation (Res_Orientation) — remplace l'ancien filtre Niveau
  const orientations = [...new Set(AppState.allElements.map(e => e.orientation).filter(Boolean))].sort();
  buildMultiSelect('msOrientation','msOrientationDrop','msOrientationBadge', orientations, o=>o, 'orientation');

  // Type (Res_Famille)
  const types = [...new Set(AppState.allElements.map(e => e.resFamille).filter(Boolean))].sort();
  buildMultiSelect('msType','msTypeDrop','msTypeBadge', types, t=>t, 'type');

  // État (Res_État)
  const etats = [...new Set(AppState.allElements.map(e => e.resEtat).filter(Boolean))].sort();
  buildMultiSelect('msEtat','msEtatDrop','msEtatBadge', etats, e=>e, 'etat');

  updateQfCount(AppState.allLevees.length, AppState.allLevees.length);
}

// ── Filtre principal ──────────────────────────────────────────────────────────
window.onQuickFilter = function() {
  const filteredLevees = AppState.allLevees.filter(l => {
    if (MSState.bloc.size>0        && !MSState.bloc.has(l.bloc))                              return false;
    if (MSState.zone.size>0        && !MSState.zone.has(l.zone))                              return false;
    if (MSState.orientation.size>0 && !MSState.orientation.has(l.orientation))                return false;
    if (MSState.type.size>0        && !(l.resFamilles || []).some(f => MSState.type.has(f)))  return false;
    if (MSState.etat.size>0        && !(l.resEtats || []).some(e => MSState.etat.has(e)))     return false;
    return true;
  });

  const filteredStats = computeStats(filteredLevees);
  AppState.filteredStats  = filteredStats;
  AppState.filteredLevees = filteredLevees;

  updateCharts(filteredStats);
  updateQfCount(filteredLevees.length, AppState.allLevees.length);

  // Éléments pour le viewer
  const filteredElements = AppState.allElements.filter(el => {
    if (MSState.bloc.size>0        && !MSState.bloc.has(el.bloc))               return false;
    if (MSState.zone.size>0        && !MSState.zone.has(el.zone))               return false;
    if (MSState.orientation.size>0 && !MSState.orientation.has(el.orientation)) return false;
    if (MSState.type.size>0        && !MSState.type.has(el.resFamille))         return false;
    if (MSState.etat.size>0        && !MSState.etat.has(el.resEtat))            return false;
    return true;
  });

  AppState.filteredElements = filteredElements;
  updateActivityBars(filteredElements, filteredElements);
  renderEtatKpis(computeEtatStats(filteredElements));
  renderSecteursDeSecteur(computeEtatStats(filteredElements));
  renderReservationsParEtat(computeEtatStats(filteredElements));
  renderTypeOrientation(filteredElements);

  const etatActive = MSState.etat.size > 0;
  const hasFilter = MSState.bloc.size>0||MSState.zone.size>0||MSState.orientation.size>0||MSState.type.size>0||etatActive;
  applyViewerFilter(filteredElements, hasFilter, etatActive);
};

function applyViewerFilter(filteredElements, hasFilter, etatActive) {
  if (!viewer || !viewer.model) { console.warn('[Filtre] viewer ou model pas prêt.'); return; }
  if (!hasFilter) {
    viewer.showAll();
    viewer.clearThemingColors(viewer.model);
    viewer.clearSelection();
    coloringApplied = false;
    document.getElementById('btnColor')?.classList.remove('active');
    return;
  }

  const filteredSet = new Set(filteredElements.map(el => parseInt(el.id)).filter(n => !isNaN(n)));
  const allIds     = AppState.allElements.map(el => parseInt(el.id)).filter(n => !isNaN(n));
  const hiddenIds  = allIds.filter(id => !filteredSet.has(id));
  const filteredArr = [...filteredSet];

  console.log(`[Filtre] ${filteredArr.length} élément(s) filtré(s) / ${allIds.length} au total (${hiddenIds.length} rendus transparents).`);

  // Sécurité : si le filtre ne matche AUCUN élément, ne pas vider silencieusement
  // la maquette (ça ressemble à un bug plutôt qu'à "0 résultat"). On avertit en
  // console et on laisse tout affiché pour que ce soit visible qu'il y a un problème.
  if (filteredArr.length === 0) {
    console.warn('[Filtre] Aucun élément ne correspond au filtre actif — la maquette reste affichée en entier.');
    viewer.showAll();
    viewer.clearThemingColors(viewer.model);
    return;
  }

  try {
    // NE PAS utiliser isolate()/hide() : sur ce modèle volumineux (streaming HLOD),
    // ces méthodes désynchronisent le rendu et vident la maquette. À la place, on
    // garde TOUT chargé/visible et on rend les éléments non filtrés quasi transparents
    // (ghosting via couleur override + alpha) — ça ne touche jamais le streaming de
    // géométrie, donc c'est fiable même sur un gros modèle.
    viewer.showAll();
    viewer.clearThemingColors(viewer.model);

    const GHOST_COLOR = new THREE.Vector4(0.4, 0.4, 0.4, 0.02);
    // false = respecter le canal alpha de la couleur → transparence réellement appliquée
    hiddenIds.forEach(id => viewer.setThemingColor(id, GHOST_COLOR, viewer.model, true));

    for (const el of filteredElements) {
      const id = parseInt(el.id);
      if (!isNaN(id)) {
        const color = etatActive ? getEtatAPSColor(el.resEtat) : getAPSColor(el.statut);
        viewer.setThemingColor(id, color, viewer.model, true);
      }
    }
    coloringApplied = true;
    document.getElementById('btnColor')?.classList.add('active');

    if (viewer.impl && viewer.impl.invalidate) {
      viewer.impl.invalidate(true, true, true);
    }
  } catch (err) {
    console.error('[Filtre] Erreur pendant le ghosting/coloration :', err);
  }

// Zoome sur un ensemble de dbIds en ignorant les ~15% les plus isolés (outliers),
// pour éviter que quelques éléments dispersés loin du groupe empêchent tout
// cadrage serré (sinon fitToView() doit englober tout le monde, même les 2-3
// éléments perdus à l'autre bout du bâtiment).
function fitToViewTrimmed(dbIds, trimRatio = 0.15) {
  if (!viewer || !viewer.model || !dbIds.length) return;
  try {
    const it = viewer.model.getData().instanceTree;
    if (!it) { viewer.fitToView(dbIds); return; }

    const box6 = new Float32Array(6);
    const boxes = [];
    for (const id of dbIds) {
      try {
        it.getNodeBox(id, box6);
        const min = new THREE.Vector3(box6[0], box6[1], box6[2]);
        const max = new THREE.Vector3(box6[3], box6[4], box6[5]);
        boxes.push({ min, max, center: min.clone().add(max).multiplyScalar(0.5) });
      } catch (e) { /* dbId sans géométrie, on ignore */ }
    }
    if (!boxes.length) { viewer.fitToView(dbIds); return; }

    // Centroïde de tous les centres
    const centroid = boxes.reduce((acc, b) => acc.add(b.center), new THREE.Vector3())
      .multiplyScalar(1 / boxes.length);

    // Trier par distance au centroïde, garder les plus proches (retire les outliers)
    const sorted = boxes
      .map(b => ({ b, d: b.center.distanceTo(centroid) }))
      .sort((a, b) => a.d - b.d);
    const keepCount = Math.max(1, Math.ceil(sorted.length * (1 - trimRatio)));
    const kept = sorted.slice(0, keepCount).map(x => x.b);

    const box = new THREE.Box3();
    kept.forEach(b => box.union(new THREE.Box3(b.min, b.max)));

    const center = box.getCenter(new THREE.Vector3());
    const size   = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);
    const dist   = maxDim * 1.6;

    const eye = new THREE.Vector3(center.x + dist, center.y - dist, center.z + dist * 0.8);
    if (viewer.navigation && viewer.navigation.setView) {
      viewer.navigation.setRequestTransition(true);
      viewer.navigation.setView(eye, center);
    } else {
      viewer.fitToView(dbIds);
    }
    console.log(`[Filtre] Zoom resserré sur ${kept.length}/${boxes.length} élément(s) (${Math.round(trimRatio*100)}% d'outliers ignorés).`);
  } catch (err) {
    console.error('[Filtre] Erreur fitToViewTrimmed, fallback sur fitToView normal :', err);
    try { viewer.fitToView(dbIds); } catch (e2) {}
  }
}

  // Sélectionner (contour) + zoomer/cadrer sur les éléments filtrés
  try {
    viewer.select(filteredArr);
  } catch (err) {
    console.error('[Filtre] Erreur viewer.select :', err);
  }
  if (filteredArr.length > 0) {
    setTimeout(() => fitToViewTrimmed(filteredArr), 250);
  }
}

// ── Cartes KPI État (Res_État) ──────────────────────────────────────────────
function renderEtatKpis(stats) {
  if (!stats) return;
  const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  const fmt = n => (n || 0).toLocaleString('fr-FR');

  setText('etatTotalNum',      fmt(stats.total.count));
  setText('etatLeveNum',       fmt(stats.leve.count));
  setText('etatALeverNum',     fmt(stats.aLever.count));
  setText('etatAModeliserNum', fmt(stats.aModeliser.count));
  setText('etatACreerNum',     fmt(stats.aCreer.count));
}

function updateQfCount(filtered, total) {
  const el = document.getElementById('qfCount');
  if (!el) return;
  el.textContent = filtered===total
    ? `${total.toLocaleString('fr-FR')} levées`
    : `${filtered.toLocaleString('fr-FR')} / ${total.toLocaleString('fr-FR')} levées`;
  el.style.color = filtered===total?'':'#E87722';
  el.style.fontWeight = filtered===total?'':'600';
}

window.resetQuickFilters = function() {
  ['bloc','zone','orientation','type','etat'].forEach(key => {
    MSState[key].clear();
    const dropId = `ms${key.charAt(0).toUpperCase()+key.slice(1)}Drop`;
    const drop = document.getElementById(dropId);
    if (drop) {
      drop.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked=false);
      drop.querySelectorAll('.ms-option').forEach(o => o.classList.remove('checked'));
    }
    const badgeId = `ms${key.charAt(0).toUpperCase()+key.slice(1)}Badge`;
    const wrapperId = `ms${key.charAt(0).toUpperCase()+key.slice(1)}`;
    updateBadge(badgeId, wrapperId, 0);
  });

  AppState.filteredStats  = AppState.stats;
  AppState.filteredLevees = [...AppState.allLevees];
  updateQfCount(AppState.allLevees.length, AppState.allLevees.length);
  AppState.filteredElements = [...AppState.allElements];
  updateActivityBars(AppState.allElements);
  renderEtatKpis(computeEtatStats(AppState.allElements));
  renderSecteursDeSecteur(computeEtatStats(AppState.allElements));
  renderReservationsParEtat(computeEtatStats(AppState.allElements));
  renderTypeOrientation(AppState.allElements);

if (viewer) {
    viewer.showAll();
    viewer.clearThemingColors(viewer.model);
    viewer.clearSelection();
    coloringApplied = false;
    document.getElementById('btnColor')?.classList.remove('active');
  }
  updateCharts(AppState.stats);
};

// ── Interactions graphes ──────────────────────────────────────────────────────

window.onBlocClick = function(bloc) {
  MSState.bloc.clear();
  const drop = document.getElementById('msBlocDrop');
  if (drop) {
    drop.querySelectorAll('.ms-option input').forEach(cb => {
      const selected = cb.value === bloc;
      cb.checked = selected;
      cb.closest('.ms-option').classList.toggle('checked', selected);
      if (selected) MSState.bloc.add(cb.value);
    });
  }
  updateBadge('msBlocBadge','msBloc', MSState.bloc.size);
  onQuickFilter();
};

window.resetFilters = function() {
  window.resetQuickFilters();
  closeDetail();
};

window.exportPDF = function() {
  document.title = `BIM Dashboard SGTM — ${new Date().toLocaleDateString('fr-FR')}`;
  window.print();
};
// ── Carousel KPI (page État ↔ page Type/Orientation) ──────────────────────────
let kpiCarouselIndex = 0;
const KPI_SLIDE_TITLES = ['SECTEURS DE SECTEUR', 'TYPE & ORIENTATION'];

window.kpiCarouselGo = function(direction) {
  const track = document.getElementById('kpiCarouselTrack');
  if (!track) return;
  const slideCount = track.children.length;
  kpiCarouselIndex = (kpiCarouselIndex + direction + slideCount) % slideCount;
  track.style.transform = `translateX(-${kpiCarouselIndex * (100 / slideCount)}%)`;

  const title = document.getElementById('kpiCarouselTitle');
  if (title) title.textContent = KPI_SLIDE_TITLES[kpiCarouselIndex] || '';

  document.querySelectorAll('#kpiNavDots .kpi-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === kpiCarouselIndex);
  });
};