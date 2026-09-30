import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clapperboard, Monitor, Moon, Plus, Settings, Sun } from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { useTheme } from "@/components/theme/theme-provider";
import { listProjects } from "@/features/projects/projects-api";
import { COPY } from "@/config/copy";
import { SHORTCUTS, displayKeys } from "@/config/shortcuts";

export interface PaletteCommand {
  id: string;
  label: string;
  group: string;
  shortcut?: string[];
  icon?: React.ReactNode;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraCommands?: PaletteCommand[];
}

/**
 * Ctrl/Cmd+K palette: searches actions, projects and shortcuts.
 * The editor injects its own commands via `extraCommands`.
 */
export function GlobalCommandPalette({ open, onOpenChange, extraCommands = [] }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { setTheme } = useTheme();

  const projectsQuery = useQuery({
    queryKey: ["projects"],
    queryFn: listProjects,
    enabled: open,
  });

  const run = (fn: () => void) => {
    onOpenChange(false);
    fn();
  };

  const groups = React.useMemo(() => {
    const map = new Map<string, PaletteCommand[]>();
    for (const cmd of extraCommands) {
      const list = map.get(cmd.group) ?? [];
      list.push(cmd);
      map.set(cmd.group, list);
    }
    return map;
  }, [extraCommands]);

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} title={COPY.editor.commandPalette}>
      <CommandInput placeholder="Search actions, projects, shortcuts" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {[...groups.entries()].map(([group, commands]) => (
          <CommandGroup key={group} heading={group}>
            {commands.map((cmd) => (
              <CommandItem key={cmd.id} onSelect={() => run(cmd.run)}>
                {cmd.icon}
                {cmd.label}
                {cmd.shortcut && (
                  <CommandShortcut>{displayKeys(cmd.shortcut).join(" ")}</CommandShortcut>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => void navigate({ to: "/" }))}>
            <Clapperboard /> {COPY.nav.projects}
          </CommandItem>
          <CommandItem onSelect={() => run(() => void navigate({ to: "/settings" }))}>
            <Settings /> {COPY.nav.settings}
          </CommandItem>
        </CommandGroup>

        {(projectsQuery.data?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={COPY.nav.projects}>
              {projectsQuery.data!.slice(0, 8).map((project) => (
                <CommandItem
                  key={project.id}
                  value={`project ${project.name}`}
                  onSelect={() =>
                    run(() =>
                      void navigate({ to: "/editor/$projectId", params: { projectId: project.id } })
                    )
                  }
                >
                  <Plus className="opacity-0" />
                  {project.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading={COPY.theme.toggleLabel}>
          <CommandItem onSelect={() => run(() => setTheme("light"))}>
            <Sun /> {COPY.theme.light}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("dark"))}>
            <Moon /> {COPY.theme.dark}
          </CommandItem>
          <CommandItem onSelect={() => run(() => setTheme("system"))}>
            <Monitor /> {COPY.theme.system}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />
        <CommandGroup heading={COPY.editor.shortcuts}>
          {SHORTCUTS.slice(0, 10).map((s) => (
            <CommandItem key={s.id} value={`shortcut ${s.label}`} className="cursor-default">
              {s.label}
              <CommandShortcut>{displayKeys(s.keys).join(" + ")}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
