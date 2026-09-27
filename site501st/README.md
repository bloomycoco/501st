# Site 501st

Site statique (HTML/CSS pur, sans dépendance) reconstitué à partir du site Google Sites officiel de la 501st Légion d'Attaque, prêt à être publié sur GitHub Pages.

## Structure

- `index.html` — Accueil
- `planning.html` — Planning des activités
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
- **PDF** : "Guide du CT 501st-1-1.pdf" (page Accueil CT) et "501e Legion - Guide du commandant de mission-7.pdf" (page Commandement) sont référencés mais pas hébergés ; à ajouter dans un dossier `assets/documents/` et à lier.
- Les pages de spécialisation pointent vers les sites Google Sites externes d'origine (Soldat, Heavy, Médecin, ARF, Torrent, ARC Trooper) ; leur contenu n'a pas été rapatrié ici.

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
