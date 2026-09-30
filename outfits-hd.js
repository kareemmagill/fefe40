/* FEFE40 outfits at full voxel detail. Each part below adds, per outfit name, painters that use every voxel of the new
   avatar (see avatar.js: shirtHD 16 x 24 front, sleeveHD rows 0-21 with the hand in 18-21, legHD 6 x 24 with shoes in
   rows 22-23, skirt fnHD, hatHD / extrasHD / heldHD in half skin pixels). Outfits without an entry keep their old,
   doubled-up look. */
(function () {
  const HD = (window.FefeOutfitsHD = window.FefeOutfitsHD || {});
  // (outfit parts go here)
  if (window.FefeAvatar) FefeAvatar.OUTFITS.forEach((o) => { if (HD[o.name]) Object.assign(o, HD[o.name]); });
})();
