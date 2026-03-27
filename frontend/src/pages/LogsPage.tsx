import { useState, useCallback, useRef, useEffect } from "react";
import {
  Title,
  Stack,
  Alert,
  Card,
  Select,
  Group,
  Button,
  Switch,
  Text,
  ScrollArea,
  Badge,
  Loader,
} from "@mantine/core";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useInstance } from "../context/InstanceContext";
import { getLogs } from "../api/logs";
import { useSSE } from "../hooks/useSSE";

function severityLabel(s: number | string) {
  if (typeof s === "number") {
    switch (s) {
      case 0: return "F";
      case 1: return "E";
      case 2: return "W";
      case 3: return "I";
      case 4: return "D";
      default: return String(s);
    }
  }
  return String(s);
}

function severityColor(s: number | string) {
  const label = severityLabel(s);
  switch (label) {
    case "F": case "E": return "red";
    case "W": return "yellow";
    case "I": return "blue";
    case "D": return "gray";
    default: return "gray";
  }
}

function formatTs(ts: number | string) {
  if (typeof ts === "number") {
    return new Date(ts * 1000).toISOString().replace("T", " ").replace("Z", "");
  }
  return String(ts);
}

// Deduplicate entries by ts+node+msg
function dedupeEntries(entries: any[]): any[] {
  const seen = new Set<string>();
  return entries.filter((e) => {
    const key = `${e.ts}-${e.node}-${e.msg}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function LogsPage() {
  const { selectedId } = useInstance();
  const [severity, setSeverity] = useState<string | null>(null);
  const [event, setEvent] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);
  const [sseEntries, setSseEntries] = useState<any[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  // Always load initial logs
  const {
    data: initialLogs,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["logs", selectedId, severity, event],
    queryFn: () =>
      getLogs(selectedId!, {
        tail: 200,
        severity: severity || undefined,
        event: event || undefined,
      }),
    enabled: !!selectedId,
    refetchInterval: follow ? 2000 : false,
  });

  // SSE for new entries when following
  const handleSSEMessage = useCallback((data: any) => {
    setSseEntries((prev) => [...prev.slice(-500), data]);
  }, []);

  const sseUrl =
    selectedId && follow
      ? `/api/instances/${selectedId}/logs/stream?${severity ? `severity=${severity}` : ""}${event ? `&event=${event}` : ""}`
      : null;

  useSSE(sseUrl, handleSSEMessage);

  // Reset SSE entries when filters change
  useEffect(() => {
    setSseEntries([]);
  }, [severity, event, selectedId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (viewportRef.current) {
      const el = viewportRef.current;
      // Only auto-scroll if user is near the bottom
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom || follow) {
        el.scrollTop = el.scrollHeight;
      }
    }
  }, [sseEntries, initialLogs, follow]);

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Logs</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          Select a PBM instance first.
        </Alert>
      </Stack>
    );
  }

  // Combine initial logs + SSE new entries, deduplicated and sorted
  const initial = Array.isArray(initialLogs) ? initialLogs : [];
  const combined = dedupeEntries([...initial, ...sseEntries]);
  combined.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Logs</Title>
        <Group>
          <Switch
            label="Follow"
            checked={follow}
            onChange={(e) => {
              setFollow(e.currentTarget.checked);
              if (e.currentTarget.checked) setSseEntries([]);
            }}
          />
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => {
              setSseEntries([]);
              refetch();
            }}
          >
            Refresh
          </Button>
        </Group>
      </Group>

      <Group>
        <Select
          label="Severity"
          data={[
            { value: "D", label: "Debug" },
            { value: "I", label: "Info" },
            { value: "W", label: "Warning" },
            { value: "E", label: "Error" },
            { value: "F", label: "Fatal" },
          ]}
          value={severity}
          onChange={setSeverity}
          clearable
          placeholder="All"
          w={150}
        />
        <Select
          label="Event"
          data={[
            { value: "backup", label: "Backup" },
            { value: "restore", label: "Restore" },
            { value: "pitr", label: "PITR" },
            { value: "delete", label: "Delete" },
            { value: "config", label: "Config" },
          ]}
          value={event}
          onChange={setEvent}
          clearable
          placeholder="All"
          w={150}
        />
      </Group>

      {isLoading && <Loader />}
      {error && <Alert color="red">{(error as Error).message}</Alert>}

      <Card withBorder p={0}>
        <ScrollArea h={600} viewportRef={viewportRef}>
          <Stack gap={0} p="xs">
            {combined.map((entry: any, i: number) => (
              <Group
                key={`${entry.ts}-${i}`}
                gap="xs"
                p={4}
                style={{
                  borderBottom: "1px solid var(--mantine-color-dark-4)",
                  fontFamily: "monospace",
                  fontSize: "0.8rem",
                }}
                wrap="nowrap"
                align="flex-start"
              >
                <Badge
                  size="xs"
                  color={severityColor(entry.s)}
                  variant="filled"
                  w={24}
                  style={{ flexShrink: 0 }}
                >
                  {severityLabel(entry.s)}
                </Badge>
                <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatTs(entry.ts)}
                </Text>
                <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  [{entry.rs || ""}]
                </Text>
                <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                  {entry.node || ""}
                </Text>
                {entry.e && (
                  <Badge size="xs" variant="outline" style={{ flexShrink: 0 }}>
                    {entry.e}
                  </Badge>
                )}
                <Text size="xs" style={{ wordBreak: "break-all" }}>
                  {entry.msg}
                </Text>
              </Group>
            ))}
            {combined.length === 0 && !isLoading && (
              <Text c="dimmed" ta="center" py="xl">
                No logs found
              </Text>
            )}
          </Stack>
        </ScrollArea>
      </Card>
    </Stack>
  );
}
