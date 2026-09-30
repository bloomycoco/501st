// Verification hebdomadaire du quota de rapports + reset des compteurs.
// Lance chaque lundi matin par le workflow .github/workflows/weekly-report-check.yml
// Ne necessite aucun serveur : lit/ecrit directement Firestore via son API REST,
// et poste une alerte Discord si des membres n'ont pas atteint leur quota.

const PROJECT_ID = "site501st";
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_HASH = "d5f1931f04a5b2082a63363cf9c3f24d182fc4d4a3fdff69a4b8f1a3442c33b6";
const WEEKLY_REPORT_MIN = 1;

const GRADE_RANK = {
  ALPHA: 0, EM: 1, MR: 2,
  CMDM: 3, GNL: 4, CMD: 5, CMDJ: 5, VCMD: 6, MJR: 7,
  CPT: 8, "CPT-2nd": 9, LTN: 10, "2nd-LTN": 11,
  "ADJ-C": 12, ADJ: 13, "SGT-C": 14, SGT: 15,
  "CPL-C": 16, CPL: 17, CT: 18
};

function isReportExempt(grade) {
  const rank = GRADE_RANK[grade];
  return rank !== undefined && rank <= GRADE_RANK["CPT-2nd"];
}

function fieldStr(fields, name) {
  return fields && fields[name] && fields[name].stringValue !== undefined ? fields[name].stringValue : "";
}

function fieldNum(fields, name) {
  if (!fields || !fields[name]) return 0;
  const f = fields[name];
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  if (f.stringValue !== undefined) return parseFloat(f.stringValue) || 0;
  return 0;
}

async function listAllEffectif() {
  const docs = [];
  let pageToken;
  do {
    const url = new URL(`${BASE}/effectif`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Firestore list failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

async function resetReportCount(docId) {
  const url = `${BASE}/effectif/${docId}?updateMask.fieldPaths=reportCount&updateMask.fieldPaths=codeHash`;
  const body = { fields: { reportCount: { doubleValue: 0 }, codeHash: { stringValue: OWNER_HASH } } };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Reset failed for ${docId}: ${res.status} ${await res.text()}`);
}

async function findUnarchivedRejectedReports() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "rapports" }],
      where: { fieldFilter: { field: { fieldPath: "status" }, op: "EQUAL", value: { stringValue: "rejected" } } }
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`runQuery failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows
    .filter((r) => r.document)
    .map((r) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields || {} }))
    .filter((r) => !(r.fields.archived && r.fields.archived.booleanValue === true));
}

async function archiveReport(docId) {
  const url = `${BASE}/rapports/${docId}?updateMask.fieldPaths=archived&updateMask.fieldPaths=codeHash`;
  const body = { fields: { archived: { booleanValue: true }, codeHash: { stringValue: OWNER_HASH } } };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`Archive failed for ${docId}: ${res.status} ${await res.text()}`);
}

async function postDiscordAlert(webhookUrl, roleId, offenders) {
  const lines = offenders.map(
    (o) => `- **${o.rpName}** (${o.matricule || "sans matricule"}, ${o.grade}) : ${o.reportCount}/${WEEKLY_REPORT_MIN} rapport(s)`
  );
  const content =
    `<@&${roleId}> **Quota de rapports hebdomadaires non atteint**\n` +
    `Les membres suivants n'ont pas rempli leur quota de rapport cette semaine :\n\n` +
    lines.join("\n");

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, allowed_mentions: { roles: [roleId] } })
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const roleId = process.env.DISCORD_OFFICER_ROLE_ID;
  if (!webhookUrl || !roleId) throw new Error("Variables d'environnement DISCORD_WEBHOOK_URL / DISCORD_OFFICER_ROLE_ID manquantes.");

  const docs = await listAllEffectif();
  console.log(`Effectif : ${docs.length} membre(s) trouvé(s).`);

  const offenders = [];
  for (const doc of docs) {
    const f = doc.fields || {};
    const grade = fieldStr(f, "grade");
    if (isReportExempt(grade)) continue;
    const reportCount = fieldNum(f, "reportCount");
    if (reportCount < WEEKLY_REPORT_MIN) {
      offenders.push({
        rpName: fieldStr(f, "rpName") || "(sans nom)",
        matricule: fieldStr(f, "matricule"),
        grade: grade || "?",
        reportCount
      });
    }
  }

  console.log(`${offenders.length} membre(s) sous le quota de rapports.`);
  if (offenders.length > 0) {
    await postDiscordAlert(webhookUrl, roleId, offenders);
    console.log("Alerte Discord envoyée.");
  } else {
    console.log("Personne sous le quota, pas d'alerte a envoyer.");
  }

  let resetCount = 0;
  for (const doc of docs) {
    const docId = doc.name.split("/").pop();
    await resetReportCount(docId);
    resetCount++;
  }
  console.log(`Compteur de rapports remis a zero pour ${resetCount} membre(s).`);

  const rejectedReports = await findUnarchivedRejectedReports();
  for (const report of rejectedReports) {
    await archiveReport(report.id);
  }
  console.log(`${rejectedReports.length} rapport(s) refusé(s) archivé(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
