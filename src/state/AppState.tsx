import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CloudDemoRepository, probeCloud, type CloudStatus } from "../data/cloudRepository";
import { loadCredentials, newSessionToken, saveCredential } from "../data/credentials";
import { LocalDemoRepository } from "../data/localRepository";
import type { DemoRepository, SessionCredential, Storage } from "../data/types";

export type AppMode = "live" | "demo";

const MODE_KEY = "nightsignal.mode.v1";
const ONBOARDED_KEY = "nightsignal.onboarded.v1";

type AppContextValue = {
  ready: boolean;
  onboarded: boolean;
  completeOnboarding: () => Promise<void>;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  cloud: CloudStatus;
  recheckCloud: () => void;
  credentials: SessionCredential[];
  repoFor: (storage: Storage) => DemoRepository | null;
  startDemoSession: (label: string) => Promise<SessionCredential>;
};

const AppContext = createContext<AppContextValue | null>(null);
const localRepository = new LocalDemoRepository();

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [mode, setModeState] = useState<AppMode>("live");
  const [cloud, setCloud] = useState<CloudStatus>({ state: "checking" });
  const [cloudRepository, setCloudRepository] = useState<CloudDemoRepository | null>(null);
  const [credentials, setCredentials] = useState<SessionCredential[]>([]);

  useEffect(() => {
    void (async () => {
      const [storedMode, storedOnboarded, creds] = await Promise.all([
        AsyncStorage.getItem(MODE_KEY),
        AsyncStorage.getItem(ONBOARDED_KEY),
        loadCredentials(),
      ]);
      if (storedMode === "demo" || storedMode === "live") setModeState(storedMode);
      setOnboarded(storedOnboarded === "yes");
      setCredentials(creds);
      setReady(true);
    })();
  }, []);

  const applyProbe = useCallback(() => {
    void probeCloud().then(({ status, client }) => {
      setCloud(status);
      setCloudRepository(client ? new CloudDemoRepository(client) : null);
    });
  }, []);

  useEffect(applyProbe, [applyProbe]);

  const recheckCloud = useCallback(() => {
    setCloud({ state: "checking" });
    applyProbe();
  }, [applyProbe]);

  const setMode = useCallback((next: AppMode) => {
    setModeState(next);
    void AsyncStorage.setItem(MODE_KEY, next);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "yes");
    setOnboarded(true);
  }, []);

  const repoFor = useCallback(
    (storage: Storage): DemoRepository | null => (storage === "cloud" ? cloudRepository : localRepository),
    [cloudRepository],
  );

  const startDemoSession = useCallback(
    async (label: string) => {
      const repository: DemoRepository = cloudRepository ?? localRepository;
      const token = newSessionToken();
      const id = await repository.startSession(label, token);
      const cred: SessionCredential = { id, token, storage: repository.storage, createdAt: Date.now() };
      await saveCredential(cred);
      setCredentials((previous) => [cred, ...previous.filter((c) => c.id !== id)]);
      return cred;
    },
    [cloudRepository],
  );

  const value = useMemo(
    () => ({ ready, onboarded, completeOnboarding, mode, setMode, cloud, recheckCloud, credentials, repoFor, startDemoSession }),
    [ready, onboarded, completeOnboarding, mode, setMode, cloud, recheckCloud, credentials, repoFor, startDemoSession],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
