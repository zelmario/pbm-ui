import { useState, type ReactNode } from "react";
import {
  AppShell as MantineAppShell,
  Group,
  Text,
  Select,
  ActionIcon,
  Menu,
  Modal,
  Stack,
  TextInput,
  Button,
} from "@mantine/core";
import {
  IconDatabase,
  IconDashboard,
  IconArchive,
  IconRestore,
  IconSettings,
  IconFileText,
  IconServer,
  IconUser,
  IconLogout,
  IconKey,
} from "@tabler/icons-react";
import { useNavigate, useLocation } from "react-router-dom";
import { notifications } from "@mantine/notifications";
import { useAuth } from "../../context/AuthContext";
import { useInstance } from "../../context/InstanceContext";
import { changePassword } from "../../api/auth";

const navItems = [
  { label: "Dashboard", icon: IconDashboard, path: "/" },
  { label: "Backups", icon: IconArchive, path: "/backups" },
  { label: "Restores", icon: IconRestore, path: "/restores" },
  { label: "Configuration", icon: IconSettings, path: "/config" },
  { label: "Logs", icon: IconFileText, path: "/logs" },
  { label: "Instances", icon: IconServer, path: "/instances" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { instances, selectedId, select } = useInstance();

  const [pwModalOpen, setPwModalOpen] = useState(false);
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [changingPw, setChangingPw] = useState(false);

  const resetPwForm = () => {
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  };

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      notifications.show({ title: "Error", message: "New passwords do not match", color: "red" });
      return;
    }
    if (newPw.length < 4) {
      notifications.show({ title: "Error", message: "Password must be at least 4 characters", color: "red" });
      return;
    }
    setChangingPw(true);
    try {
      await changePassword(currentPw, newPw);
      notifications.show({ title: "Success", message: "Password changed", color: "green" });
      setPwModalOpen(false);
      resetPwForm();
    } catch (err: any) {
      notifications.show({
        title: "Error",
        message: err.response?.data?.detail || err.message,
        color: "red",
      });
    } finally {
      setChangingPw(false);
    }
  };

  const instanceOptions = instances.map((i) => ({
    value: String(i.id),
    label: i.name,
  }));

  return (
    <MantineAppShell
      navbar={{ width: 250, breakpoint: "sm" }}
      header={{ height: 60 }}
      padding="md"
    >
      <MantineAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <IconDatabase size={28} color="var(--mantine-color-blue-6)" />
            <Text size="lg" fw={700}>
              PBM UI
            </Text>
          </Group>
          <Group>
            <Select
              placeholder="Select PBM instance"
              data={instanceOptions}
              value={selectedId ? String(selectedId) : null}
              onChange={(val) => select(val ? Number(val) : null)}
              w={280}
              searchable
              clearable
            />
            <Menu shadow="md">
              <Menu.Target>
                <ActionIcon variant="subtle" size="lg">
                  <IconUser size={20} />
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>{user?.username}</Menu.Label>
                <Menu.Item
                  leftSection={<IconKey size={14} />}
                  onClick={() => setPwModalOpen(true)}
                >
                  Change Password
                </Menu.Item>
                <Menu.Item
                  leftSection={<IconLogout size={14} />}
                  onClick={logout}
                >
                  Logout
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </Group>
        </Group>
      </MantineAppShell.Header>

      <MantineAppShell.Navbar p="sm">
        {navItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <MantineAppShell.Section key={item.path}>
              <Group
                gap="sm"
                p="xs"
                style={{
                  cursor: "pointer",
                  borderRadius: "var(--mantine-radius-sm)",
                  backgroundColor: active
                    ? "var(--mantine-color-blue-light)"
                    : undefined,
                }}
                onClick={() => navigate(item.path)}
              >
                <item.icon size={20} />
                <Text size="sm">{item.label}</Text>
              </Group>
            </MantineAppShell.Section>
          );
        })}
      </MantineAppShell.Navbar>

      <MantineAppShell.Main>{children}</MantineAppShell.Main>

      <Modal
        opened={pwModalOpen}
        onClose={() => { setPwModalOpen(false); resetPwForm(); }}
        title="Change Password"
        size="sm"
      >
        <Stack>
          <TextInput
            label="Current Password"
            type="password"
            required
            value={currentPw}
            onChange={(e) => setCurrentPw(e.currentTarget.value)}
          />
          <TextInput
            label="New Password"
            type="password"
            required
            value={newPw}
            onChange={(e) => setNewPw(e.currentTarget.value)}
          />
          <TextInput
            label="Confirm New Password"
            type="password"
            required
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.currentTarget.value)}
          />
          <Button
            onClick={handleChangePassword}
            loading={changingPw}
            disabled={!currentPw || !newPw || !confirmPw}
          >
            Change Password
          </Button>
        </Stack>
      </Modal>
    </MantineAppShell>
  );
}
