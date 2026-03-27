import { useState } from "react";
import {
  Title,
  Card,
  SimpleGrid,
  Text,
  Badge,
  Group,
  Stack,
  Alert,
  Loader,
  Table,
  ThemeIcon,
  Code,
  Modal,
  Anchor,
  Button,
  Divider,
  Switch,
  Slider,
  Progress,
} from "@mantine/core";
import {
  IconServer,
  IconArchive,
  IconPlayerPlay,
  IconAlertCircle,
  IconCheck,
  IconX,
  IconClock,
  IconDatabase,
  IconRestore,
  IconRefresh,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import { getStatus } from "../api/logs";
import { listBackups, describeBackup, createBackup } from "../api/backups";
import { listRestores } from "../api/restores";
import { setConfig, resyncConfig } from "../api/config";
import { startRestore, pitrRestore as apiPitrRestore } from "../api/restores";

function roleName(role: string) {
  switch (role) {
    case "P": return "Primary";
    case "S": return "Secondary";
    case "A": return "Arbiter";
    default: return role;
  }
}

function roleColor(role: string) {
  switch (role) {
    case "P": return "blue";
    case "S": return "gray";
    case "A": return "yellow";
    default: return "gray";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "done": return "green";
    case "error": return "red";
    case "canceled": return "gray";
    case "running": return "orange";
    default: return "yellow";
  }
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return `${val.toFixed(1)} ${units[i]}`;
}

function formatTs(ts: number) {
  if (!ts) return "-";
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", "");
}

export function DashboardPage() {
  const { selectedId, selected } = useInstance();
  const queryClient = useQueryClient();

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailTitle, setDetailTitle] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);

  // PITR restore modal
  const [pitrModalOpen, setPitrModalOpen] = useState(false);
  const [pitrRange, setPitrRange] = useState<{ start: number; end: number } | null>(null);
  const [pitrSliderValue, setPitrSliderValue] = useState(50);

  const {
    data: status,
    isLoading: statusLoading,
    error: statusError,
  } = useQuery({
    queryKey: ["status", selectedId],
    queryFn: () => getStatus(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  const { data: backupList, isLoading: backupsLoading } = useQuery({
    queryKey: ["backups", selectedId],
    queryFn: () => listBackups(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  const { data: restoreList } = useQuery({
    queryKey: ["restores", selectedId],
    queryFn: () => listRestores(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 10000,
  });

  // PITR toggle
  const pitrMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      setConfig(selectedId!, { key: "pitr.enabled", value: String(enabled) }),
    onSuccess: (_, enabled) => {
      notifications.show({
        title: "PITR " + (enabled ? "Enabled" : "Disabled"),
        message: "PITR configuration updated",
        color: "green",
      });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  // Quick backup for PITR recovery
  const quickBackupMutation = useMutation({
    mutationFn: () => createBackup(selectedId!, { type: "logical" }),
    onSuccess: () => {
      notifications.show({
        title: "Backup started",
        message: "A new logical backup has been initiated. PITR will resume once it completes.",
        color: "green",
      });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  // Force resync
  const resyncMutation = useMutation({
    mutationFn: () => resyncConfig(selectedId!),
    onSuccess: () => {
      notifications.show({
        title: "Resync started",
        message: "Storage resync initiated",
        color: "green",
      });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  // Restore from backup
  const restoreMutation = useMutation({
    mutationFn: (backupName: string) =>
      startRestore(selectedId!, { backup_name: backupName }),
    onSuccess: () => {
      notifications.show({
        title: "Restore started",
        message: "Restore operation initiated",
        color: "green",
      });
      setDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["restores", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({
        title: "Restore error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  // PITR restore
  const pitrRestoreMutation = useMutation({
    mutationFn: (time: string) => apiPitrRestore(selectedId!, { time }),
    onSuccess: () => {
      notifications.show({ title: "PITR Restore started", message: "Point-in-time recovery initiated", color: "green" });
      setPitrModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["restores", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const handlePitrRangeClick = (r: any) => {
    const start = r.range?.start || r.start;
    const end = r.range?.end || r.end;
    setPitrRange({ start, end });
    setPitrSliderValue(100); // default to latest available point
    setPitrModalOpen(true);
  };

  const getPitrTimeFromSlider = () => {
    if (!pitrRange) return "";
    const ts = pitrRange.start + Math.round(((pitrRange.end - pitrRange.start) * pitrSliderValue) / 100);
    // PBM expects "2026-03-26T21:53:00" format — no trailing Z
    return new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, "");
  };

  const getPitrTsFromSlider = () => {
    if (!pitrRange) return 0;
    return pitrRange.start + Math.round(((pitrRange.end - pitrRange.start) * pitrSliderValue) / 100);
  };

  const handleDescribeBackup = async (name: string) => {
    setDetailTitle(`Backup: ${name}`);
    setDetailLoading(true);
    setDetailData(null);
    setDetailOpen(true);
    try {
      const data = await describeBackup(selectedId!, name);
      setDetailData({ ...data, _type: "backup" });
    } catch (err: any) {
      setDetailData({ error: err.response?.data?.detail || err.message, _type: "backup" });
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDescribeRestore = async (r: any) => {
    setDetailTitle(`Restore: ${r.name || r.snapshot || "unknown"}`);
    setDetailData({ ...r, _type: "restore" });
    setDetailOpen(true);
  };

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Dashboard</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          Select a PBM instance from the header to view its status.
        </Alert>
      </Stack>
    );
  }

  if (statusLoading) {
    return (
      <Stack align="center" mt="xl">
        <Loader size="lg" />
        <Text c="dimmed">Loading status...</Text>
      </Stack>
    );
  }

  if (statusError) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="red" title="Error">
        Failed to load status: {(statusError as Error).message}
      </Alert>
    );
  }

  const cluster = status?.cluster || [];
  const pitr = status?.pitr;
  const running = status?.running;
  const storageInfo = status?.backups;

  const snapshots = backupList?.snapshots || [];
  const pitrRanges = backupList?.pitr?.ranges || [];
  const pitrOn = pitr?.conf || backupList?.pitr?.on || false;

  // Detect if PITR needs a backup: enabled but no usable PITR ranges from pbm list
  const pitrNeedsBackup = (pitrOn || pitr?.conf) && snapshots.length === 0 && pitrRanges.length === 0;
  const restores = Array.isArray(restoreList) ? restoreList : [];

  const totalNodes = cluster.reduce((a: number, rs: any) => a + (rs.nodes?.length || 0), 0);
  const healthyNodes = cluster.reduce(
    (a: number, rs: any) => a + (rs.nodes?.filter((n: any) => n.ok).length || 0), 0
  );
  const hasRunning = running && Object.keys(running).length > 0 && running.type;

  // Build the backup list including any currently running backup from status
  const allBackups = [...snapshots];
  if (hasRunning && running.type === "backup" && running.name) {
    const alreadyInList = allBackups.some((b: any) => b.name === running.name);
    if (!alreadyInList) {
      allBackups.unshift({
        name: running.name,
        type: running.opid ? "logical" : "logical",
        status: "running",
        _running: true,
      });
    }
  }
  // Mark running backup in existing list
  if (hasRunning && running.type === "backup" && running.name) {
    allBackups.forEach((b: any) => {
      if (b.name === running.name && b.status !== "done" && b.status !== "error") {
        b.status = "running";
        b._running = true;
      }
    });
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Dashboard — {selected?.name}</Title>
        <Button
          leftSection={<IconRefresh size={16} />}
          variant="light"
          onClick={() => resyncMutation.mutate()}
          loading={resyncMutation.isPending}
        >
          Force Resync Storage
        </Button>
      </Group>

      {/* Summary cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Cluster Nodes</Text>
            <ThemeIcon variant="light" color={healthyNodes === totalNodes ? "green" : "red"} size="lg">
              <IconServer size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} mt="sm">{healthyNodes}/{totalNodes} healthy</Text>
          <Text size="xs" c="dimmed">{cluster.length} replica set(s)</Text>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Backups</Text>
            <ThemeIcon variant="light" color="green" size="lg">
              <IconArchive size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} mt="sm">{snapshots.length}</Text>
          <Text size="xs" c="dimmed">snapshot(s)</Text>
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">PITR</Text>
            <ThemeIcon
              variant="light"
              color={pitr?.run && !pitrNeedsBackup ? "green" : pitrOn ? "yellow" : "gray"}
              size="lg"
            >
              {pitr?.run && !pitrNeedsBackup ? <IconCheck size={20} /> : pitrOn ? <IconAlertCircle size={20} /> : <IconX size={20} />}
            </ThemeIcon>
          </Group>
          <Switch
            mt="sm"
            label={pitrOn ? "Enabled" : "Disabled"}
            checked={pitrOn}
            onChange={(e) => pitrMutation.mutate(e.currentTarget.checked)}
            disabled={pitrMutation.isPending}
          />
          {pitrNeedsBackup ? (
            <Stack gap="xs" mt="xs">
              <Alert color="yellow" variant="light" p="xs" icon={<IconAlertCircle size={14} />}>
                <Text size="xs">PITR is capturing oplog but without a valid backup the chunks are unusable.</Text>
              </Alert>
              <Button
                size="xs"
                variant="light"
                color="blue"
                fullWidth
                leftSection={<IconArchive size={14} />}
                loading={quickBackupMutation.isPending}
                onClick={() => quickBackupMutation.mutate()}
              >
                Create backup now
              </Button>
            </Stack>
          ) : pitr?.run ? (
            <Text size="xs" c="green" mt={4} fw={500}>Oplog capture running</Text>
          ) : (pitrOn || pitr?.conf) && snapshots.length === 0 ? (
            <Stack gap="xs" mt="xs">
              <Alert color="yellow" variant="light" p="xs" icon={<IconAlertCircle size={14} />}>
                <Text size="xs">PITR enabled but not capturing. A new backup is required to start oplog slicing.</Text>
              </Alert>
              <Button
                size="xs"
                variant="light"
                color="blue"
                fullWidth
                leftSection={<IconArchive size={14} />}
                loading={quickBackupMutation.isPending}
                onClick={() => quickBackupMutation.mutate()}
              >
                Create backup now
              </Button>
            </Stack>
          ) : (pitrOn || pitr?.conf) ? (
            <Text size="xs" c="yellow" mt={4} fw={500}>Starting oplog capture...</Text>
          ) : (
            <Text size="xs" c="dimmed" mt={4}>Not configured</Text>
          )}
        </Card>

        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group justify="space-between">
            <Text size="sm" c="dimmed">Running Operation</Text>
            <ThemeIcon variant="light" color={hasRunning ? "orange" : "green"} size="lg">
              <IconPlayerPlay size={20} />
            </ThemeIcon>
          </Group>
          <Text size="xl" fw={700} mt="sm">{hasRunning ? running.type : "Idle"}</Text>
          {hasRunning && running.name && (
            <Text size="xs" c="dimmed" lineClamp={1} ff="monospace">{running.name}</Text>
          )}
        </Card>
      </SimpleGrid>

      {/* Storage */}
      {storageInfo && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <IconDatabase size={20} />
            <Title order={4}>Storage</Title>
          </Group>
          <Group gap="xl">
            <div>
              <Text size="xs" c="dimmed">Type</Text>
              <Badge variant="light">{storageInfo.type || "N/A"}</Badge>
            </div>
            {storageInfo.path && (
              <div>
                <Text size="xs" c="dimmed">Path</Text>
                <Code>{storageInfo.path}</Code>
              </div>
            )}
            {storageInfo.s3 && (
              <div>
                <Text size="xs" c="dimmed">Bucket</Text>
                <Code>{storageInfo.s3.bucket || "N/A"}</Code>
              </div>
            )}
          </Group>
        </Card>
      )}

      {/* Cluster nodes */}
      {cluster.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <IconServer size={20} />
            <Title order={4}>Cluster Nodes</Title>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Replica Set</Table.Th>
                <Table.Th>Host</Table.Th>
                <Table.Th>Role</Table.Th>
                <Table.Th>Agent</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {cluster.flatMap((rs: any) =>
                (rs.nodes || []).map((node: any, i: number) => (
                  <Table.Tr key={`${rs.rs}-${i}`}>
                    <Table.Td><Text size="sm" fw={500}>{rs.rs}</Text></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace">{node.host}</Text></Table.Td>
                    <Table.Td>
                      <Badge color={roleColor(node.role)} variant="light">{roleName(node.role)}</Badge>
                    </Table.Td>
                    <Table.Td><Text size="sm" ff="monospace">{node.agent || "-"}</Text></Table.Td>
                    <Table.Td>
                      <Stack gap={2}>
                        <Badge color={node.ok ? "green" : "red"} variant="light">{node.ok ? "OK" : "Error"}</Badge>
                        {!node.ok && (node.errmsg || node.errors) && (
                          <Text size="xs" c="red" lineClamp={2}>
                            {node.errmsg || (Array.isArray(node.errors) ? node.errors.join("; ") : String(node.errors))}
                          </Text>
                        )}
                      </Stack>
                    </Table.Td>
                  </Table.Tr>
                ))
              )}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Backups - clickable */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconArchive size={20} />
          <Title order={4}>Backups</Title>
        </Group>
        {backupsLoading ? (
          <Loader size="sm" />
        ) : allBackups.length > 0 ? (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>PBM Version</Table.Th>
                <Table.Th>Restore To</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {allBackups.map((b: any) => (
                <Table.Tr
                  key={b.name}
                  style={{ cursor: b._running ? "default" : "pointer" }}
                  onClick={() => !b._running && handleDescribeBackup(b.name)}
                >
                  <Table.Td>
                    {b._running ? (
                      <Group gap="xs">
                        <Loader size={14} />
                        <Text size="sm" ff="monospace">{b.name}</Text>
                      </Group>
                    ) : (
                      <Anchor size="sm" ff="monospace" component="span">{b.name}</Anchor>
                    )}
                  </Table.Td>
                  <Table.Td>{b.type || "logical"}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(b.status)} variant="light">{b.status}</Badge>
                  </Table.Td>
                  <Table.Td>{b.size_h || (b.size ? formatBytes(b.size) : "-")}</Table.Td>
                  <Table.Td>{b.pbmVersion || "-"}</Table.Td>
                  <Table.Td>
                    <Text size="sm" ff="monospace">
                      {b.restoreTo ? formatTs(b.restoreTo) : "-"}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        ) : (
          <Text c="dimmed" ta="center" py="md">No backups yet</Text>
        )}
      </Card>

      {/* Restores */}
      {restores.length > 0 && (
        <Card shadow="sm" padding="lg" radius="md" withBorder>
          <Group mb="md">
            <IconRestore size={20} />
            <Title order={4}>Restores</Title>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>From Snapshot</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {restores.map((r: any, i: number) => (
                <Table.Tr key={i} style={{ cursor: "pointer" }} onClick={() => handleDescribeRestore(r)}>
                  <Table.Td>
                    <Anchor size="sm" ff="monospace" component="span">{r.name || "N/A"}</Anchor>
                  </Table.Td>
                  <Table.Td><Text size="sm" ff="monospace">{r.snapshot || "-"}</Text></Table.Td>
                  <Table.Td>{r.type || "-"}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColor(r.status)} variant="light">{r.status}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* PITR ranges - clickable */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconClock size={20} />
          <Title order={4}>PITR Ranges</Title>
          <Badge color={pitrOn ? "green" : "gray"} variant="light">{pitrOn ? "ON" : "OFF"}</Badge>
          {pitr?.run && <Badge color="blue" variant="light">Capturing oplog</Badge>}
        </Group>
        {pitrRanges.length > 0 ? (
          <Stack gap="xs">
            {pitrRanges.map((r: any, i: number) => {
              const s = r.range?.start || r.start;
              const e = r.range?.end || r.end;
              const durationMin = s && e ? Math.round((e - s) / 60) : 0;
              return (
                <Card
                  key={i}
                  withBorder
                  p="md"
                  style={{ cursor: "pointer" }}
                  onClick={() => handlePitrRangeClick(r)}
                >
                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">From</Text>
                      <Text size="sm" ff="monospace" fw={500}>{s ? formatTs(s) : "-"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">To</Text>
                      <Text size="sm" ff="monospace" fw={500}>{e ? formatTs(e) : "-"}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">Duration</Text>
                      <Badge variant="light">{durationMin} min</Badge>
                    </div>
                    <Button variant="light" color="orange" size="xs">
                      Restore PITR
                    </Button>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="md">No PITR ranges available</Text>
        )}
      </Card>

      {/* PITR restore modal */}
      <Modal
        opened={pitrModalOpen}
        onClose={() => setPitrModalOpen(false)}
        title="Point-in-Time Recovery"
        size="lg"
      >
        {pitrRange && (
          <Stack>
            <Alert color="orange" variant="light" title="Warning">
              This will restore the cluster to the selected point in time. This is a destructive operation.
            </Alert>

            <SimpleGrid cols={2}>
              <div>
                <Text size="xs" c="dimmed">Range Start</Text>
                <Text size="sm" ff="monospace" fw={500}>{formatTs(pitrRange.start)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Range End</Text>
                <Text size="sm" ff="monospace" fw={500}>{formatTs(pitrRange.end)}</Text>
              </div>
            </SimpleGrid>

            <Divider />

            <Text size="sm" fw={500}>Select restore point:</Text>
            <Slider
              value={pitrSliderValue}
              onChange={setPitrSliderValue}
              min={0}
              max={100}
              step={1}
              label={(val) => {
                const ts = pitrRange.start + Math.round(((pitrRange.end - pitrRange.start) * val) / 100);
                return formatTs(ts);
              }}
              marks={[
                { value: 0, label: "Earliest" },
                { value: 50, label: "Middle" },
                { value: 100, label: "Latest" },
              ]}
              styles={{ markLabel: { fontSize: "0.7rem" } }}
            />

            <Card withBorder p="md" mt="sm">
              <Group justify="center">
                <div style={{ textAlign: "center" }}>
                  <Text size="xs" c="dimmed">Restore to</Text>
                  <Text size="lg" fw={700} ff="monospace">{formatTs(getPitrTsFromSlider())}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">{getPitrTimeFromSlider()}</Text>
                </div>
              </Group>
            </Card>

            <Button
              color="orange"
              fullWidth
              size="md"
              leftSection={<IconClock size={18} />}
              loading={pitrRestoreMutation.isPending}
              onClick={() => {
                const time = getPitrTimeFromSlider();
                if (confirm(`Restore to ${formatTs(getPitrTsFromSlider())}?\n\nThis will overwrite the current cluster data.`)) {
                  pitrRestoreMutation.mutate(time);
                }
              }}
            >
              Restore to this point
            </Button>
          </Stack>
        )}
      </Modal>

      {/* Detail modal - nicely formatted */}
      <Modal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detailTitle}
        size="lg"
      >
        {detailLoading ? (
          <Stack align="center" py="xl"><Loader /></Stack>
        ) : detailData ? (
          <Stack>
            {/* Error alert */}
            {detailData.error && (
              <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
                {detailData.error}
              </Alert>
            )}

            {/* Backup detail - formatted */}
            {detailData._type === "backup" && !detailData.error && (
              <>
                <SimpleGrid cols={2}>
                  <div>
                    <Text size="xs" c="dimmed">Name</Text>
                    <Text size="sm" fw={500} ff="monospace">{detailData.name}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Status</Text>
                    <Badge color={statusColor(detailData.status)} variant="light">
                      {detailData.status}
                    </Badge>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Type</Text>
                    <Text size="sm">{detailData.type || "logical"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Size</Text>
                    <Text size="sm">{detailData.size_h || formatBytes(detailData.size) || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">PBM Version</Text>
                    <Text size="sm">{detailData.pbm_version || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">MongoDB Version</Text>
                    <Text size="sm">{detailData.mongodb_version || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Last Write</Text>
                    <Text size="sm" ff="monospace">{detailData.last_write_time || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Completed</Text>
                    <Text size="sm" ff="monospace">{detailData.last_transition_time || "-"}</Text>
                  </div>
                </SimpleGrid>

                {/* Replica sets */}
                {detailData.replsets && detailData.replsets.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text size="sm" fw={500}>Replica Sets</Text>
                    <Table striped>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>Name</Table.Th>
                          <Table.Th>Node</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Last Write</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {detailData.replsets.map((rs: any, i: number) => (
                          <Table.Tr key={i}>
                            <Table.Td>{rs.name}</Table.Td>
                            <Table.Td><Text size="sm" ff="monospace">{rs.node || "-"}</Text></Table.Td>
                            <Table.Td>
                              <Badge color={statusColor(rs.status)} variant="light">{rs.status}</Badge>
                            </Table.Td>
                            <Table.Td>
                              <Text size="sm" ff="monospace">{rs.last_write_time || "-"}</Text>
                            </Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </>
                )}

                {/* Restore button */}
                {detailData.status === "done" && (
                  <>
                    <Divider my="sm" />
                    <Button
                      color="orange"
                      fullWidth
                      leftSection={<IconRestore size={16} />}
                      loading={restoreMutation.isPending}
                      onClick={() => {
                        if (confirm(`Restore from backup "${detailData.name}"? This is a destructive operation.`)) {
                          restoreMutation.mutate(detailData.name);
                        }
                      }}
                    >
                      Restore from this backup
                    </Button>
                  </>
                )}
              </>
            )}

            {/* Restore detail - formatted */}
            {detailData._type === "restore" && (
              <>
                <SimpleGrid cols={2}>
                  <div>
                    <Text size="xs" c="dimmed">Name</Text>
                    <Text size="sm" fw={500} ff="monospace">{detailData.name || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Status</Text>
                    <Badge color={statusColor(detailData.status)} variant="light">
                      {detailData.status}
                    </Badge>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">From Snapshot</Text>
                    <Text size="sm" ff="monospace">{detailData.snapshot || "-"}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Type</Text>
                    <Text size="sm">{detailData.type || "-"}</Text>
                  </div>
                  {detailData.start && (
                    <div>
                      <Text size="xs" c="dimmed">Started</Text>
                      <Text size="sm" ff="monospace">{formatTs(detailData.start)}</Text>
                    </div>
                  )}
                </SimpleGrid>
                {detailData.error && (
                  <>
                    <Divider my="sm" />
                    <Text size="xs" c="dimmed">Error Details</Text>
                    <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                      {detailData.error}
                    </Code>
                  </>
                )}
              </>
            )}
          </Stack>
        ) : (
          <Text c="dimmed">No data</Text>
        )}
      </Modal>
    </Stack>
  );
}
