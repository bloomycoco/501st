# Site 501st

Site statique (HTML/CSS pur, sans dépendance) reconstitué à partir du site Google Sites officiel de la 501st Légion d'Attaque, prêt à être publié sur GitHub Pages.

## Structure

- `index.html` — Accueil
- `doc-accueil-ct.html`, `doc-reglement.html`, `doc-securite-incendie.html`, `doc-commandement.html`, `doc-rapport-hebdo.html` — Documents utiles
- `codex-tactique.html`, `codex-vehicules.html` — Codex Tactique
- `specialisation.html`, `spe-soldat.html`, `spe-heavy.html`, `spe-medecin.html`, `spe-arf.html`, `spe-torrent.html`, `spe-arc-trooper.html` — Spécialisations
- `tenues.html` — Tenues 501st
- `bareme-promotion.html` — Barème de promotion
- `recrutement.html` — Recrutement
- `css/style.css` — Feuille de style commune

## À compléter

- **Effectif** : le lien vers la feuille Google Sheets d'effectif n'a pas pu être récupéré automatiquement (lien "#" dans la barre de navigation de chaque page). À renseigner manuellement.
- **Recrutement** : le bouton du formulaire Google Forms est un lien "#" à remplacer par l'URL réelle.
- **Guide du commandant de mission** : "501e Legion - Guide du commandant de mission-7.pdf" (page Commandement) est référencé mais pas hébergé ; à ajouter dans `assets/` et à lier, comme fait pour `assets/guide-ct/` (Guide du CT).
- **ARF** : le contenu de cette spécialisation est dans un Google Doc privé, non récupérable automatiquement ; le texte reste à fournir.

## Publier sur GitHub Pages

```bash
git init
git add .
git commit -m "Site 501st"
git branch -M main
git remote add origin <URL_DU_DEPOT_GITHUB>
git push -u origin main
```

Puis dans les paramètres du dépôt GitHub : **Settings → Pages → Source : branche `main`, dossier `/ (root)`**.

Site en ligne : https://bloomycoco.github.io/501st/
