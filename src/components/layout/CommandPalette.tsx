import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import {
  useProjects,
  useTasks,
  useFields,
  useSections,
} from '../../hooks/useHierarchy';
import { StatusBadge, ProjectChip } from '../common/ui';
import type { Id, Status } from '../../lib/types';

interface CommandResult {
  type: 'project' | 'task';
  id: Id;
  label: string;
  status: Status;
  projectName?: string;
  fieldName?: string | null;
}

// Sem prop `open`: o AppShell monta este componente só enquanto a paleta está
// aberta, então estar montado *é* estar aberto. É isso que deixa a busca nascer
// vazia a cada abertura sem precisar de um efeito para limpá-la.
interface CommandPaletteProps {
  onClose: () => void;
}

export default function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const { data: projects = [] } = useProjects();
  const { data: tasks = [] } = useTasks();
  const { data: fields = [] } = useFields();
  const { data: sections = [] } = useSections();
  const navigate = useNavigate();

  const fieldsById = useMemo(
    () => new Map(fields.map((f) => [f.id, f])),
    [fields]
  );
  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const results = useMemo<CommandResult[]>(() => {
    const q = query.trim().toLowerCase();
    const projectMatches: CommandResult[] = projects
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .slice(0, 6)
      .map((p) => ({
        type: 'project',
        id: p.id,
        label: p.name,
        status: p.status,
        fieldName: p.field_id ? fieldsById.get(p.field_id)?.name : null,
      }));
    const taskMatches: CommandResult[] = tasks
      .filter((t) => !q || t.name.toLowerCase().includes(q))
      .slice(0, 8)
      .map((t) => {
        const section = t.section_id ? sectionsById.get(t.section_id) : null;
        const project = section?.project_id
          ? projectsById.get(section.project_id)
          : null;
        return {
          type: 'task',
          id: t.id,
          label: t.name,
          status: t.status,
          projectName: project?.name,
          fieldName: project?.field_id
            ? fieldsById.get(project.field_id)?.name
            : null,
        };
      });
    return [...projectMatches, ...taskMatches];
  }, [query, projects, tasks, fieldsById, sectionsById, projectsById]);

  function go(item: CommandResult) {
    onClose();
    if (item.type === 'project') navigate(`/projects/${item.id}`);
    else navigate(`/tasks?taskId=${item.id}`);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="border-nyx-700 bg-nyx-800 shadow-panel w-full max-w-lg overflow-hidden rounded-lg border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-nyx-700 flex items-center gap-2 border-b px-4 py-3">
          <Search size={16} className="text-nyx-500" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
            placeholder="Jump to a project or task…"
            className="text-nyx-100 placeholder:text-nyx-500 flex-1 bg-transparent text-body focus:outline-hidden"
          />
        </div>
        <div className="max-h-80 overflow-y-auto py-1.5">
          {results.map((item) => (
            <button
              key={`${item.type}-${item.id}`}
              onClick={() => go(item)}
              className="text-nyx-200 hover:bg-nyx-700 flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-body"
            >
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                {item.type === 'project' ? (
                  <ProjectChip
                    name={item.label}
                    fieldName={item.fieldName}
                    className="text-nyx-200 text-body"
                  />
                ) : (
                  <>
                    <span className="truncate">{item.label}</span>
                    {item.projectName && (
                      <ProjectChip
                        name={item.projectName}
                        fieldName={item.fieldName}
                      />
                    )}
                  </>
                )}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-nyx-600 text-caption tracking-wide uppercase">
                  {item.type}
                </span>
                <StatusBadge status={item.status} />
              </span>
            </button>
          ))}
          {!results.length && (
            <p className="text-nyx-600 px-4 py-6 text-center text-body">
              Nothing found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
