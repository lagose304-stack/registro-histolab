// Keep the attempt mounted when browser/system Back traverses this document's
// history. The extra entry has the same URL; confirming exit submits in place.
export function guardQuizNavigation({ window: win, onBack }) {
  const saved = win.history.state?.histolabQuizGuard;
  const previous = saved?.version === 1 ? saved.previous : win.history.state;
  const marker = `quiz-${Date.now()}-${Math.random()}`;
  const state = () => ({ ...previous, histolabQuizGuard: { version: 1, marker, previous } });
  const push = () => win.history.pushState(state(), '', win.location.href);
  // Reuse the same-document entry after StrictMode remounts or a later attempt.
  if (saved?.version === 1) win.history.replaceState(state(), '', win.location.href);
  else push();
  const back = () => { push(); onBack(); };
  win.addEventListener('popstate', back);
  return () => {
    win.removeEventListener('popstate', back);
    // No asynchronous history.back() here: a cleanup/remount must not navigate
    // a new attempt or trigger a spurious exit prompt (React StrictMode).
    if (win.history.state?.histolabQuizGuard?.marker === marker) {
      win.history.replaceState({ ...previous, histolabQuizGuard: { version: 1, marker: null, previous } }, '', win.location.href);
    }
  };
}
