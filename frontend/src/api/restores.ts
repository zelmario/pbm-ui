import api from "./client";

export async function startRestore(
  instanceId: number,
  data: { backup_name: string }
) {
  const res = await api.post(`/instances/${instanceId}/restores`, data);
  return res.data;
}

export async function pitrRestore(
  instanceId: number,
  data: { time: string }
) {
  const res = await api.post(`/instances/${instanceId}/restores/pitr`, data);
  return res.data;
}

export async function listRestores(instanceId: number) {
  const res = await api.get(`/instances/${instanceId}/restores`);
  return res.data;
}

export async function describeRestore(instanceId: number, name: string) {
  const res = await api.get(`/instances/${instanceId}/restores/${name}`);
  return res.data;
}
