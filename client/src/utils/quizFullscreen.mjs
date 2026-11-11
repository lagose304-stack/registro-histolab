export const hasQuizFullscreen = doc => Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);

export async function enterQuizFullscreen(doc) {
  if (hasQuizFullscreen(doc)) return true;
  const element = doc.documentElement;
  const request = element.requestFullscreen || element.webkitRequestFullscreen;
  if (!request) return false;
  try {
    await request.call(element);
    return hasQuizFullscreen(doc);
  } catch {
    return false;
  }
}
