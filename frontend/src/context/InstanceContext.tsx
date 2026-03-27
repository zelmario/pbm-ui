import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { listInstances } from "../api/instances";
import type { PBMInstance } from "../types";

interface InstanceState {
  instances: PBMInstance[];
  selectedId: number | null;
  selected: PBMInstance | null;
  select: (id: number | null) => void;
  refetch: () => void;
  isLoading: boolean;
}

const InstanceContext = createContext<InstanceState>(null!);

export function InstanceProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const stored = localStorage.getItem("selectedInstanceId");
    return stored ? Number(stored) : null;
  });

  const {
    data: instances = [],
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["instances"],
    queryFn: listInstances,
  });

  const select = useCallback((id: number | null) => {
    setSelectedId(id);
    if (id) {
      localStorage.setItem("selectedInstanceId", String(id));
    } else {
      localStorage.removeItem("selectedInstanceId");
    }
  }, []);

  const selected = instances.find((i) => i.id === selectedId) ?? null;

  return (
    <InstanceContext.Provider
      value={{ instances, selectedId, selected, select, refetch, isLoading }}
    >
      {children}
    </InstanceContext.Provider>
  );
}

export function useInstance() {
  return useContext(InstanceContext);
}
