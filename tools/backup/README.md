# SwitchNest Repo Backup (offsite)

Private GitHub repo (`robosphere99/switch_v2`) ka automatic weekly backup:

1. **Mirror fetch** — incremental git mirror (`tools/backup/mirror/`) — har baar sirf naye commits aate hain
2. **Clean source ZIP** — `git archive` se poora repo (`.git` / `node_modules` nahi) → `tools/backup/snapshots/switch_v2-<date>-<sha8>.zip` + manifest JSON
3. **GitHub Release** — zip ko private release me upload (tag `backup/YYYY-MM-DD`) — yehi **offsite copy** hai (GitHub pe, local machine se bahar)
4. **Retention** — local last 8 zips, remote last 12 releases (purane auto-delete)

## Chalane ke tarike

| Tarika | Kya karta hai |
|---|---|
| `run-backup-now.bat` | Abhi ek baar backup (manual) |
| `start-weekly-backup.bat` | Har 7 din loop (window khuli rehni chahiye) |
| `install-backup-task.bat` | **Recommended** — Windows Task Scheduler, har Sunday 3:00 AM, koi window nahi chahiye |

CLI:
```
node tools\backup\backup-repo.mjs --once            # ek baar
node tools\backup\backup-repo.mjs                   # abhi + har 7 din
node tools\backup\backup-repo.mjs --keep 8 --releases 12
```

## Auth

- `GITHUB_TOKEN` env variable ho to use hota hai
- Warna **git credential manager** se stored credentials (same token jo `git push` karta hai)
- Token me `repo` scope chahiye (releases banane ke liye)

## Restore kaise karein

1. GitHub → repo → **Releases** tab → `backup/YYYY-MM-DD` → zip download karo
2. Ya locally: `tools/backup/snapshots/` me latest zip
3. Zip kholo → `switch_v2-<sha8>/` folder → usko fresh clone ki jagah use karo
4. `npm install` → `.env` banao → `npm run db:generate` (Prisma) → site chalana

## Logs

`tools/backup/logs/backup.log` — har run ka record (mirror, zip size, release URL, prune).
