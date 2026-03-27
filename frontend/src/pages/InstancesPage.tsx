import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Title,
  Stack,
  Card,
  SimpleGrid,
  Text,
  Badge,
  Group,
  Button,
  Modal,
  TextInput,
  ActionIcon,
  Tooltip,
  Alert,
  Divider,
  Loader,
} from "@mantine/core";
import {
  IconPlus,
  IconTrash,
  IconPlugConnected,
  IconServer,
  IconEdit,
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconPlayerPlay,
  IconClock,
  IconRefresh,
  IconFileZip,
} from "@tabler/icons-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import {
  createInstance,
  deleteInstance,
  testInstance,
  updateInstance,
  downloadTroubleshoot,
} from "../api/instances";
import { getStatus } from "../api/logs";
import type { InstanceCreate, TestResult } from "../types";

function maskUri(uri: string): string {
  try {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:****@");
  } catch {
    return uri;
  }
}

function StatusSummary({ instanceId }: { instanceId: number }) {
  const { data: status, isLoading, isError, error } = useQuery({
    queryKey: ["instance-status", instanceId],
    queryFn: () => getStatus(instanceId),
    refetchInterval: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Group gap="xs" mt="sm">
        <Loader size={14} />
        <Text size="xs" c="dimmed">Loading status...</Text>
      </Group>
    );
  }

  if (isError) {
    return (
      <Alert color="red" variant="light" mt="sm" p="xs">
        <Text size="xs">{(error as any)?.response?.data?.detail || "Cannot fetch status"}</Text>
      </Alert>
    );
  }

  if (!status) return null;

  // Parse cluster nodes
  const cluster = status.cluster || [];
  let totalNodes = 0;
  let healthyNodes = 0;
  const nodeErrors: string[] = [];

  for (const rs of cluster) {
    for (const node of rs.nodes || []) {
      totalNodes++;
      if (node.ok) {
        healthyNodes++;
      } else {
        nodeErrors.push(`${node.host}: ${node.errmsg || "not OK"}`);
      }
    }
  }

  const allHealthy = healthyNodes === totalNodes && totalNodes > 0;

  // PITR status
  const pitrConf = status.pitr?.conf;
  const pitrRun = status.pitr?.run;

  // Running operation
  const running = status.running;
  const hasRunning = running?.type;

  // Storage info
  const storage = status.backups;
  const storageType = storage?.type;

  return (
    <Stack gap={6} mt="sm">
      <Divider />

      {/* Node health */}
      <Group gap="xs">
        {allHealthy ? (
          <IconCheck size={14} color="var(--mantine-color-green-6)" />
        ) : totalNodes === 0 ? (
          <IconAlertTriangle size={14} color="var(--mantine-color-yellow-6)" />
        ) : (
          <IconX size={14} color="var(--mantine-color-red-6)" />
        )}
        <Text size="xs">
          Nodes: {healthyNodes}/{totalNodes} healthy
        </Text>
      </Group>

      {/* Node errors */}
      {nodeErrors.map((err, i) => (
        <Text key={i} size="xs" c="red" pl="md">
          {err}
        </Text>
      ))}

      {/* PITR */}
      <Group gap="xs">
        <IconClock size={14} color={pitrRun ? "var(--mantine-color-green-6)" : "var(--mantine-color-dimmed)"} />
        <Text size="xs">
          PITR: {pitrConf ? (pitrRun ? "Running" : "Enabled, not running") : "Disabled"}
        </Text>
      </Group>

      {/* Running operation */}
      {hasRunning && (
        <Group gap="xs">
          <IconPlayerPlay size={14} color="var(--mantine-color-blue-6)" />
          <Text size="xs" c="blue">
            {running.type}{running.name ? `: ${running.name}` : ""}
          </Text>
        </Group>
      )}

      {/* Storage */}
      {storageType && (
        <Group gap="xs">
          <IconServer size={14} color="var(--mantine-color-dimmed)" />
          <Text size="xs" c="dimmed">
            Storage: {storageType}
            {storage?.path ? ` (${storage.path})` : ""}
            {storage?.s3?.bucket ? ` (${storage.s3.bucket})` : ""}
          </Text>
        </Group>
      )}
    </Stack>
  );
}

export function InstancesPage() {
  const { instances, select } = useInstance();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({});
  const [testing, setTesting] = useState<Record<number, boolean>>({});
  const [downloading, setDownloading] = useState<Record<number, boolean>>({});

  const [name, setName] = useState("");
  const [mongoUri, setMongoUri] = useState("");
  const [pbmVersion, setPbmVersion] = useState("2.7.0");

  const resetForm = () => {
    setName("");
    setMongoUri("");
    setPbmVersion("2.7.0");
    setEditId(null);
  };

  const openCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const openEdit = (inst: any) => {
    setEditId(inst.id);
    setName(inst.name);
    setMongoUri(inst.mongodb_uri);
    setPbmVersion(inst.pbm_version);
    setFormOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (data: InstanceCreate) => createInstance(data),
    onSuccess: () => {
      notifications.show({ title: "Created", message: "Instance added", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      setFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InstanceCreate>) => updateInstance(editId!, data),
    onSuccess: () => {
      notifications.show({ title: "Updated", message: "Instance updated", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["instances"] });
      setFormOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteInstance(id),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Instance removed", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["instances"] });
    },
  });

  const handleTest = async (id: number) => {
    setTesting((prev) => ({ ...prev, [id]: true }));
    try {
      const result = await testInstance(id);
      setTestResults((prev) => ({ ...prev, [id]: result }));
      notifications.show({
        title: result.success ? "Connected" : "Failed",
        message: result.success ? `PBM ${result.version}` : result.message,
        color: result.success ? "green" : "red",
      });
    } catch (err: any) {
      notifications.show({ title: "Error", message: err.message, color: "red" });
    } finally {
      setTesting((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleTroubleshoot = async (id: number) => {
    setDownloading((prev) => ({ ...prev, [id]: true }));
    try {
      await downloadTroubleshoot(id);
      notifications.show({ title: "Downloaded", message: "Troubleshoot bundle ready", color: "green" });
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    } finally {
      setDownloading((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleSubmit = () => {
    const data: InstanceCreate = { name, mongodb_uri: mongoUri, pbm_version: pbmVersion };
    if (editId) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const refreshAllStatuses = () => {
    for (const inst of instances) {
      queryClient.invalidateQueries({ queryKey: ["instance-status", inst.id] });
    }
  };

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>PBM Instances</Title>
        <Group gap="xs">
          {instances.length > 0 && (
            <Tooltip label="Refresh all statuses">
              <ActionIcon variant="light" onClick={refreshAllStatuses}>
                <IconRefresh size={16} />
              </ActionIcon>
            </Tooltip>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
            Add Instance
          </Button>
        </Group>
      </Group>

      {instances.length === 0 && (
        <Alert color="blue">
          No instances configured yet. Add one to get started.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {instances.map((inst) => (
          <Card key={inst.id} shadow="sm" padding="lg" radius="md" withBorder>
            <div
              style={{ cursor: "pointer" }}
              onClick={() => {
                select(inst.id);
                navigate("/");
              }}
            >
              <Group justify="space-between" mb="xs">
                <Group>
                  <IconServer size={20} />
                  <Text fw={500}>{inst.name}</Text>
                </Group>
                <Badge color="blue" variant="light">v{inst.pbm_version}</Badge>
              </Group>

              <Text size="xs" c="dimmed" lineClamp={1} ff="monospace">
                {maskUri(inst.mongodb_uri)}
              </Text>

              {testResults[inst.id] && (
                <Badge
                  color={testResults[inst.id].success ? "green" : "red"}
                  variant="light"
                  mt="xs"
                  fullWidth
                >
                  {testResults[inst.id].success
                    ? `Connected - ${testResults[inst.id].version}`
                    : testResults[inst.id].message}
                </Badge>
              )}

              <StatusSummary instanceId={inst.id} />
            </div>

            <Group mt="md" gap="xs">
              <Tooltip label="Get Troubleshooting Files">
                <ActionIcon
                  variant="light"
                  color="orange"
                  loading={downloading[inst.id]}
                  onClick={() => handleTroubleshoot(inst.id)}
                >
                  <IconFileZip size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label={testing[inst.id] ? "Testing..." : "Test Connection"}>
                <ActionIcon
                  variant="light"
                  color="green"
                  loading={testing[inst.id]}
                  onClick={() => handleTest(inst.id)}
                >
                  <IconPlugConnected size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Edit">
                <ActionIcon variant="light" onClick={() => openEdit(inst)}>
                  <IconEdit size={16} />
                </ActionIcon>
              </Tooltip>
              <Tooltip label="Delete">
                <ActionIcon
                  variant="light"
                  color="red"
                  onClick={() => {
                    if (confirm(`Delete instance "${inst.name}"?`)) {
                      deleteMutation.mutate(inst.id);
                    }
                  }}
                >
                  <IconTrash size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Modal
        opened={formOpen}
        onClose={() => { setFormOpen(false); resetForm(); }}
        title={editId ? "Edit Instance" : "Add Instance"}
        size="md"
      >
        <Stack>
          <TextInput
            label="Name"
            placeholder="My PBM Instance"
            required
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
          />
          <TextInput
            label="MongoDB URI"
            placeholder="mongodb://user:pass@host:27017"
            description="Use container names if on the same Docker network"
            required
            value={mongoUri}
            onChange={(e) => setMongoUri(e.currentTarget.value)}
          />
          <TextInput
            label="PBM Version"
            placeholder="2.7.0"
            description="Must match your PBM agent version. The CLI binary will be downloaded automatically."
            required
            value={pbmVersion}
            onChange={(e) => setPbmVersion(e.currentTarget.value)}
          />
          <Button
            onClick={handleSubmit}
            loading={createMutation.isPending || updateMutation.isPending}
            disabled={!name || !mongoUri || !pbmVersion}
          >
            {editId ? "Update" : "Create"}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  );
}
