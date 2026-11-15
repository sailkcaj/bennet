import { useEffect, useState } from "react";
import type { SessionCredential, SessionSnapshot } from "../data/types";
import { useApp } from "./AppState";

type Result = { cred: SessionCredential | null; snapshot: SessionSnapshot | null; error: string | null };

export function useSessionSnapshot(cred: SessionCredential | null) {
  const { repoFor } = useApp();
  const [result, setResult] = useState<Result>({ cred: null, snapshot: null, error: null });
  const repository = cred ? repoFor(cred.storage) : null;

  useEffect(() => {
    if (!cred || !repository) return;
    return repository.watchSession(cred, (snapshot, error) => setResult({ cred, snapshot, error: error ?? null }));
  }, [cred, repository]);

  const current = result.cred === cred ? result : { snapshot: null, error: null };
  const error = cred && !repository ? "Cloud sync unavailable — this cloud session cannot be loaded right now." : current.error;
  return { snapshot: current.snapshot, error, repository };
}
