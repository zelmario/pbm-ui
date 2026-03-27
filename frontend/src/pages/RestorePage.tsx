import { useState } from "react";
import {
  Title,
  Stack,
  Alert,
  Card,
  Button,
  Select,
  Tabs,
  Loader,
  Table,
  Text,
  Badge,
  Code,
  Modal,
  Divider,
  SimpleGrid,
  Slider,
  Group,
} from "@mantine/core";
import { IconAlertCircle, IconClock, IconRestore } from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import { startRestore, pitrRestore, listRestores } from "../api/restores";
import { listBackups } from "../api/backups";

function statusColor(s: string) {
  switch (s) {
    case "done": return "green";
    case "error": return "red";
    case "canceled": return "gray";
    case "running": return "orange";
    default: return "yellow";
  }
}

function formatTs(ts: number) {
  if (!ts) return "-";
  return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", "");
}

function formatIso(ts: number) {
  if (!ts) return "";
  // PBM expects "2026-03-26T21:53:00" format — no trailing Z
  return new Date(ts * 1000).toISOString().replace(/\.\d{3}Z$/, "");
}

export function RestorePage() {
  const { selectedId } = useInstance();
  const queryClient = useQueryClient();

  const [backupName, setBackupName] = useState("");
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);
  const [pitrSliderValue, setPitrSliderValue] = useState(100);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const { data: backupList } = useQuery({
    queryKey: ["backups", selectedId],
    queryFn: () => listBackups(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 10000,
  });

  const { data: restoreList, isLoading: restoresLoading } = useQuery({
    queryKey: ["restores", selectedId],
    queryFn: () => listRestores(selectedId!),
    enabled: !!selectedId,
    refetchInterval: 10000,
  });

  const restoreMutation = useMutation({
    mutationFn: () => startRestore(selectedId!, { backup_name: backupName }),
    onSuccess: () => {
      notifications.show({ title: "Restore started", message: "Restore operation initiated", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["restores", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  const pitrMutation = useMutation({
    mutationFn: (time: string) => pitrRestore(selectedId!, { time }),
    onSuccess: () => {
      notifications.show({ title: "PITR Restore started", message: "Point-in-time recovery initiated", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["restores", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["status", selectedId] });
    },
    onError: (err: any) => {
      notifications.show({ title: "Error", message: err.response?.data?.detail || err.message, color: "red" });
    },
  });

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Restore</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">Select a PBM instance first.</Alert>
      </Stack>
    );
  }

  const backupOptions =
    backupList?.snapshots
      ?.filter((b: any) => b.status === "done")
      .map((b: any) => ({ value: b.name, label: `${b.name} (${b.type || "logical"})` })) || [];

  const pitrRanges = backupList?.pitr?.ranges || [];
  const pitrOn = backupList?.pitr?.on || false;
  const restores = Array.isArray(restoreList) ? restoreList : [];

  const getPitrTsFromSlider = () => {
    if (!selectedRange) return 0;
    return selectedRange.start + Math.round(((selectedRange.end - selectedRange.start) * pitrSliderValue) / 100);
  };

  const getPitrTimeFromSlider = () => {
    const ts = getPitrTsFromSlider();
    return ts ? formatIso(ts) : "";
  };

  return (
    <Stack>
      <Title order={2}>Restore</Title>

      <Tabs defaultValue="backup">
        <Tabs.List>
          <Tabs.Tab value="backup" leftSection={<IconRestore size={16} />}>From Backup</Tabs.Tab>
          <Tabs.Tab value="pitr" leftSection={<IconClock size={16} />}>Point-in-Time Recovery</Tabs.Tab>
          <Tabs.Tab value="history">Restore History</Tabs.Tab>
        </Tabs.List>

        {/* From Backup */}
        <Tabs.Panel value="backup" pt="md">
          <Card withBorder p="lg">
            <Stack>
              <Alert color="orange" variant="light" title="Warning">
                Restoring will overwrite the current data on the cluster.
              </Alert>
              <Select
                label="Select Backup"
                placeholder="Choose a backup to restore"
                data={backupOptions}
                value={backupName}
                onChange={(v) => setBackupName(v || "")}
                searchable
              />
              <Button
                onClick={() => {
                  if (confirm(`Restore from "${backupName}"?\n\nThis will overwrite the current cluster data.`)) {
                    restoreMutation.mutate();
                  }
                }}
                loading={restoreMutation.isPending}
                disabled={!backupName}
                color="orange"
              >
                Start Restore
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* PITR */}
        <Tabs.Panel value="pitr" pt="md">
          <Stack>
            {!pitrOn && pitrRanges.length === 0 && (
              <Alert color="yellow" title="PITR not available">
                PITR is not enabled or there are no oplog ranges available. Enable PITR in the Configuration page and wait for oplog slices to be captured.
              </Alert>
            )}

            {pitrRanges.length > 0 && (
              <>
                <Text size="sm" fw={500}>Available PITR Ranges</Text>
                <Text size="xs" c="dimmed">Select a range, then pick the exact restore point using the slider.</Text>

                <Stack gap="xs">
                  {pitrRanges.map((r: any, i: number) => {
                    const s = r.range?.start || r.start;
                    const e = r.range?.end || r.end;
                    const durationMin = s && e ? Math.round((e - s) / 60) : 0;
                    const isSelected = selectedRange?.start === s && selectedRange?.end === e;
                    return (
                      <Card
                        key={i}
                        withBorder
                        p="md"
                        style={{
                          cursor: "pointer",
                          borderColor: isSelected ? "var(--mantine-color-orange-6)" : undefined,
                          borderWidth: isSelected ? 2 : 1,
                        }}
                        onClick={() => {
                          setSelectedRange({ start: s, end: e });
                          setPitrSliderValue(100);
                        }}
                      >
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
                          {isSelected && <Badge color="orange">Selected</Badge>}
                        </Group>
                      </Card>
                    );
                  })}
                </Stack>
              </>
            )}

            {selectedRange && (
              <Card withBorder p="lg" mt="sm">
                <Stack>
                  <Alert color="orange" variant="light" title="Warning">
                    This will restore the cluster to the selected point in time. This is a destructive operation.
                  </Alert>

                  <Text size="sm" fw={500}>Pick restore point:</Text>
                  <Slider
                    value={pitrSliderValue}
                    onChange={setPitrSliderValue}
                    min={0}
                    max={100}
                    step={1}
                    label={(val) => {
                      const ts = selectedRange.start + Math.round(((selectedRange.end - selectedRange.start) * val) / 100);
                      return formatTs(ts);
                    }}
                    marks={[
                      { value: 0, label: "Earliest" },
                      { value: 50, label: "Middle" },
                      { value: 100, label: "Latest" },
                    ]}
                    styles={{ markLabel: { fontSize: "0.7rem" } }}
                    color="orange"
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
                    loading={pitrMutation.isPending}
                    onClick={() => {
                      const time = getPitrTimeFromSlider();
                      if (confirm(`Restore to ${formatTs(getPitrTsFromSlider())}?\n\nThis will overwrite the current cluster data.`)) {
                        pitrMutation.mutate(time);
                      }
                    }}
                  >
                    Restore to this point
                  </Button>
                </Stack>
              </Card>
            )}
          </Stack>
        </Tabs.Panel>

        {/* History */}
        <Tabs.Panel value="history" pt="md">
          {restoresLoading ? (
            <Loader />
          ) : restores.length > 0 ? (
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
                  <Table.Tr
                    key={i}
                    style={{ cursor: "pointer" }}
                    onClick={() => { setDetailData(r); setDetailOpen(true); }}
                  >
                    <Table.Td><Text size="sm" ff="monospace">{r.name || "N/A"}</Text></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace">{r.snapshot || "-"}</Text></Table.Td>
                    <Table.Td>{r.type || "-"}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColor(r.status)} variant="light">{r.status}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : (
            <Text c="dimmed" ta="center" py="xl">No restores found</Text>
          )}
        </Tabs.Panel>
      </Tabs>

      {/* Restore detail modal */}
      <Modal
        opened={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={`Restore: ${detailData?.name || "Details"}`}
        size="lg"
      >
        {detailData && (
          <Stack>
            <SimpleGrid cols={2}>
              <div>
                <Text size="xs" c="dimmed">Name</Text>
                <Text size="sm" fw={500} ff="monospace">{detailData.name || "-"}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color={statusColor(detailData.status)} variant="light">{detailData.status}</Badge>
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
                <Divider />
                <Alert color="red" title="Error" icon={<IconAlertCircle size={16} />}>
                  <Code block style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                    {detailData.error}
                  </Code>
                </Alert>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </Stack>
  );
}
