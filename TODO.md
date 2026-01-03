# TODO

Tracking incomplete work for The Heaviest Objects in the Universe.

---

*Last updated: 2026-01-02*

## Future Work

### Mobile Pass

Desktop-first, but mobile should work. Current gaps:

#### Teaching Book on Mobile
- Add as bottom sheet (like MobileUpgradeSheet)
- Same tab structure, same Canvas2D animations
- Trigger: floating `?` button in top bar

#### Ghost Hand for Mobile
- Swap cursor icon → finger/tap icon
- Same animation timing and behavior
- Just visual change to match touch paradigm

#### Remove Action Bar, Use Double-Tap
- Current: tap to select → action bar appears → tap action button
- Better: double-tap performs action directly (faster, more intuitive)
- Ghost hand animation needs mobile variant showing double-tap gesture
- Keep single-tap for selection (shows info, enables drag for symlinks)

#### Conflict Resolution Touch Target
- Don't require selecting the wire itself
- The prune icon (✕) on conflicted wires IS the tap target
- Larger hit area, more forgiving on touch
- Ghost hand should point to the icon, not the wire

#### Tap to go back vs back icon for Mobile default
- Need to decide
