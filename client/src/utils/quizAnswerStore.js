export function createQuizAnswerStore(initialAnswers) {
  let answers = initialAnswers;
  const listeners = new Set();

  return {
    read: () => answers,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    replace(nextAnswers) {
      answers = nextAnswers;
      for (const listener of listeners) listener();
    }
  };
}
