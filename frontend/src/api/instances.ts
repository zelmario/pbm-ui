import api from "./client";
import type { PBMInstance, InstanceCreate, TestResult } from "../types";

export async function listInstances(): Promise<PBMInstance[]> {
  const res = await api.get("/instances");
  return res.data;
}

export async function createInstance(
  data: InstanceCreate
): Promise<PBMInstance> {
  const res = await api.post("/instances", data);
  return res.data;
}

export async function updateInstance(
  id: number,
  data: Partial<InstanceCreate>
): Promise<PBMInstance> {
  const res = await api.put(`/instances/${id}`, data);
  return res.data;
}

export async function deleteInstance(id: number): Promise<void> {
  await api.delete(`/instances/${id}`);
}

export async function testInstance(id: number): Promise<TestResult> {
  const res = await api.post(`/instances/${id}/test`);
  return res.data;
}

export async function downloadTroubleshoot(id: number): Promise<void> {
  const res = await api.get(`/instances/${id}/troubleshoot`, {
    responseType: "blob",
  });
  const disposition = res.headers["content-disposition"] || "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : `pbm_troubleshoot_${id}.zip`;

  const url = URL.createObjectURL(res.data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
