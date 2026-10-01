// Relais des entretiens de recrutement CT ASP vers Discord.
// Lance regulierement par .github/workflows/relay-recruitment-webhook.yml.
// Lit les documents "recrutements" non encore relayes (notified == false)
// via l'API REST Firestore (lecture publique), poste un message Discord
// pour chacun, puis les marque comme relayes.

const PROJECT_ID = "site501st";
const DB_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const OWNER_HASH = "d5f1931f04a5b2082a63363cf9c3f24d182fc4d4a3fdff69a4b8f1a3442c33b6";

const THEMES = [
  ["motivation", "🎯 Motivation"],
  ["role", "🪖 Vision du rôle"],
  ["discipline", "⚖️ Discipline"],
  ["tir", "🔫 Exercice de tir"],
  ["fin", "🏁 Fin d'entretien"]
];

const EMBED_COLOR = 0x5b7cff;

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

function buildEmbed(fields) {
  const recruteur = fieldStr(fields, "recruteur") || "?";
  const aspirant = fieldStr(fields, "aspirant") || "?";
  const observation = fieldStr(fields, "observation");
  const submittedAt = fieldStr(fields, "submittedAt");
  const ratings = fieldMap(fields, "ratings");

  const embedFields = [
    { name: "🪖 Recruteur", value: recruteur, inline: true },
    { name: "🎖️ CT ASP", value: aspirant, inline: true }
  ];

  for (const [key, label] of THEMES) {
    const r = fieldMap(ratings, key);
    const note = fieldNum(r, "note");
    const notes = fieldStr(r, "notes");
    embedFields.push({
      name: label,
      value: `${note || "-"}/5${notes ? `\n${notes}` : ""}`,
      inline: true
    });
  }

  if (observation) {
    embedFields.push({ name: "📝 Observation finale", value: observation.slice(0, 1000), inline: false });
  }

  const embed = {
    title: "📝 Nouvel entretien de recrutement CT ASP",
    color: EMBED_COLOR,
    fields: embedFields,
    footer: { text: "501st Légion d'Attaque" }
  };
  if (submittedAt) embed.timestamp = submittedAt;
  return embed;
}

async function postToDiscord(webhookUrl, embed) {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ embeds: [embed] })
  });
  if (!res.ok) throw new Error(`Discord webhook failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const webhookUrl = process.env.DISCORD_RECRUITMENT_WEBHOOK_URL;
  if (!webhookUrl) throw new Error("Variable DISCORD_RECRUITMENT_WEBHOOK_URL manquante.");

  const pending = await findPendingInterviews();
  console.log(`${pending.length} entretien(s) en attente de relais.`);

  for (const row of pending) {
    const embed = buildEmbed(row.fields);
    await postToDiscord(webhookUrl, embed);
    await markNotified(row.id);
    console.log(`Relayé : ${row.id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
