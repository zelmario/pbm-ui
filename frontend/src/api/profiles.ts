import api from "./client";

export async function listProfiles(instanceId: number) {
  const res = await api.get(`/instances/${instanceId}/profiles`);
  return res.data;
}

export async function showProfile(instanceId: number, name: string) {
  const res = await api.get(`/instances/${instanceId}/profiles/${name}`);
  return res.data;
}

export async function addProfile(
  instanceId: number,
  name: string,
  configYaml: string
) {
  const res = await api.post(`/instances/${instanceId}/profiles`, {
    name,
    config_yaml: configYaml,
  });
  return res.data;
}

export async function removeProfile(instanceId: number, name: string) {
  const res = await api.delete(`/instances/${instanceId}/profiles/${name}`);
  return res.data;
}

export async function syncProfiles(
  instanceId: number,
  name?: string,
  all = false
) {
  const res = await api.post(`/instances/${instanceId}/profiles/sync`, {
    name,
    all,
  });
  return res.data;
}
