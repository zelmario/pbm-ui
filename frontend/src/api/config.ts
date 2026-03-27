import api from "./client";
import type { ConfigSetRequest } from "../types";

export async function getConfig(instanceId: number) {
  const res = await api.get(`/instances/${instanceId}/config`);
  return res.data;
}

export async function setConfig(instanceId: number, data: ConfigSetRequest) {
  const res = await api.put(`/instances/${instanceId}/config`, data);
  return res.data;
}

export async function setConfigBulk(
  instanceId: number,
  settings: Record<string, string>
) {
  const res = await api.put(`/instances/${instanceId}/config/bulk`, {
    settings,
  });
  return res.data;
}

export async function resyncConfig(instanceId: number) {
  const res = await api.post(`/instances/${instanceId}/config/resync`, {});
  return res.data;
}
