// Relais des entretiens de recrutement CT ASP vers Discord.
// Lance regulierement par .github/workflows/relay-recruitment-webhook.yml.
// Lit les documents "recrutements" non encore relayes (notified == false)
// via l'API REST Firestore (lecture publique), poste un message Discord
// pour chacun, puis les marque comme relayes.

const PROJECT_ID = "site501st";
const DB_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_HASH = "d5f1931f04a5b2082a63363cf9c3f24d182fc4d4a3fdff69a4b8f1a3442c33b6";

const THEMES = [
  ["presentation", "Présentation du soldat"],
  ["motivation", "Motivation pour rejoindre la 501st"],
  ["role", "Vision du rôle d'un clone"],
  ["discipline", "Discipline militaire"],
  ["escouade", "Esprit d'escouade"],
  ["tir", "Exercice de tir"],
  ["progression", "Vision de sa progression"],
  ["fin", "Questions de fin d'entretien"]
];

function fieldStr(fields, name) {
  return fields && fields[name] && fields[name].stringValue !== undefined ? fields[name].stringValue : "";
}

function fieldNum(fields, name) {
  if (!fields || !fields[name]) return 0;
  const f = fields[name];
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.integerValue !== undefined) return Number(f.integerValue);
  return 0;
}

function fieldMap(fields, name) {
  return fields && fields[name] && fields[name].mapValue ? fields[name].mapValue.fields || {} : {};
}

async function findPendingInterviews() {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "recrutements" }],
      where: { fieldFilter: { field: { fieldPath: "notified" }, op: "EQUAL", value: { booleanValue: false } } }
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
    .map((r) => ({ id: r.document.name.split("/").pop(), fields: r.document.fields || {} }));
}

async function markNotified(docId) {
  const url = `${DB_BASE}/recrutements/${docId}?updateMask.fieldPaths=notified&updateMask.fieldPaths=codeHash`;
  const body = { fields: { notified: { booleanValue: true }, codeHash: { stringValue: OWNER_HASH } } };
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`markNotified failed for ${docId}: ${res.status} ${await res.text()}`);
}

function buildMessage(fields) {
  const recruteur = fieldStr(fields, "recruteur") || "?";
  const aspirant = fieldStr(fields, "aspirant") || "?";
  const observation = fieldStr(fields, "observation");
  const ratings = fieldMap(fields, "ratings");

  const lines = THEMES.map(([key, label]) => {
    const r = fieldMap(ratings, key);
    const note = fieldNum(r, "note");
    const notes = fieldStr(r, "notes");
    return `**${label}** : ${note || "-"}/5${notes ? ` (notes : ${notes})` : ""}`;
  });

  let content =
    `📝 **Nouvel entretien de recrutement CT ASP**\n` +
    `Recruteur : **${recruteur}**\n` +
    `CT ASP : **${aspirant}**\n\n` +
    lines.join("\n");

  if (observation) content += `\n\n**Observation finale :** ${observation}`;
  if (content.length > 1900) content = content.slice(0, 1900) + "...";
  return content;
}

async function postToDiscord(webhookUrl, content) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const webhookUrl = process.env.DISCORD_RECRUITMENT_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("Variable DISCORD_RECRUITMENT_WEBHOOK_URL manquante.");

  const pending = await findPendingInterviews();
  console.log(`${pending.length} entretien(s) en attente de relais.`);

  for (const row of pending) {
    const content = buildMessage(row.fields);
    await postToDiscord(webhookUrl, content);
    await markNotified(row.id);
    console.log(`Relayé : ${row.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
