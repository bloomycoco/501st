// Sauvegarde quotidienne des donnees Firestore (effectif + rapports + config)
// directement dans le depot Git, sous backups/. Lance chaque nuit par
// .github/workflows/daily-backup.yml. Lecture publique (allow read: if true),
// aucun secret necessaire.

import { writeFile, mkdir } from "node:fs/promises";

const PROJECT_ID = "site501st";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function decodeValue(v) {
  if (v == null) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("doubleValue" in v) return v.doubleValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
  return v;
}

function decodeFields(fields) {
  const out = {};
  for (const k of Object.keys(fields || {})) out[k] = decodeValue(fields[k]);
  return out;
}

async function fetchCollection(name) {
  const out = [];
  let pageToken;
  do {
    const url = new URL(`${BASE}/${name}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${name}: HTTP ${res.status} ${await res.text()}`);
    const data = await res.json();
    for (const doc of data.documents || []) {
      out.push({ id: doc.name.split("/").pop(), data: decodeFields(doc.fields || {}) });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function main() {
  const effectif = await fetchCollection("effectif");
  const rapports = await fetchCollection("rapports");

  const backup = {
    generatedAt: new Date().toISOString(),
    effectif,
    rapports
  };

  const dateStr = new Date().toISOString().slice(0, 10);
  await mkdir("backups", { recursive: true });
  await writeFile(`backups/${dateStr}.json`, JSON.stringify(backup, null, 2), "utf-8");
  await writeFile("backups/latest.json", JSON.stringify(backup, null, 2), "utf-8");

  console.log(`Sauvegarde ecrite : ${effectif.length} membre(s), ${rapports.length} rapport(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
