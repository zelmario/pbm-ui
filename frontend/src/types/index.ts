export interface User {
  id: number;
  username: string;
}

export interface PBMInstance {
  id: number;
  name: string;
  mongodb_uri: string;
  pbm_version: string;
  created_at: string;
  updated_at: string;
}

export interface InstanceCreate {
  name: string;
  mongodb_uri: string;
  pbm_version: string;
}

export interface TestResult {
  success: boolean;
  message: string;
  version: string | null;
}

export interface BackupCreate {
  type: string;
  compression?: string;
  compression_level?: number;
  ns?: string;
  profile?: string;
  base?: boolean;
}

export interface RestoreRequest {
  backup_name: string;
  ns?: string;
  ns_from?: string;
  ns_to?: string;
  profile?: string;
  num_parallel_collections?: number;
  num_insertion_workers?: number;
  with_users_and_roles?: boolean;
}

export interface PITRRestoreRequest {
  time: string;
  ns?: string;
  base_snapshot?: string;
  profile?: string;
  with_users_and_roles?: boolean;
}

export interface ConfigSetRequest {
  key: string;
  value: string;
}
