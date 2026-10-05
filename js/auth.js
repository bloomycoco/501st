// Session et appels serveur partagés par les pages du site.
// Les codes ne sont jamais vérifiés dans le navigateur : on envoie le code
// au serveur (/login), qui renvoie un jeton signé. Toutes les écritures
// passent par le serveur avec ce jeton.

export const API = "https://recrutement-501st-relay.site501st-relay-worker.workers.dev";
const SESSION_KEY = "site501st_session";

export function getSession() {
  try {
    var raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setSession(session) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (e) {}
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}

export async function login(code) {
  var res = await fetch(API + "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: code })
  });
  if (!res.ok) return null;
  var session = await res.json();
  setSession(session);
  return session;
}

// Renvoie le rôle ("owner", "officier", "instructeur") si la session est
// encore valide côté serveur, sinon null (et la session locale est effacée).
export async function currentRole() {
  var session = getSession();
  if (!session || !session.token) return null;
  var res = await fetch(API + "/whoami", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: session.token })
  });
  if (!res.ok) {
    clearSession();
    return null;
  }
  var data = await res.json();
  return data.role;
}

export async function callServer(path, body) {
  var session = getSession();
  var res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({}, body, { token: session ? session.token : null }))
  });
  var text = await res.text();
  var data = null;
  try { data = JSON.parse(text); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401) clearSession();
    throw new Error((data && data.error) || text || ("Erreur " + res.status));
  }
  return data;
}

export async function submitPublic(path, body) {
  var res = await fetch(API + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  var data = await res.json().catch(function () { return null; });
  if (!res.ok) throw new Error((data && data.error) || ("Erreur " + res.status));
  return data;
}

// Petit bouton flottant en bas à droite, visible uniquement pour Owner.
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

// Sauvegarde JSON complète (lecture publique), téléchargée sur l'appareil.
export async function downloadFullBackup(projectId) {
  var effectif = await fetchCollectionPlain(projectId, "effectif");
  var rapports = await fetchCollectionPlain(projectId, "rapports");
  var backup = { generatedAt: new Date().toISOString(), effectif: effectif, rapports: rapports };
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
