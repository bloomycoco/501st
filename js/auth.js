// Authentification par code partagee entre officiers.html, effectif.html et
// rapport.html : verification du code (officier/owner), persistance locale
// (pour ne pas ressaisir le code a chaque page/rechargement), et reset global
// par epoch (le bouton Owner invalide instantanement toutes les sessions
// deja ouvertes, partout, sans toucher au code lui-meme).

const STORAGE_KEY = "site501st_auth";

export const OWNER_HASH = "d5f1931f04a5b2082a63363cf9c3f24d182fc4d4a3fdff69a4b8f1a3442c33b6";

export async function sha256(text) {
  var data = new TextEncoder().encode(text);
  var hashBuffer = await crypto.subtle.digest("SHA-256", data);
  var bytes = Array.from(new Uint8Array(hashBuffer));
  return bytes.map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
}

export function loadSession() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    if (parsed && parsed.role && parsed.hash && parsed.epoch != null) return parsed;
  } catch (e) {}
  return null;
}

export function saveSession(role, hash, epoch) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: role, hash: hash, epoch: epoch }));
  } catch (e) {}
}

export function clearSession() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

// Lit config/access (officerCodeHash + authEpoch). Cree le champ authEpoch a
// la volee (valeur "1") s'il n'existe pas encore, sans ecrire (juste une valeur
// par defaut cote client) pour rester compatible avec les documents existants.
export async function readAccessConfig(getDocFn, accessDocRef) {
  var snap = await getDocFn(accessDocRef);
  var data = snap.exists() ? snap.data() : {};
  return {
    officerCodeHash: data.officerCodeHash || null,
    authEpoch: data.authEpoch != null ? String(data.authEpoch) : "1"
  };
}

// Tente de restaurer une session persistee si son epoch correspond toujours
// a l'epoch courant en base. Renvoie {role, hash} ou null.
export function tryRestoreSession(config) {
  var saved = loadSession();
  if (!saved) return null;
  if (String(saved.epoch) !== String(config.authEpoch)) return null;
  if (saved.hash === OWNER_HASH) return { role: "owner", hash: saved.hash };
  if (config.officerCodeHash && saved.hash === config.officerCodeHash) return { role: "officier", hash: saved.hash };
  return null;
}

// Verifie un code saisi contre le hash Owner (fixe) ou le hash Officier
// (dynamique, lu dans config/access). Renvoie {role, hash} ou null.
export async function verifyCode(config, code) {
  var normalized = code.trim().toUpperCase();
  var hash = await sha256(normalized);
  if (hash === OWNER_HASH) return { role: "owner", hash: hash };
  if (config.officerCodeHash && hash === config.officerCodeHash) return { role: "officier", hash: hash };
  return null;
}

// Bouton Owner "Reinitialiser les acces" : change authEpoch, ce qui invalide
// toutes les sessions persistees (y compris celle d'Owner) sur tous les
// appareils, sans changer le code officier lui-meme.
export async function resetAllSessions(setDocFn, accessDocRef, currentOfficerCodeHash) {
  var newEpoch = String(Date.now());
  await setDocFn(accessDocRef, {
    officerCodeHash: currentOfficerCodeHash || null,
    ownerCodeHash: OWNER_HASH,
    authEpoch: newEpoch
  });
  clearSession();
  return newEpoch;
}

// Petit bouton flottant en bas a droite, visible uniquement pour Owner.
export function mountOwnerResetButton(onClick) {
  if (document.getElementById("owner-reset-fab")) return document.getElementById("owner-reset-fab");
  var btn = document.createElement("button");
  btn.id = "owner-reset-fab";
  btn.title = "Réinitialiser les accès de tout le monde (Owner)";
  btn.textContent = "🔄";
  btn.className = "owner-reset-fab";
  btn.style.right = "20px";
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  return btn;
}

// Second bouton flottant (a cote du reset), telecharge une sauvegarde JSON
// complete (effectif + rapports + config) directement sur l'appareil de
// l'utilisateur. Rien n'est envoye a un service tiers.
export function mountOwnerBackupButton(onClick) {
  if (document.getElementById("owner-backup-fab")) return document.getElementById("owner-backup-fab");
  var btn = document.createElement("button");
  btn.id = "owner-backup-fab";
  btn.title = "Télécharger une sauvegarde complète (Owner)";
  btn.textContent = "💾";
  btn.className = "owner-reset-fab";
  btn.style.right = "78px";
  btn.addEventListener("click", onClick);
  document.body.appendChild(btn);
  return btn;
}

function decodeFirestoreValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return decodeFirestoreFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeFirestoreValue);
  return v;
}

function decodeFirestoreFields(fields) {
  var out = {};
  Object.keys(fields || {}).forEach(function (k) { out[k] = decodeFirestoreValue(fields[k]); });
  return out;
}

async function fetchCollectionPlain(projectId, collectionName) {
  var out = [];
  var pageToken;
  do {
    var url = "https://firestore.googleapis.com/v1/projects/" + projectId + "/databases/(default)/documents/" + collectionName + "?pageSize=300" + (pageToken ? "&pageToken=" + pageToken : "");
    var res = await fetch(url);
    if (!res.ok) throw new Error(collectionName + " : HTTP " + res.status);
    var data = await res.json();
    (data.documents || []).forEach(function (d) {
      out.push({ id: d.name.split("/").pop(), data: decodeFirestoreFields(d.fields || {}) });
    });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// Construit une sauvegarde JSON complete (effectif + rapports) et la
// declenche en telechargement dans le navigateur. Aucune donnee n'est
// envoyee ailleurs que sur l'appareil de la personne qui clique.
export async function downloadFullBackup(projectId) {
  var effectif = await fetchCollectionPlain(projectId, "effectif");
  var rapports = await fetchCollectionPlain(projectId, "rapports");
  var backup = {
    generatedAt: new Date().toISOString(),
    effectif: effectif,
    rapports: rapports
  };
  var blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  var url = URL.createObjectURL(blob);
  var a = document.createElement("a");
  a.href = url;
  a.download = "backup-501st-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return backup;
}
