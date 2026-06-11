import React from 'react';
import { PortfolioProject } from '../types';

interface ProjectSelectorProps {
  projects: PortfolioProject[];
  selectedProjectIds: string[];
  onChange: (projectIds: string[]) => void;
  isLoading?: boolean;
}

const statusClasses = {
  on_track: 'text-emerald-200 border-emerald-300/25 bg-emerald-400/10',
  delayed: 'text-amber-200 border-amber-300/25 bg-amber-400/10',
  at_risk: 'text-red-200 border-red-300/25 bg-red-400/10',
};

const statusLabel = {
  on_track: 'On track',
  delayed: 'Delayed',
  at_risk: 'At risk',
};

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  projects,
  selectedProjectIds,
  onChange,
  isLoading = false,
}) => {
  const selectedPrimary = selectedProjectIds[0] || '';

  const setPrimary = (projectId: string) => {
    if (!projectId) {
      onChange([]);
      return;
    }
    const remaining = selectedProjectIds.filter((id) => id !== projectId);
    onChange([projectId, ...remaining]);
  };

  const toggleCompare = (projectId: string) => {
    if (selectedProjectIds.includes(projectId)) {
      onChange(selectedProjectIds.filter((id) => id !== projectId));
    } else {
      onChange([...selectedProjectIds, projectId]);
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-[0.18em] text-sky-200 font-semibold">
            FCC climate portfolio
          </div>
          <div className="mt-1 text-[11px] text-gray-400">
            Select a project to focus evidence retrieval and briefing context.
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <select
            value={selectedPrimary}
            onChange={(event) => setPrimary(event.target.value)}
            disabled={isLoading}
            className="min-w-[220px] rounded-md border border-white/15 bg-slate-950/80 px-3 py-2 text-xs text-white outline-none focus:border-sky-200/60"
          >
            <option value="">{isLoading ? 'Loading projects...' : 'All portfolio projects'}</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.displayName}
              </option>
            ))}
          </select>
          {selectedPrimary && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md border border-white/10 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-white/5"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {projects.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {projects.map((project) => {
            const selected = selectedProjectIds.includes(project.id);
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => toggleCompare(project.id)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors ${
                  selected
                    ? statusClasses[project.status]
                    : 'border-white/10 bg-white/5 text-gray-400 hover:text-white hover:border-white/20'
                }`}
                title="Toggle for project comparison"
              >
                {project.name}
                <span className="ml-2 opacity-75">{statusLabel[project.status]}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
