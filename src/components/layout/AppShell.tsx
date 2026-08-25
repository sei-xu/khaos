import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { NavLinkRenderProps } from 'react-router-dom';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import {
  LayoutDashboard,
  ListTodo,
  CalendarDays,
  Tags,
  Command,
  Plus,
  Menu,
  X,
  FolderKanban,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import {
  useFields,
  useProjects,
  useProjectMutations,
} from '../../hooks/useHierarchy';
import ActiveTimerWidget from '../timeTracking/ActiveTimerWidget';
import QuickAddBar from '../tasks/QuickAddBar';
import CommandPalette from './CommandPalette';
import TimezonePicker from '../common/TimezonePicker';
import ChatPanel from '../assistant/ChatPanel';
import KhaosIcon from '../common/KhaosIcon'; // Certifique-se de que o caminho relativo está correto
import { StatusBadge, ProjectChip } from '../common/ui';
import { useProcessingContext } from '../../lib/processingContext';
import { useChatActivity } from '../../lib/chat/chatActivityContext';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

// Bottom tab bar items (mobile) — Mantido sem o link fixo do Assistant porque ele vive no balão flutuante
const BOTTOM_NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
];

// Full sidebar nav (desktop) — Mantido sem o link fixo do Assistant porque ele vive no painel lateral persistente
const SIDEBAR_NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: LayoutDashboard, end: true },
  { to: '/tasks', label: 'All tasks', icon: ListTodo },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/routines', label: 'Routines', icon: RefreshCw },
  { to: '/tags', label: 'Tags', icon: Tags },
];

function sidebarLinkClass({ isActive }: NavLinkRenderProps): string {
  return clsx(
    'flex items-center gap-2 rounded-md px-2 py-1.5 text-body font-medium transition-colors',
    isActive
      ? 'bg-eros-500/15 text-eros-400'
      : 'text-nyx-300 hover:bg-nyx-800 hover:text-nyx-100'
  );
}

function bottomLinkClass({ isActive }: NavLinkRenderProps): string {
  return clsx(
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-label font-medium transition-colors',
    isActive ? 'text-eros-400' : 'text-nyx-500'
  );
}

function KhaosLogo({ spinning }: { spinning?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <KhaosIcon size="h-5 w-5" spin={spinning} />
      <span className="font-display text-nyx-100 text-base font-semibold tracking-tight">
        Khaos
      </span>
    </div>
  );
}

interface SidebarProps {
  onNavigate: () => void;
  onClose?: () => void;
  spinning?: boolean;
  // Icon-only rail mode (desktop only — the mobile drawer is never
  // collapsed). When set, `onToggleCollapse` renders the expand/collapse
  // button in place of the logo's text.
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

function Sidebar({
  onNavigate,
  onClose,
  spinning,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { data: fields = [] } = useFields();
  const { data: projects = [] } = useProjects();
  const { create } = useProjectMutations();
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onOpenPalette() {
      setPaletteOpen(true);
    }
    window.addEventListener('open-palette', onOpenPalette);
    return () => window.removeEventListener('open-palette', onOpenPalette);
  }, []);

  const fieldsById = new Map(fields.map((f) => [f.id, f]));
  const fieldOrder = new Map(fields.map((f, i) => [f.id, i]));
  const sortedProjects = [...projects].sort((a, b) => {
    const orderA = a.field_id ? (fieldOrder.get(a.field_id) ?? fields.length) : fields.length;
    const orderB = b.field_id ? (fieldOrder.get(b.field_id) ?? fields.length) : fields.length;
    return orderA - orderB;
  });

  return (
    <>
      <div
        className={clsx(
          'flex items-center py-4',
          collapsed ? 'flex-col gap-3 px-2' : 'justify-between px-4'
        )}
      >
        {collapsed ? (
          <KhaosIcon size="h-5 w-5" spin={spinning} />
        ) : (
          <KhaosLogo spinning={spinning} />
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="text-nyx-400 hover:text-nyx-100"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="text-nyx-500 hover:bg-nyx-800 hover:text-nyx-200 flex h-6 w-6 shrink-0 items-center justify-center rounded"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      <nav className={clsx('space-y-0.5', collapsed ? 'px-2' : 'px-3')}>
        {SIDEBAR_NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={sidebarLinkClass}
            onClick={onNavigate}
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={16} />
            {!collapsed && item.label}
          </NavLink>
        ))}
      </nav>

      {collapsed ? (
        <div className="mt-3 flex justify-center">
          <button
            onClick={() => {
              const name = window.prompt('New project name');
              if (name?.trim())
                create.mutate({ name: name.trim(), status: 'planning' });
            }}
            className="text-nyx-500 hover:bg-nyx-800 hover:text-nyx-200 flex h-6 w-6 items-center justify-center rounded"
            aria-label="New project"
            title="New project"
          >
            <Plus size={14} />
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between px-4">
          <span className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
            Projects
          </span>
          <button
            onClick={() => {
              const name = window.prompt('New project name');
              if (name?.trim())
                create.mutate({ name: name.trim(), status: 'planning' });
            }}
            className="text-nyx-500 hover:bg-nyx-800 hover:text-nyx-200 flex h-5 w-5 items-center justify-center rounded"
            aria-label="New project"
          >
            <Plus size={13} />
          </button>
        </div>
      )}

      <div
        className={clsx(
          'mt-2 flex-1 space-y-0.5 overflow-y-auto pb-4',
          collapsed ? 'px-2' : 'px-3'
        )}
      >
        {sortedProjects.map((p) =>
          collapsed ? (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={sidebarLinkClass}
              onClick={onNavigate}
              title={p.name}
            >
              <FolderKanban size={16} className="shrink-0" />
            </NavLink>
          ) : (
            <NavLink
              key={p.id}
              to={`/projects/${p.id}`}
              className={sidebarLinkClass}
              onClick={onNavigate}
            >
              <ProjectChip
                name={p.name}
                fieldName={p.field_id ? fieldsById.get(p.field_id)?.name : null}
                className="min-w-0 flex-1 text-body text-inherit"
              />
              <StatusBadge status={p.status} />
            </NavLink>
          )
        )}
        {!collapsed && !projects.length && (
          <p className="text-nyx-600 px-2 text-caption">
            Create a project to get started.
          </p>
        )}
      </div>

      <button
        onClick={() => setPaletteOpen(true)}
        title={collapsed ? 'Quick navigate (⌘K)' : undefined}
        className={clsx(
          'border-nyx-700 text-nyx-500 hover:border-nyx-600 hover:text-nyx-300 mb-3 flex items-center rounded-md border text-caption',
          collapsed
            ? 'mx-2 justify-center px-2 py-1.5'
            : 'mx-3 justify-between px-2 py-1.5'
        )}
      >
        <span className="flex items-center gap-1.5">
          <Command size={12} /> {!collapsed && 'Quick navigate'}
        </span>
        {!collapsed && <span className="font-mono">⌘K</span>}
      </button>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </>
  );
}

const SIDEBAR_COLLAPSED_KEY = 'khaos.sidebarCollapsed';

export default function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatSheetOpen, setChatSheetOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
  );

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0');
  }, [sidebarCollapsed]);
  const { hasUnseenOpener, markOpenerSeen } = useChatActivity();
  const hasChatActivity = hasUnseenOpener;
  const { isAssistantProcessing } = useProcessingContext();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const spinning = isAssistantProcessing || isFetching > 0 || isMutating > 0;
  const location = useLocation();

  // Close drawer/sheet on route change
  useEffect(() => {
    setDrawerOpen(false);
    setChatSheetOpen(false);
  }, [location.pathname]);

  // Cmd+K palette shortcut, Esc closes any overlay
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setDrawerOpen(false);
        window.dispatchEvent(new CustomEvent('open-palette'));
      }
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setChatSheetOpen(false);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="bg-nyx-900 flex h-dvh overflow-hidden">
      {/* ── Desktop nav sidebar ─────────────────────────────── */}
      <aside
        className={clsx(
          'border-nyx-700 bg-nyx-900 hidden shrink-0 flex-col border-r transition-[width] duration-150 md:flex',
          sidebarCollapsed ? 'w-14' : 'w-60'
        )}
      >
        <Sidebar
          onNavigate={() => {}}
          spinning={spinning}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        />
      </aside>

      {/* ── Mobile drawer backdrop ───────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* ── Mobile drawer panel ──────────────────────────────── */}
      <aside
        className={clsx(
          'border-nyx-700 bg-nyx-900 fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r transition-transform duration-200 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-1 flex-col overflow-hidden">
          <Sidebar
            onNavigate={() => setDrawerOpen(false)}
            onClose={() => setDrawerOpen(false)}
            spinning={spinning}
          />
        </div>
      </aside>

      {/* ── Main content + persistent chat ──────────────────── */}
      <div className="flex min-w-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="border-nyx-700 flex shrink-0 items-center gap-2 border-b px-3 py-2 md:px-5 md:py-3">
            <button
              onClick={() => setDrawerOpen(true)}
              className="text-nyx-400 hover:bg-nyx-800 flex h-8 w-8 shrink-0 items-center justify-center rounded md:hidden"
              aria-label="Open menu"
            >
              <Menu size={18} />
            </button>

            <QuickAddBar />

            <div className="hidden sm:block">
              <ActiveTimerWidget />
            </div>
            <TimezonePicker />
          </header>

          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            <Outlet />
          </main>

          {/* ── Mobile bottom tab bar ─────────────────────────── */}
          <nav className="border-nyx-700 bg-nyx-900 flex shrink-0 border-t md:hidden">
            {BOTTOM_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={bottomLinkClass}
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* ── Persistent chat column — desktop/lg only ────────── */}
        <aside className="border-nyx-700 bg-nyx-900 hidden w-100 shrink-0 flex-col border-l lg:flex">
          <ChatPanel />
        </aside>
      </div>

      {/* ── Mobile floating chat bubble ──────────────────────── */}
      {!chatSheetOpen && (
        <button
          onClick={() => {
            setChatSheetOpen(true);
            markOpenerSeen();
          }}
          className="shadow-panel fixed right-4 bottom-20 z-30 flex items-center justify-center rounded-full lg:hidden"
          aria-label={
            hasChatActivity ? 'Open assistant (waiting for you)' : 'Open assistant'
          }
        >
          <KhaosIcon
            size="h-13 w-13"
            bgColor="bg-eros-500"
            color="text-nyx-900"
            spin={true}
          />
          {hasChatActivity && (
            <span className="border-nyx-900 bg-tartarus-500 absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2" />
          )}
        </button>
      )}

      {/* ── Mobile chat bottom-sheet ─────────────────────────── */}
      {chatSheetOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setChatSheetOpen(false)}
          />
          <div className="border-nyx-700 bg-nyx-900 shadow-panel relative flex h-[88vh] flex-col rounded-t-2xl border-t">
            <ChatPanel onRequestClose={() => setChatSheetOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
