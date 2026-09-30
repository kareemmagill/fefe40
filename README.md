# FEFE40

A block-style 3D party for Filip's 40th at Casa Anahao (Tanauan, Batangas) on 10 October.

Live at **https://kareemmagill.github.io/fefe40/**, on phones and computers.

## What guests do

The villa builds itself as blocks drop from the sky (tap to skip). Then:

1. Tap **Enter the party**. Step 1: take a selfie with the front camera (or pick a photo) and type a name.
2. Step 2: the photo becomes a 32 × 32 pixel face on a Minecraft-style avatar. The page guesses a male or female look from the photo; one tap switches it. Arrows flip through 20 Swedish-themed outfits.
3. **OK, drop me in** drops the avatar at the entrance. Tapping anywhere, or a place button along the bottom, walks the avatar there.
4. Once an avatar stops somewhere it gets up to something, depending on the place and who else is there: disco moves or a conga line on the dance floor, pool games, skål at the Viking bar, karaoke, pickleball rallies with spectators, pillow fights, a queue for the loo, and more.
5. In any bedroom, a **Change outfit** button opens the wardrobe.
6. The guest list (top left) shows everyone who has joined. Guests online right now are marked **Live** and move in real time; everyone else loops the walk they recorded. Entering again from the same phone starts that guest's recording over.
7. The moon button switches to night: the disco ball throws light, lamps come on around the dining pavilion and bedrooms, and the replays change. Day and night are separate loops, so whatever a guest does after dark is only replayed for people viewing at night (a guest who never went out at night replays their day walk).

It's an 18+ party. The outfit screen has a **Cheeky mode (18+)** switch, off by default: only guests who turn it on join the adults-only gags.
The photo never leaves the phone: only the name, the 32 × 32 face, the outfit, the walk and (while online) the current position are shared.

## Files

- `index.html`: page layout and styles
- `app.js`: the voxel villa, build-in animation, lights, camera and controls, walking, recording and sharing
- `avatar.js`: avatar builder, the 20 outfits and the props they hold
- `actions.js`: what avatars do in each area, by headcount, look and Cheeky mode
- `database.rules.json`: rules for the shared guest database

## Sharing guests between phones

Guests are shared through a Firebase Realtime Database using its REST API, so only the database URL is needed (no keys). Records live under `fefe40/guests`, their version stamps under `fefe40/index`, and live positions under `fefe40/live`.
Paste the rules from `database.rules.json` into the database's **Rules** tab, then set `DB_URL` near the top of the party section in `app.js`.
While `DB_URL` is empty the party runs solo: everything works, but each phone only sees its own avatar.

Room layout is approximate, built from the venue's public listing and photos.
