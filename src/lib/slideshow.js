// Cancelling also invalidates an image that is still loading, so it cannot
// replace a visitor's chosen slide after they pause or leave the carousel.
export function createSlideshow({ advance, onChange, reducedMotion = false, delay = 7000 }) {
  let enabled = !reducedMotion;
  let timer;
  let pending;
  let generation = 0;
  const blockers = new Set(['offscreen']);

  function schedule() {
    const version = ++generation;
    clearTimeout(timer);
    pending?.abort();
    pending = undefined;
    if (!enabled || blockers.size) return;
    timer = setTimeout(async () => {
      const request = new AbortController();
      pending = request;
      try { await advance(request.signal); }
      finally { if (version === generation) schedule(); }
    }, delay);
  }

  function setEnabled(value) {
    enabled = value;
    schedule();
    onChange(enabled);
  }

  onChange(enabled);
  return {
    get enabled() { return enabled; },
    play() { setEnabled(true); },
    pause() { setEnabled(false); },
    setBlocked(reason, blocked) {
      if (blockers.has(reason) === blocked) return;
      if (blocked) blockers.add(reason); else blockers.delete(reason);
      schedule();
    },
    setReducedMotion(value) {
      // Turning reduced motion off should not override a deliberate pause.
      if (value) setEnabled(false);
    },
    destroy() { enabled = false; schedule(); },
  };
}
