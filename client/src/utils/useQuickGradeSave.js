import { useEffect, useRef, useState } from "react";
import { createQuickGradeSaver } from "./quickGradeSave.mjs";

export function useQuickGradeSave({ storageKey, api, onConfirmed }) {
  const [state, setState] = useState({ pending: null, saving: false, error: "" });
  const saverRef = useRef(null), confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;
  useEffect(() => {
    let storage;
    try { storage = window.localStorage; } catch {}
    const saver = createQuickGradeSaver({ key: storageKey, storage, send: (id, payload) => api.calificar(id, payload), onConfirmed: (...args) => confirmedRef.current(...args) });
    saverRef.current = saver;
    setState(saver.snapshot());
    const unsubscribe = saver.subscribe(setState);
    const retry = () => { void saver.run(); };
    const warn = event => { if (saver.snapshot().pending) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("online", retry);
    window.addEventListener("beforeunload", warn);
    retry();
    return () => { unsubscribe(); saver.dispose(); window.removeEventListener("online", retry); window.removeEventListener("beforeunload", warn); if (saverRef.current === saver) saverRef.current = null; };
  }, [storageKey, api]);
  return { ...state,
    prepare: details => {
      if (!saverRef.current) throw new Error("Espera a que se prepare el guardado.");
      return saverRef.current.prepare(details);
    },
    retry: () => saverRef.current?.run()
  };
}
