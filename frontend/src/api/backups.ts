import api from "./client";
import type { BackupCreate } from "../types";

export async function listBackups(instanceId: number) {
  const res = await api.get(`/instances/${instanceId}/backups`);
  return res.data;
}

export async function createBackup(instanceId: number, data: BackupCreate) {
  const res = await api.post(`/instances/${instanceId}/backups`, data);
  return res.data;
}

export async function describeBackup(instanceId: number, name: string) {
  const res = await api.get(`/instances/${instanceId}/backups/${name}`);
  return res.data;
}

export async function deleteBackup(instanceId: number, name: string) {
  const res = await api.delete(`/instances/${instanceId}/backups/${name}`);
  return res.data;
}

export async function cancelBackup(instanceId: number) {
  const res = await api.post(`/instances/${instanceId}/backups/cancel`);
  return res.data;
}

export async function cleanup(
  instanceId: number,
  olderThan: string,
  dryRun = false
) {
  const res = await api.post(`/instances/${instanceId}/cleanup`, {
    older_than: olderThan,
    dry_run: dryRun,
  });
  return res.data;
}
