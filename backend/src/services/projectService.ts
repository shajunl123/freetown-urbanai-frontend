import { v4 as uuidv4 } from 'uuid';
import db from '../db.js';
import type { DocumentRow, ProjectRow } from '../types.js';

export type ProjectStatus = 'on_track' | 'delayed' | 'at_risk';
export type ProjectRiskLevel = 'low' | 'medium' | 'high';

export interface PortfolioProjectSeed {
  slug: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  riskLevel: ProjectRiskLevel;
  progress: number;
  overview: string;
  keyMetrics: string[];
  keywords: string[];
}

export interface SerializedProject {
  id: string;
  slug: string;
  name: string;
  displayName: string;
  status: ProjectStatus;
  riskLevel: ProjectRiskLevel;
  progress: number;
  overview: string;
  keyMetrics: string[];
  keywords: string[];
  documentCount: number;
  createdAt: string;
  updatedAt: string | null;
}

const portfolioProjects: PortfolioProjectSeed[] = [
  {
    slug: 'heat-resilience',
    name: 'Heat Resilience',
    displayName: 'Heat Resilience（热韧性）',
    status: 'at_risk',
    riskLevel: 'high',
    progress: 42,
    overview:
      'Heat resilience is a high-visibility climate priority with strong strategic value, but delivery claims require careful evidence on implementation, vulnerable communities, and measurable outcomes.',
    keyMetrics: ['Heat risk mapping', 'Community cooling interventions', 'Implementation verification'],
    keywords: ['heat', 'resilience', 'cooling', 'temperature', 'urban heat', 'vulnerable'],
  },
  {
    slug: 'water-sanitation',
    name: 'Water & Sanitation',
    displayName: 'Water & Sanitation（水和卫生）',
    status: 'delayed',
    riskLevel: 'medium',
    progress: 48,
    overview:
      'Water and sanitation interventions are important service-delivery anchors, but progress claims should distinguish FCC actions from partner- and utility-dependent delivery.',
    keyMetrics: ['Settlement service access', 'Partner coordination', 'Delivery verification'],
    keywords: ['water', 'sanitation', 'wash', 'drainage', 'toilet', 'hygiene'],
  },
  {
    slug: 'cable-car',
    name: 'Cable Car',
    displayName: 'Cable Car（缆车项目）',
    status: 'at_risk',
    riskLevel: 'high',
    progress: 28,
    overview:
      'The cable car is a distinctive green-mobility platform, but it remains sensitive for external claims because feasibility, financing, approvals, and delivery pathway need stronger evidence.',
    keyMetrics: ['Feasibility status', 'Financing pathway', 'Approval requirements'],
    keywords: ['cable car', 'cablecar', 'ropeway', 'gondola', 'mobility', 'transport'],
  },
  {
    slug: 'waste-management',
    name: 'Waste Management',
    displayName: 'Waste Management（废物管理）',
    status: 'on_track',
    riskLevel: 'low',
    progress: 68,
    overview:
      'Waste management is one of the stronger delivery anchors in the climate portfolio and can support credible claims when wording stays close to operational evidence.',
    keyMetrics: ['Collection improvements', 'Operational partnerships', 'Service delivery evidence'],
    keywords: ['waste', 'solid waste', 'collection', 'landfill', 'recycling', 'sanitation'],
  },
  {
    slug: 'urban-mobility',
    name: 'Urban Mobility',
    displayName: 'Urban Mobility（城市交通）',
    status: 'delayed',
    riskLevel: 'medium',
    progress: 45,
    overview:
      'Urban mobility includes promising low-carbon transport directions, but claim strength depends on implementation stage, partner control, and confirmed delivery milestones.',
    keyMetrics: ['Low-carbon mobility', 'Partner dependency', 'Implementation milestones'],
    keywords: ['mobility', 'transport', 'transit', 'traffic', 'road', 'bus'],
  },
  {
    slug: 'green-infrastructure',
    name: 'Green Infrastructure',
    displayName: 'Green Infrastructure（绿色基础设施）',
    status: 'on_track',
    riskLevel: 'medium',
    progress: 56,
    overview:
      'Green infrastructure can support resilience and public-space claims, but external wording should separate planning, restoration, and verified implementation.',
    keyMetrics: ['Restoration base', 'Public-space interventions', 'Implementation evidence'],
    keywords: ['green infrastructure', 'restoration', 'tree', 'mangrove', 'public space', 'nature'],
  },
  {
    slug: 'air-quality',
    name: 'Air Quality',
    displayName: 'Air Quality（空气质量）',
    status: 'on_track',
    riskLevel: 'low',
    progress: 72,
    overview:
      'Air quality is a strong evidence-building area when claims focus on baseline assessment, monitoring, and policy learning rather than overstating health outcomes.',
    keyMetrics: ['AQS baseline', 'Sensor monitoring', 'Policy evidence base'],
    keywords: ['air quality', 'aqs', 'sensor', 'pm2.5', 'pollution', 'moyiba', 'baseline'],
  },
  {
    slug: 'flood-adaptation',
    name: 'Flood Adaptation',
    displayName: 'Flood Adaptation（洪水适应）',
    status: 'at_risk',
    riskLevel: 'high',
    progress: 38,
    overview:
      'Flood adaptation is a major resilience priority, but claims should be conservative unless drainage, settlement-level interventions, financing, and handover evidence are current.',
    keyMetrics: ['Drainage interventions', 'Settlement vulnerability', 'Financing and handover'],
    keywords: ['flood', 'flooding', 'drainage', 'adaptation', 'settlement', 'rainfall'],
  },
];

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function serializeProject(row: ProjectRow): SerializedProject {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    displayName: row.display_name || row.name,
    status: row.status as ProjectStatus,
    riskLevel: row.risk_level as ProjectRiskLevel,
    progress: row.progress ?? 0,
    overview: row.overview || '',
    keyMetrics: parseJsonArray(row.key_metrics_json),
    keywords: parseJsonArray(row.keywords_json),
    documentCount: row.document_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function seedPortfolioProjects(): void {
  const insert = db.prepare(
    `INSERT INTO projects (
       id, slug, name, display_name, status, risk_level, progress,
       overview, key_metrics_json, keywords_json, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET
       name = excluded.name,
       display_name = excluded.display_name,
       status = excluded.status,
       risk_level = excluded.risk_level,
       progress = excluded.progress,
       overview = excluded.overview,
       key_metrics_json = excluded.key_metrics_json,
       keywords_json = excluded.keywords_json,
       updated_at = excluded.updated_at`
  );
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    for (const project of portfolioProjects) {
      const existing = db.prepare('SELECT id FROM projects WHERE slug = ?').get(project.slug) as
        | { id: string }
        | undefined;
      insert.run(
        existing?.id ?? uuidv4(),
        project.slug,
        project.name,
        project.displayName,
        project.status,
        project.riskLevel,
        project.progress,
        project.overview,
        JSON.stringify(project.keyMetrics),
        JSON.stringify(project.keywords),
        now
      );
    }
  });
  tx();
}

export function listProjects(): SerializedProject[] {
  seedPortfolioProjects();
  const rows = db
    .prepare(
      `SELECT p.*,
              COUNT(pd.document_id) AS document_count
       FROM projects p
       LEFT JOIN project_documents pd ON pd.project_id = p.id
       WHERE p.archived_at IS NULL
       GROUP BY p.id
       ORDER BY
         CASE p.status WHEN 'at_risk' THEN 0 WHEN 'delayed' THEN 1 ELSE 2 END,
         p.name ASC`
    )
    .all() as ProjectRow[];
  return rows.map(serializeProject);
}

export function getProject(idOrSlug: string): SerializedProject | undefined {
  seedPortfolioProjects();
  const row = db
    .prepare(
      `SELECT p.*,
              COUNT(pd.document_id) AS document_count
       FROM projects p
       LEFT JOIN project_documents pd ON pd.project_id = p.id
       WHERE (p.id = ? OR p.slug = ?) AND p.archived_at IS NULL
       GROUP BY p.id`
    )
    .get(idOrSlug, idOrSlug) as ProjectRow | undefined;
  return row ? serializeProject(row) : undefined;
}

export function getProjectsByIds(ids: string[]): SerializedProject[] {
  if (ids.length === 0) return [];
  return ids.map((id) => getProject(id)).filter((project): project is SerializedProject => Boolean(project));
}

export function createProject(params: Partial<PortfolioProjectSeed> & { name: string }): SerializedProject {
  const id = uuidv4();
  const slug =
    params.slug ||
    params.name
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO projects (
       id, slug, name, display_name, status, risk_level, progress,
       overview, key_metrics_json, keywords_json, created_at, updated_at
     )
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    slug,
    params.name,
    params.displayName || params.name,
    params.status || 'at_risk',
    params.riskLevel || 'medium',
    params.progress ?? 0,
    params.overview || '',
    JSON.stringify(params.keyMetrics || []),
    JSON.stringify(params.keywords || []),
    now,
    now
  );
  return getProject(id)!;
}

export function updateProject(idOrSlug: string, params: Partial<PortfolioProjectSeed>): SerializedProject | undefined {
  const existing = getProject(idOrSlug);
  if (!existing) return undefined;

  const updates: string[] = [];
  const values: unknown[] = [];
  if (params.name !== undefined) {
    updates.push('name = ?');
    values.push(params.name);
  }
  if (params.displayName !== undefined) {
    updates.push('display_name = ?');
    values.push(params.displayName);
  }
  if (params.status !== undefined) {
    updates.push('status = ?');
    values.push(params.status);
  }
  if (params.riskLevel !== undefined) {
    updates.push('risk_level = ?');
    values.push(params.riskLevel);
  }
  if (params.progress !== undefined) {
    updates.push('progress = ?');
    values.push(params.progress);
  }
  if (params.overview !== undefined) {
    updates.push('overview = ?');
    values.push(params.overview);
  }
  if (params.keyMetrics !== undefined) {
    updates.push('key_metrics_json = ?');
    values.push(JSON.stringify(params.keyMetrics));
  }
  if (params.keywords !== undefined) {
    updates.push('keywords_json = ?');
    values.push(JSON.stringify(params.keywords));
  }
  if (updates.length === 0) return existing;
  updates.push('updated_at = ?');
  values.push(new Date().toISOString(), existing.id);
  db.prepare(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`).run(...values);
  return getProject(existing.id);
}

export function archiveProject(idOrSlug: string): boolean {
  const existing = getProject(idOrSlug);
  if (!existing) return false;
  const now = new Date().toISOString();
  const result = db
    .prepare('UPDATE projects SET archived_at = ?, updated_at = ? WHERE id = ?')
    .run(now, now, existing.id);
  return result.changes > 0;
}

function documentMatchesProject(doc: DocumentRow, project: SerializedProject): { matched: boolean; score: number; reason: string } {
  const haystack = `${doc.title} ${doc.type || ''} ${doc.file_name || ''} ${doc.source_url || ''}`.toLowerCase();
  const matchedKeywords = project.keywords.filter((keyword) => haystack.includes(keyword.toLowerCase()));
  return {
    matched: matchedKeywords.length > 0,
    score: Math.min(0.95, 0.45 + matchedKeywords.length * 0.15),
    reason: matchedKeywords.length > 0 ? `title/meta keywords: ${matchedKeywords.join(', ')}` : '',
  };
}

export function syncProjectDocumentLinks(): void {
  seedPortfolioProjects();
  const projects = listProjects();
  const docs = db
    .prepare('SELECT * FROM documents WHERE deleted_at IS NULL')
    .all() as DocumentRow[];
  const insert = db.prepare(
    `INSERT INTO project_documents (project_id, document_id, relevance, match_reason)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, document_id) DO UPDATE SET
       relevance = excluded.relevance,
       match_reason = excluded.match_reason`
  );

  const tx = db.transaction(() => {
    for (const project of projects) {
      for (const doc of docs) {
        const match = documentMatchesProject(doc, project);
        if (match.matched) {
          insert.run(project.id, doc.id, match.score, match.reason);
        }
      }
    }
  });
  tx();
}

export function listProjectDocuments(idOrSlug: string): DocumentRow[] {
  const project = getProject(idOrSlug);
  if (!project) return [];
  syncProjectDocumentLinks();
  return db
    .prepare(
      `SELECT d.*
       FROM project_documents pd
       JOIN documents d ON d.id = pd.document_id
       WHERE pd.project_id = ? AND d.deleted_at IS NULL
       ORDER BY pd.relevance DESC, d.updated_at DESC, d.created_at DESC`
    )
    .all(project.id) as DocumentRow[];
}

export function getProjectDocumentIds(projectIds: string[]): string[] {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  if (ids.length === 0) return [];
  syncProjectDocumentLinks();
  const projects = getProjectsByIds(ids);
  if (projects.length === 0) return [];
  const rows = db
    .prepare(
      `SELECT DISTINCT document_id
       FROM project_documents
       WHERE project_id IN (${projects.map(() => '?').join(', ')})`
    )
    .all(...projects.map((project) => project.id)) as Array<{ document_id: string }>;
  return rows.map((row) => row.document_id);
}

seedPortfolioProjects();
