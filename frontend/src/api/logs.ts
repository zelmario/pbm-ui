import api from "./client";

export async function getLogs(
  instanceId: number,
  params?: {
    tail?: number;
    severity?: string;
    event?: string;
    node?: string;
  }
) {
  const res = await api.get(`/instances/${instanceId}/logs`, { params });
  return res.data;
}

export async function getStatus(instanceId: number) {
  const res = await api.get(`/instances/${instanceId}/status`);
  return res.data;
}
