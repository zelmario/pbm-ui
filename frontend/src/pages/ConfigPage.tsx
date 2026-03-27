import { useState, useEffect } from "react";
import {
  Title,
  Stack,
  Alert,
  Card,
  Button,
  Group,
  TextInput,
  Select,
  Switch,
  NumberInput,
  Loader,
  Tabs,
  Text,
  Code,
  Divider,
  SimpleGrid,
  Badge,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconRefresh,
  IconDeviceFloppy,
  IconDatabase,
  IconClock,
  IconArchive,
  IconRestore,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import { getConfig, setConfig, resyncConfig } from "../api/config";

export function ConfigPage() {
  const { selectedId } = useInstance();
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["config", selectedId],
    queryFn: () => getConfig(selectedId!),
    enabled: !!selectedId,
  });

  // Storage state
  const [storageType, setStorageType] = useState("");
  const [fsPath, setFsPath] = useState("");
  const [s3Bucket, setS3Bucket] = useState("");
  const [s3Region, setS3Region] = useState("");
  const [s3Endpoint, setS3Endpoint] = useState("");
  const [s3AccessKey, setS3AccessKey] = useState("");
  const [s3SecretKey, setS3SecretKey] = useState("");
  const [s3Prefix, setS3Prefix] = useState("");

  // PITR state
  const [pitrEnabled, setPitrEnabled] = useState(false);
  const [pitrCompression, setPitrCompression] = useState("");
  const [pitrOplogSpan, setPitrOplogSpan] = useState<number | "">("");

  // Backup state
  const [backupCompression, setBackupCompression] = useState("");
  const [backupCompressionLevel, setBackupCompressionLevel] = useState<number | "">("");

  // Restore state
  const [restoreBatchSize, setRestoreBatchSize] = useState<number | "">("");
  const [restoreWorkers, setRestoreWorkers] = useState<number | "">("");
  const [restoreParallel, setRestoreParallel] = useState<number | "">("");

  // Populate form from config
  useEffect(() => {
    if (!config) return;
    // Storage
    setStorageType(config.storage?.type || "");
    setFsPath(config.storage?.filesystem?.path || "");
    setS3Bucket(config.storage?.s3?.bucket || "");
    setS3Region(config.storage?.s3?.region || "");
    setS3Endpoint(config.storage?.s3?.endpointUrl || "");
    setS3AccessKey(config.storage?.s3?.credentials?.["access-key-id"] || "");
    setS3SecretKey("");
    setS3Prefix(config.storage?.s3?.prefix || "");
    // PITR
    setPitrEnabled(config.pitr?.enabled || false);
    setPitrCompression(config.pitr?.compression || "s2");
    setPitrOplogSpan(config.pitr?.oplogSpanMin || "");
    // Backup
    setBackupCompression(config.backup?.compression || "s2");
    setBackupCompressionLevel(config.backup?.compressionLevel || "");
    // Restore
    setRestoreBatchSize(config.restore?.batchSize || "");
    setRestoreWorkers(config.restore?.numInsertionWorkers || "");
    setRestoreParallel(config.restore?.numParallelCollections || "");
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: async (settings: Record<string, string>) => {
      const results: string[] = [];
      const errors: string[] = [];
      for (const [key, value] of Object.entries(settings)) {
        if (value !== "" && value !== undefined) {
          try {
            await setConfig(selectedId!, { key, value });
            results.push(key);
          } catch (err: any) {
            errors.push(`${key}: ${err.response?.data?.detail || err.message}`);
          }
        }
      }
      if (errors.length > 0) {
        throw new Error(errors.join("\n"));
      }
      return results;
    },
    onSuccess: async (keys) => {
      // Refetch config and wait for it so the form updates
      await queryClient.refetchQueries({ queryKey: ["config", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
      notifications.show({
        title: "Saved",
        message: `Updated ${keys.length} setting(s): ${keys.join(", ")}`,
        color: "green",
      });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  const resyncMutation = useMutation({
    mutationFn: () => resyncConfig(selectedId!),
    onSuccess: () => {
      notifications.show({ title: "Resync", message: "Storage resync initiated", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["config", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const compressionOptions = [
    { value: "s2", label: "S2 (default)" },
    { value: "gzip", label: "Gzip" },
    { value: "snappy", label: "Snappy" },
    { value: "lz4", label: "LZ4" },
    { value: "pgzip", label: "Pgzip" },
    { value: "zstd", label: "Zstandard" },
  ];

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Configuration</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">Select a PBM instance first.</Alert>
      </Stack>
    );
  }

  if (isLoading) return <Stack align="center" mt="xl"><Loader /><Text c="dimmed">Loading config...</Text></Stack>;
  if (error) return <Alert color="red">{(error as Error).message}</Alert>;

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Configuration</Title>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => resyncMutation.mutate()}
            loading={resyncMutation.isPending}
          >
            Force Resync
          </Button>
        </Group>
      </Group>

      <Tabs defaultValue="storage">
        <Tabs.List>
          <Tabs.Tab value="storage" leftSection={<IconDatabase size={16} />}>Storage</Tabs.Tab>
          <Tabs.Tab value="pitr" leftSection={<IconClock size={16} />}>PITR</Tabs.Tab>
          <Tabs.Tab value="backup" leftSection={<IconArchive size={16} />}>Backup</Tabs.Tab>
          <Tabs.Tab value="restore" leftSection={<IconRestore size={16} />}>Restore</Tabs.Tab>
          <Tabs.Tab value="raw">Raw JSON</Tabs.Tab>
        </Tabs.List>

        {/* Storage */}
        <Tabs.Panel value="storage" pt="md">
          <Card withBorder p="lg">
            <Stack>
              <Group>
                <Text fw={500}>Current Storage</Text>
                <Badge variant="light">{config?.storage?.type || "Not configured"}</Badge>
              </Group>

              <Select
                label="Storage Type"
                data={[
                  { value: "filesystem", label: "Filesystem" },
                  { value: "s3", label: "S3 / MinIO" },
                  { value: "gcs", label: "Google Cloud Storage" },
                  { value: "azure", label: "Azure Blob Storage" },
                ]}
                value={storageType}
                onChange={(v) => setStorageType(v || "")}
              />

              {storageType === "filesystem" && (
                <TextInput
                  label="Path"
                  placeholder="/data/backups"
                  value={fsPath}
                  onChange={(e) => setFsPath(e.currentTarget.value)}
                  description="Must be accessible from all PBM agents (e.g. NFS mount)"
                />
              )}

              {storageType === "s3" && (
                <>
                  <SimpleGrid cols={2}>
                    <TextInput
                      label="Bucket"
                      placeholder="my-backup-bucket"
                      value={s3Bucket}
                      onChange={(e) => setS3Bucket(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Region"
                      placeholder="us-east-1"
                      value={s3Region}
                      onChange={(e) => setS3Region(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Endpoint URL (MinIO/custom)"
                      placeholder="https://minio.example.com"
                      value={s3Endpoint}
                      onChange={(e) => setS3Endpoint(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Prefix"
                      placeholder="backups/"
                      value={s3Prefix}
                      onChange={(e) => setS3Prefix(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Access Key ID"
                      value={s3AccessKey}
                      onChange={(e) => setS3AccessKey(e.currentTarget.value)}
                    />
                    <TextInput
                      label="Secret Access Key"
                      type="password"
                      placeholder={config?.storage?.s3?.credentials?.["access-key-id"] ? "****" : ""}
                      value={s3SecretKey}
                      onChange={(e) => setS3SecretKey(e.currentTarget.value)}
                      description="Leave empty to keep current value"
                    />
                  </SimpleGrid>
                </>
              )}

              <Divider />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saveMutation.isPending}
                onClick={() => {
                  const settings: Record<string, string> = {};
                  settings["storage.type"] = storageType;
                  if (storageType === "filesystem") {
                    if (fsPath) settings["storage.filesystem.path"] = fsPath;
                  }
                  if (storageType === "s3") {
                    if (s3Bucket) settings["storage.s3.bucket"] = s3Bucket;
                    if (s3Region) settings["storage.s3.region"] = s3Region;
                    if (s3Endpoint) settings["storage.s3.endpointUrl"] = s3Endpoint;
                    if (s3Prefix) settings["storage.s3.prefix"] = s3Prefix;
                    if (s3AccessKey) settings["storage.s3.credentials.access-key-id"] = s3AccessKey;
                    if (s3SecretKey) settings["storage.s3.credentials.secret-access-key"] = s3SecretKey;
                  }
                  saveMutation.mutate(settings);
                }}
              >
                Save Storage Settings
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* PITR */}
        <Tabs.Panel value="pitr" pt="md">
          <Card withBorder p="lg">
            <Stack>
              <Switch
                label="Enable PITR"
                description="Continuously capture oplog for point-in-time recovery"
                checked={pitrEnabled}
                onChange={(e) => setPitrEnabled(e.currentTarget.checked)}
                size="md"
              />
              <Select
                label="Compression"
                data={compressionOptions}
                value={pitrCompression}
                onChange={(v) => setPitrCompression(v || "s2")}
              />
              <NumberInput
                label="Oplog Span (minutes)"
                description="How often to save an oplog slice. Default: 10 minutes."
                placeholder="10"
                min={1}
                value={pitrOplogSpan}
                onChange={(val) => setPitrOplogSpan(val === "" ? "" : Number(val))}
              />
              <Divider />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saveMutation.isPending}
                onClick={() => {
                  const settings: Record<string, string> = {
                    "pitr.enabled": String(pitrEnabled),
                    "pitr.compression": pitrCompression,
                  };
                  if (pitrOplogSpan !== "") {
                    settings["pitr.oplogSpanMin"] = String(pitrOplogSpan);
                  }
                  saveMutation.mutate(settings);
                }}
              >
                Save PITR Settings
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Backup */}
        <Tabs.Panel value="backup" pt="md">
          <Card withBorder p="lg">
            <Stack>
              <Select
                label="Default Compression"
                data={compressionOptions}
                value={backupCompression}
                onChange={(v) => setBackupCompression(v || "s2")}
              />
              <NumberInput
                label="Compression Level"
                min={0}
                max={10}
                placeholder="Default"
                value={backupCompressionLevel}
                onChange={(val) => setBackupCompressionLevel(val === "" ? "" : Number(val))}
              />
              <Divider />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saveMutation.isPending}
                onClick={() => {
                  const settings: Record<string, string> = {
                    "backup.compression": backupCompression,
                  };
                  if (backupCompressionLevel !== "") {
                    settings["backup.compressionLevel"] = String(backupCompressionLevel);
                  }
                  saveMutation.mutate(settings);
                }}
              >
                Save Backup Settings
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Restore */}
        <Tabs.Panel value="restore" pt="md">
          <Card withBorder p="lg">
            <Stack>
              <NumberInput
                label="Batch Size"
                description="Number of documents per batch during restore. Default: 500."
                placeholder="500"
                min={1}
                value={restoreBatchSize}
                onChange={(val) => setRestoreBatchSize(val === "" ? "" : Number(val))}
              />
              <NumberInput
                label="Insertion Workers"
                description="Concurrent workers per collection. Default: 10."
                placeholder="10"
                min={1}
                value={restoreWorkers}
                onChange={(val) => setRestoreWorkers(val === "" ? "" : Number(val))}
              />
              <NumberInput
                label="Parallel Collections"
                description="Number of collections to restore in parallel. Default: CPU/2."
                placeholder="Auto"
                min={1}
                value={restoreParallel}
                onChange={(val) => setRestoreParallel(val === "" ? "" : Number(val))}
              />
              <Divider />
              <Button
                leftSection={<IconDeviceFloppy size={16} />}
                loading={saveMutation.isPending}
                onClick={() => {
                  const settings: Record<string, string> = {};
                  if (restoreBatchSize !== "") settings["restore.batchSize"] = String(restoreBatchSize);
                  if (restoreWorkers !== "") settings["restore.numInsertionWorkers"] = String(restoreWorkers);
                  if (restoreParallel !== "") settings["restore.numParallelCollections"] = String(restoreParallel);
                  saveMutation.mutate(settings);
                }}
              >
                Save Restore Settings
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Raw JSON */}
        <Tabs.Panel value="raw" pt="md">
          <Code block style={{ maxHeight: 600, overflow: "auto" }}>
            {JSON.stringify(config, null, 2)}
          </Code>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
