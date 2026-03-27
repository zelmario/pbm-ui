import api from "./client";
import type { User } from "../types";

export async function login(
  username: string,
  password: string
): Promise<string> {
  const res = await api.post("/auth/login", { username, password });
  return res.data.access_token;
}

export async function getMe(): Promise<User> {
  const res = await api.get("/auth/me");
  return res.data;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await api.post("/auth/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}
