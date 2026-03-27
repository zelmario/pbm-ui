import { useState } from "react";
import {
  Title,
  Stack,
  Alert,
  Table,
  Button,
  Group,
  Modal,
  TextInput,
  Textarea,
  Text,
  Loader,
  ActionIcon,
  Tooltip,
  Code,
} from "@mantine/core";
import {
  IconAlertCircle,
  IconPlus,
  IconTrash,
  IconEye,
  IconRefresh,
} from "@tabler/icons-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import { useInstance } from "../context/InstanceContext";
import {
  listProfiles,
  showProfile,
  addProfile,
  removeProfile,
  syncProfiles,
} from "../api/profiles";

export function ProfilesPage() {
  const { selectedId } = useInstance();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [profileName, setProfileName] = useState("");
  const [profileYaml, setProfileYaml] = useState("");

  const {
    data: profiles,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["profiles", selectedId],
    queryFn: () => listProfiles(selectedId!),
    enabled: !!selectedId,
  });

  const addMutation = useMutation({
    mutationFn: () => addProfile(selectedId!, profileName, profileYaml),
    onSuccess: () => {
      notifications.show({ title: "Added", message: "Profile added", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["profiles", selectedId] });
      setCreateOpen(false);
      setProfileName("");
      setProfileYaml("");
    },
    onError: (err: any) => {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (name: string) => removeProfile(selectedId!, name),
    onSuccess: () => {
      notifications.show({ title: "Removed", message: "Profile removed", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["profiles", selectedId] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => syncProfiles(selectedId!, undefined, true),
    onSuccess: () => {
      notifications.show({ title: "Synced", message: "Profiles synced", color: "green" });
      queryClient.invalidateQueries({ queryKey: ["profiles", selectedId] });
    },
  });

  const handleShow = async (name: string) => {
    try {
      const data = await showProfile(selectedId!, name);
      setDetailData(data);
      setDetailOpen(true);
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    }
  };

  if (!selectedId) {
    return (
      <Stack>
        <Title order={2}>Storage Profiles</Title>
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          Select a PBM instance first.
        </Alert>
      </Stack>
    );
  }

  const profileList = Array.isArray(profiles) ? profiles : profiles?.profiles || [];

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Storage Profiles</Title>
        <Group>
          <Button
            leftSection={<IconRefresh size={16} />}
            variant="light"
            onClick={() => syncMutation.mutate()}
          >
            Sync All
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => setCreateOpen(true)}
          >
            Add Profile
          </Button>
        </Group>
      </Group>

      {isLoading && <Loader />}
      {error && <Alert color="red">{(error as Error).message}</Alert>}

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Actions</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {profileList.map((p: any) => {
            const name = typeof p === "string" ? p : p.name;
            return (
              <Table.Tr key={name}>
                <Table.Td>{name}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Tooltip label="View">
                      <ActionIcon variant="subtle" onClick={() => handleShow(name)}>
                        <IconEye size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Remove">
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => {
                          if (confirm(`Remove profile ${name}?`)) {
                            removeMutation.mutate(name);
                          }
                        }}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            );
          })}
          {profileList.length === 0 && !isLoading && (
            <Table.Tr>
              <Table.Td colSpan={2}>
                <Text ta="center" c="dimmed" py="md">No profiles configured</Text>
              </Table.Td>
            </Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={createOpen} onClose={() => setCreateOpen(false)} title="Add Profile" size="lg">
        <Stack>
          <TextInput
            label="Profile Name"
            placeholder="my-s3-profile"
            value={profileName}
            onChange={(e) => setProfileName(e.currentTarget.value)}
          />
          <Textarea
            label="Config YAML"
            placeholder={`storage:\n  type: s3\n  s3:\n    bucket: my-bucket\n    region: us-east-1`}
            minRows={10}
            value={profileYaml}
            onChange={(e) => setProfileYaml(e.currentTarget.value)}
            autosize
            styles={{ input: { fontFamily: "monospace" } }}
          />
          <Button
            onClick={() => addMutation.mutate()}
            loading={addMutation.isPending}
            disabled={!profileName || !profileYaml}
          >
            Add Profile
          </Button>
        </Stack>
      </Modal>

      <Modal opened={detailOpen} onClose={() => setDetailOpen(false)} title="Profile Details" size="lg">
        {detailData && <Code block>{JSON.stringify(detailData, null, 2)}</Code>}
      </Modal>
    </Stack>
  );
}
