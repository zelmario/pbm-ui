import { useState } from "react";
import {
  Title,
  Stack,
  Alert,
  Table,
  Badge,
  Button,
  Group,
  Modal,
  Select,
  TextInput,
  NumberInput,
  Text,
  Loader,
  ActionIcon,
  Tooltip,
  SimpleGrid,
  Divider,
  Anchor,
  Card,
  Slider,
  Switch,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconPlayerStop,
  IconRestore,
  IconClock,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import {
  listBackups,
  createBackup,
  deleteBackup,
  describeBackup,
  cancelBackup,
} from "../api/backups";
import { getStatus } from "../api/logs";
import { startRestore, pitrRestore as apiPitrRestore } from "../api/restores";

function statusColor(s: string) {
  switch (s) {
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

function formatPitrTime(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, "");
}

export function BackupsPage() {
  const { selectedId } = useInstance();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // PITR restore modal
  const [pitrModalOpen, setPitrModalOpen] = useState(false);
  const [pitrRange, setPitrRange] = useState<{ start: number; end: number } | null>(null);
  const [pitrSliderValue, setPitrSliderValue] = useState(100);

  const [backupType, setBackupType] = useState("logical");
  const [compression, setCompression] = useState<string | null>(null);
  const [compressionLevel, setCompressionLevel] = useState<number | "">("");
  const [ns, setNs] = useState("");
  const [isBase, setIsBase] = useState(false);

  const { data: backupList, isLoading, error } = useQuery({
    queryKey: ["backups", selectedId],
    queryFn: () => listBackups(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  const { data: status } = useQuery({
    queryKey: ["status", selectedId],
    queryFn: () => getStatus(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 5000,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      createBackup(selectedId!, {
        type: backupType,
        compression: compression || undefined,
        compression_level: compressionLevel !== "" ? Number(compressionLevel) : undefined,
        ns: ns || undefined,
        base: backupType === "incremental" ? isBase : undefined,
      }),
    onSuccess: () => {
      notifications.show({ title: "Backup started", message: "Backup operation initiated", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
      setCreateOpen(false);
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (name: string) => deleteBackup(selectedId!, name),
    onSuccess: () => {
      notifications.show({ title: "Deleted", message: "Backup deleted", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelBackup(selectedId!),
    onSuccess: () => {
      notifications.show({ title: "Cancelled", message: "Backup cancelled", color: "yellow" });
      queryClient.invalidateQueries({ queryKey: ["backups", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
  });

  const restoreMutation = useMutation({
    mutationFn: (backupName: string) => startRestore(selectedId!, { backup_name: backupName }),
    onSuccess: () => {
      notifications.show({ title: "Restore started", message: "Restore operation initiated", color: "green" });
      setDetailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Restore error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const pitrRestoreMutation = useMutation({
    mutationFn: (time: string) => apiPitrRestore(selectedId!, { time }),
    onSuccess: () => {
      notifications.show({ title: "PITR Restore started", message: "Point-in-time recovery initiated", color: "green" });
      setPitrModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const handleDescribe = async (name: string) => {
    setDetailLoading(true);
    setDetailData(null);
    setDetailOpen(true);
    try {
      const data = await describeBackup(selectedId!, name);
      setDetailData(data);
    } catch (err: any) {
      setDetailData({ error: err.response?.data?.detail || err.message });
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePitrRangeClick = (r: any) => {
    const start = r.range?.start || r.start;
    const end = r.range?.end || r.end;
    setPitrRange({ start, end });
    setPitrSliderValue(100);
    setPitrModalOpen(true);
  };

  const getPitrTsFromSlider = () => {
    if (!pitrRange) return 0;
    return pitrRange.start + Math.round(((pitrRange.end - pitrRange.start) * pitrSliderValue) / 100);
  };

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Backups</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">Select a PBM instance first.</Alert>
      </Stack>
    );
  }

  const running = status?.running;
  const hasRunning = running && Object.keys(running).length > 0 && running.type === "backup";
  const snapshots = backupList?.snapshots || [];
  const pitrRanges = backupList?.pitr?.ranges || [];
  const pitrOn = backupList?.pitr?.on || false;

  const allBackups = [...snapshots];
  if (hasRunning && running.name) {
    const exists = allBackups.some((b: any) => b.name === running.name);
    if (!exists) {
      allBackups.unshift({ name: running.name, type: "logical", status: "running", _running: true });
    } else {
      allBackups.forEach((b: any) => {
        if (b.name === running.name && b.status !== "done" && b.status !== "error") {
          b.status = "running"; b._running = true;
        }
      });
    }
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Backups</Title>
        <Group>
          {hasRunning && (
            <Button leftSection={<IconPlayerStop size={16} />} variant="light" color="yellow" onClick={() => cancelMutation.mutate()}>
              Cancel Running
            </Button>
          )}
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateOpen(true)}>New Backup</Button>
        </Group>
      </Group>

      {isLoading && <Loader />}
      {error && <Alert color="red">{(error as Error).message}</Alert>}

      {/* Backup table */}
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th>Size</Table.Th>
            <Table.Th>PBM Version</Table.Th>
            <Table.Th>Restore To</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {allBackups.map((b: any) => (
            <Table.Tr key={b.name}>
              <Table.Td>
                {b._running ? (
                  <Group gap="xs"><Loader size={14} /><Text size="sm" ff="monospace">{b.name}</Text></Group>
                ) : (
                  <Anchor size="sm" ff="monospace" component="span" onClick={() => handleDescribe(b.name)} style={{ cursor: "pointer" }}>{b.name}</Anchor>
                )}
              </Table.Td>
              <Table.Td>{b.type || "logical"}</Table.Td>
              <Table.Td><Badge color={statusColor(b.status)} variant="light">{b.status}</Badge></Table.Td>
              <Table.Td>{b.size_h || (b.size ? formatBytes(b.size) : "-")}</Table.Td>
              <Table.Td>{b.pbmVersion || "-"}</Table.Td>
              <Table.Td><Text size="sm" ff="monospace">{b.restoreTo ? formatTs(b.restoreTo) : "-"}</Text></Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {b.status === "done" && (
                    <Tooltip label="Restore"><ActionIcon variant="subtle" color="orange" onClick={() => handleDescribe(b.name)}><IconRestore size={16} /></ActionIcon></Tooltip>
                  )}
                  {!b._running && (
                    <Tooltip label="Delete"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm(`Delete backup ${b.name}?`)) deleteMutation.mutate(b.name); }}><IconTrash size={16} /></ActionIcon></Tooltip>
                  )}
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {allBackups.length === 0 && !isLoading && (
            <Table.Tr><Table.Td colSpan={7}><Text ta="center" c="dimmed" py="md">No backups found</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      {/* PITR Ranges - clickable */}
      <Card shadow="sm" padding="lg" radius="md" withBorder>
        <Group mb="md">
          <IconClock size={20} />
          <Title order={4}>PITR Ranges</Title>
          <Badge color={pitrOn ? "green" : "gray"} variant="light">{pitrOn ? "ON" : "OFF"}</Badge>
        </Group>
        {pitrRanges.length > 0 ? (
          <Stack gap="xs">
            {pitrRanges.map((r: any, i: number) => {
              const s = r.range?.start || r.start;
              const e = r.range?.end || r.end;
              const durationMin = s && e ? Math.round((e - s) / 60) : 0;
              return (
                <Card key={i} withBorder p="md" style={{ cursor: "pointer" }} onClick={() => handlePitrRangeClick(r)}>
                  <Group justify="space-between">
                    <div>
                      <Text size="xs" c="dimmed">From</Text>
                      <Text size="sm" ff="monospace" fw={500}>{formatTs(s)}</Text>
                    </div>
                    <div>
                      <Text size="xs" c="dimmed">To</Text>
                      <Text size="sm" ff="monospace" fw={500}>{formatTs(e)}</Text>
                    </div>
                    <Badge variant="light">{durationMin} min</Badge>
                    <Button variant="light" color="orange" size="xs">Restore PITR</Button>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="md">No PITR ranges available</Text>
        )}
      </Card>

      {/* Create Backup Modal */}
      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Create Backup" size="md">
        <Stack>
          <Select
            label="Backup Type"
            data={[
              { value: "logical", label: "Logical" },
              { value: "physical", label: "Physical" },
              { value: "incremental", label: "Incremental" },
            ]}
            value={backupType}
            onChange={(v) => { setBackupType(v || "logical"); if (v !== "incremental") setIsBase(false); }}
          />

          {backupType === "incremental" && (
            <>
              <Alert color="blue" variant="light" icon={<IconAlertCircle size={16} />}>
                Incremental backups require a <b>base backup</b> first. The base starts a new chain. Subsequent incremental backups save only changed data blocks since the base.
                Requires Percona Server for MongoDB.
              </Alert>
              <Switch
                label="Base backup (start new incremental chain)"
                description="Enable this for the first incremental backup, or to start a new chain"
                checked={isBase}
                onChange={(e) => setIsBase(e.currentTarget.checked)}
                size="md"
              />
            </>
          )}

          <Select
            label="Compression"
            data={[
              { value: "s2", label: "S2 (default)" },
              { value: "gzip", label: "Gzip" },
              { value: "snappy", label: "Snappy" },
              { value: "lz4", label: "LZ4" },
              { value: "pgzip", label: "Pgzip" },
              { value: "zstd", label: "Zstandard" },
            ]}
            value={compression}
            onChange={setCompression}
            clearable
            placeholder="Default (s2)"
          />
          <NumberInput label="Compression Level" min={0} max={10} value={compressionLevel} onChange={(val) => setCompressionLevel(val === "" ? "" : Number(val))} placeholder="Default" />

          {backupType === "logical" && (
            <TextInput label="Namespace (selective backup)" placeholder="db.collection or db.*" description="Leave empty for full backup" value={ns} onChange={(e) => setNs(e.currentTarget.value)} />
          )}

          <Button onClick={() => createMutation.mutate()} loading={createMutation.isPending}>
            {backupType === "incremental" && isBase ? "Start Base Backup" : "Start Backup"}
          </Button>
        </Stack>
      </Modal>

      {/* Backup Detail Modal */}
      <Modal opened={detailOpen} onClose={() => setDetailOpen(false)} title={detailData ? `Backup: ${detailData.name}` : "Backup Details"} size="lg">
        {detailLoading ? (
          <Stack align="center" py="xl"><Loader /></Stack>
        ) : detailData ? (
          <Stack>
            {detailData.error && <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>{detailData.error}</Alert>}
            {!detailData.error && (
              <>
                <SimpleGrid cols={2}>
                  <div><Text size="xs" c="dimmed">Name</Text><Text size="sm" fw={500} ff="monospace">{detailData.name}</Text></div>
                  <div><Text size="xs" c="dimmed">Status</Text><Badge color={statusColor(detailData.status)} variant="light">{detailData.status}</Badge></div>
                  <div><Text size="xs" c="dimmed">Type</Text><Text size="sm">{detailData.type || "logical"}</Text></div>
                  <div><Text size="xs" c="dimmed">Size</Text><Text size="sm">{detailData.size_h || formatBytes(detailData.size) || "-"}</Text></div>
                  <div><Text size="xs" c="dimmed">PBM Version</Text><Text size="sm">{detailData.pbm_version || "-"}</Text></div>
                  <div><Text size="xs" c="dimmed">MongoDB Version</Text><Text size="sm">{detailData.mongodb_version || "-"}</Text></div>
                  <div><Text size="xs" c="dimmed">Last Write</Text><Text size="sm" ff="monospace">{detailData.last_write_time || "-"}</Text></div>
                  <div><Text size="xs" c="dimmed">Completed</Text><Text size="sm" ff="monospace">{detailData.last_transition_time || "-"}</Text></div>
                </SimpleGrid>
                {detailData.replsets && detailData.replsets.length > 0 && (
                  <>
                    <Divider my="sm" />
                    <Text size="sm" fw={500}>Replica Sets</Text>
                    <Table striped>
                      <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Node</Table.Th><Table.Th>Status</Table.Th><Table.Th>Last Write</Table.Th></Table.Tr></Table.Thead>
                      <Table.Tbody>
                        {detailData.replsets.map((rs: any, i: number) => (
                          <Table.Tr key={i}>
                            <Table.Td>{rs.name}</Table.Td>
                            <Table.Td><Text size="sm" ff="monospace">{rs.node || "-"}</Text></Table.Td>
                            <Table.Td><Badge color={statusColor(rs.status)} variant="light">{rs.status}</Badge></Table.Td>
                            <Table.Td><Text size="sm" ff="monospace">{rs.last_write_time || "-"}</Text></Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </>
                )}
                {detailData.status === "done" && (
                  <>
                    <Divider my="sm" />
                    <Button color="orange" fullWidth leftSection={<IconRestore size={16} />} loading={restoreMutation.isPending} onClick={() => { if (confirm(`Restore from "${detailData.name}"?\n\nThis will overwrite the current data.`)) restoreMutation.mutate(detailData.name); }}>
                      Restore from this backup
                    </Button>
                  </>
                )}
              </>
            )}
          </Stack>
        ) : <Text c="dimmed">No data</Text>}
      </Modal>

      {/* PITR Restore Modal */}
      <Modal opened={pitrModalOpen} onClose={() => setPitrModalOpen(false)} title="Point-in-Time Recovery" size="lg">
        {pitrRange && (
          <Stack>
            <Alert color="orange" variant="light" title="Warning">
              This will restore the cluster to the selected point in time. This is a destructive operation.
            </Alert>
            <SimpleGrid cols={2}>
              <div><Text size="xs" c="dimmed">Range Start</Text><Text size="sm" ff="monospace" fw={500}>{formatTs(pitrRange.start)}</Text></div>
              <div><Text size="xs" c="dimmed">Range End</Text><Text size="sm" ff="monospace" fw={500}>{formatTs(pitrRange.end)}</Text></div>
            </SimpleGrid>
            <Divider />
            <Text size="sm" fw={500}>Select restore point:</Text>
            <Slider
              value={pitrSliderValue} onChange={setPitrSliderValue}
              min={0} max={100} step={1} color="orange"
              label={(val) => { const ts = pitrRange.start + Math.round(((pitrRange.end - pitrRange.start) * val) / 100); return formatTs(ts); }}
              marks={[{ value: 0, label: "Earliest" }, { value: 50, label: "Middle" }, { value: 100, label: "Latest" }]}
              styles={{ markLabel: { fontSize: "0.7rem" } }}
            />
            <Card withBorder p="md" mt="sm">
              <Group justify="center">
                <div style={{ textAlign: "center" }}>
                  <Text size="xs" c="dimmed">Restore to</Text>
                  <Text size="lg" fw={700} ff="monospace">{formatTs(getPitrTsFromSlider())}</Text>
                  <Text size="xs" c="dimmed" ff="monospace">{formatPitrTime(getPitrTsFromSlider())}</Text>
                </div>
              </Group>
            </Card>
            <Button color="orange" fullWidth size="md" leftSection={<IconClock size={18} />} loading={pitrRestoreMutation.isPending}
              onClick={() => {
                const time = formatPitrTime(getPitrTsFromSlider());
                if (confirm(`Restore to ${formatTs(getPitrTsFromSlider())}?\n\nThis will overwrite the current cluster data.`)) pitrRestoreMutation.mutate(time);
              }}
            >
              Restore to this point
            </Button>
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
