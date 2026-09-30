# FEFE40

A block-style 3D party for Filip's 40th at Casa Anahao (Tanauan, Batangas) on 10 October.

Live at **https://kareemmagill.github.io/fefe40/**, on phones and computers.

## What guests do

1. Tap **Enter the party**, take a selfie with the front camera (or pick a photo) and type their name.
2. The photo becomes a 16 × 16 pixel face on a Minecraft-style avatar. The page guesses a male or female look from the photo; one tap switches it.
3. Arrows flip through 20 Swedish-themed outfits (Tre Kronor jersey, Midsommar dress, Lucia gown, Kräftskiva bib and more).
4. **OK, drop me in** drops the avatar at the entrance. Tapping anywhere, or a place in the list, walks the avatar there.
5. Every walk is recorded. Everyone who has joined loops their recorded walk for later visitors. Entering again from the same phone starts that guest's recording over.

The photo never leaves the phone: only the name, the 16 × 16 face, the outfit and the walk are shared.

## Files

- `index.html`: page layout and styles
- `app.js`: the voxel villa, camera and controls, walking, recording and sharing
- `avatar.js`: avatar builder and the 20 outfits
- `database.rules.json`: rules for the shared guest database

## Sharing guests between phones

Guests are shared through a Firebase Realtime Database using its REST API, so only the database URL is needed (no keys).
Paste the rules from `database.rules.json` into the database's **Rules** tab, then set `DB_URL` near the top of the party section in `app.js`.
While `DB_URL` is empty the party runs solo: everything works, but each phone only sees its own avatar.

Room layout is approximate, built from the venue's public listing and photos.
