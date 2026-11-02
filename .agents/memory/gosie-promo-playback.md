---
name: Gosie promo playback
description: Keep Gosie's promotional video poster visible before user-initiated playback.
---

For Gosie's inline promo, render a static poster with a clear, accessible play control and only mount the video player after activation. Do not rely on an image layered above an already-mounted idle player.

**Why:** In both the browser video element and Expo's web video surface, an idle/loading video could cover the poster with a spinner or black layer, even when preloading was disabled.

**How to apply:** Keep the no-play state static and light; once activated, show player controls and start playback within that user gesture. Recheck both the marketing-site and Expo previews.
