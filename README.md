# CycleConnect Realtime (Git-ready)

A realtime cycling room app where riders can:
- log in with a **fixed, persistent color**,
- join rooms,
- share live location on a map,
- chat in realtime,
- and draw reroute lines (you → cyclist → destination).

## Tech stack
- Node.js + Express
- Socket.IO
- SQLite (`data/cycleconnect.db` at runtime)
- Leaflet + OpenStreetMap tiles

## Run locally
```bash
npm install
npm start
```
Then open: `http://localhost:3000`

## Git workflow ("turn into git code")
If you want to push this project to your own GitHub repo:

```bash
# in project folder

git init
git add .
git commit -m "Initial CycleConnect realtime app"

git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If this repo already exists and you just want to add updates:

```bash
git add .
git commit -m "Update CycleConnect features"
git push
```

## Main files
- `server.js` — API + Socket.IO events + room state + persistence logic.
- `public/index.html` — login, room controls, chat, reroute panel, map layout.
- `public/script.js` — realtime location/chat/map updates and reroute drawing.
- `public/style.css` — responsive UI styling and cyclist legend placement.

## Notes
- Cyclist color is fixed by username via SQLite.
- The local DB file is ignored from git (`.gitignore`).
