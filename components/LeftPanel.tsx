import React, { useEffect, useState } from 'react';
import { CorpusStats, EvidenceDocument, PortfolioProject, UploadedDoc } from '../types';
import {
  checkPolicyBackendHealth,
  fetchCorpusStats,
  fetchEvidenceDocuments,
  fetchDocumentFileBlob,
  fetchDocumentPreview,
  uploadEvidenceDocument,
  ingestEvidenceDocument,
} from '../services/policyIntelligenceService';

const ALLOWED_EXTS = ['md', 'txt', 'json', 'html', 'htm', 'pdf', 'docx', 'xlsx', 'xls'];

function mapEvidenceDocument(doc: EvidenceDocument): UploadedDoc {
  return {
    id: doc.id,
    name: doc.title,
    type: doc.type || 'DOC',
    size: doc.chunkCount && doc.chunkCount > 0 ? `${doc.chunkCount} chunks` : 'No chunks yet',
    progress: 100,
    status: 'done',
    approval: doc.approvalStatus || doc.approval,
    ingestionStatus: doc.ingestionStatus,
    source: 'backend',
  };
}

interface LeftPanelProps {
  canManageCorpus?: boolean;
  isPlatformOwner?: boolean;
  selectedProjects?: PortfolioProject[];
  projectDocuments?: EvidenceDocument[];
}

export const LeftPanel: React.FC<LeftPanelProps> = ({
  canManageCorpus = false,
  isPlatformOwner = false,
  selectedProjects = [],
  projectDocuments = [],
}) => {
  const [docs, setDocs] = useState<UploadedDoc[]>([
    { id: 'static-1', name: 'Climate Action Plan portfolio assessment', type: 'CAP', size: 'Expected corpus', progress: 100, source: 'static' },
    { id: 'static-2', name: 'AQS baseline review and partner brief', type: 'AQS', size: 'Expected corpus', progress: 100, source: 'static' },
  ]);

  const [isDragging, setIsDragging] = useState(false);
  const [isRegistryLoading, setIsRegistryLoading] = useState(true);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [corpusStats, setCorpusStats] = useState<CorpusStats | null>(null);
  const [selectedPreview, setSelectedPreview] = useState<UploadedDoc | null>(null);

  const refreshDocuments = () => {
    setIsRegistryLoading(true);
    Promise.all([checkPolicyBackendHealth(), fetchEvidenceDocuments(), fetchCorpusStats()])
      .then(([healthy, backendDocs, stats]) => {
        setBackendAvailable(healthy);
        setCorpusStats(stats);
        setDocs((prev) => {
          const localDocs = prev.filter((doc) => doc.source === 'local' && doc.status !== 'done');
          const mappedDocs = backendDocs.map(mapEvidenceDocument);
          const staticDocs = [
            { id: 'static-1', name: 'Climate Action Plan portfolio assessment', type: 'CAP', size: 'Expected corpus', progress: 100, source: 'static' as const },
            { id: 'static-2', name: 'AQS baseline review and partner brief', type: 'AQS', size: 'Expected corpus', progress: 100, source: 'static' as const },
          ];

          return [...localDocs, ...mappedDocs, ...staticDocs].slice(0, 5);
        });
      })
      .catch((err) => {
        console.error('Document registry unavailable:', err);
        setBackendAvailable(false);
        setCorpusStats(null);
      })
      .finally(() => setIsRegistryLoading(false));
  };

  useEffect(() => {
    refreshDocuments();
  }, []);

  const displayedDocs =
    selectedProjects.length > 0
      ? projectDocuments.map(mapEvidenceDocument)
      : docs;

  const handleFileUpload = (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const newDoc: UploadedDoc = {
      id: Date.now().toString(),
      name: file.name,
      type: file.name.split('.').pop()?.toUpperCase() || 'FILE',
      size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      progress: 5,
      status: 'uploading',
      source: 'local',
      preview: '',
      canPreviewPdf: isPdf,
      pdfObjectUrl: isPdf ? URL.createObjectURL(file) : undefined,
    };

    setDocs(prev => [newDoc, ...prev].slice(0, 4));
    setSelectedPreview(newDoc);

    if (!isPdf && file.size < 2 * 1024 * 1024) {
      file.text()
        .then((text) => {
          const preview = text.slice(0, 500);
          setSelectedPreview((prev) => prev?.id === newDoc.id ? { ...prev, preview } : prev);
          setDocs((prev) => prev.map((doc) => doc.id === newDoc.id ? { ...doc, preview } : doc));
        })
        .catch(() => undefined);
    }

    uploadEvidenceDocument(file)
      .then((registeredDoc) => {
        setDocs(prev => prev.map(doc =>
          doc.id === newDoc.id
            ? { ...mapEvidenceDocument(registeredDoc), progress: 80, status: 'uploading' }
            : doc
        ));
        // Auto-ingest after upload
        return ingestEvidenceDocument(registeredDoc.id)
          .then(() => registeredDoc)
          .catch((ingestErr) => {
            console.warn("Auto-ingest failed (document still registered):", ingestErr);
            return registeredDoc;
          });
      })
      .then((registeredDoc) => {
        fetchDocumentPreview(registeredDoc.id)
          .then(async (previewDoc) => {
            let pdfObjectUrl: string | undefined;
            if (previewDoc.canPreviewPdf) {
              const blob = await fetchDocumentFileBlob(previewDoc.id);
              pdfObjectUrl = URL.createObjectURL(blob);
            }
            const mapped = {
              ...mapEvidenceDocument(previewDoc),
              preview: previewDoc.preview,
              canPreviewPdf: previewDoc.canPreviewPdf,
              pdfObjectUrl,
            };
            setSelectedPreview(mapped);
            setDocs((prev) => prev.map((doc) => doc.id === newDoc.id ? mapped : doc));
          })
          .catch(() => undefined);
        setDocs(prev => prev.map(doc =>
          doc.id === newDoc.id
            ? { ...mapEvidenceDocument(registeredDoc), progress: 100, status: 'done' }
            : doc
        ));
        refreshDocuments();
      })
      .catch((err) => {
        console.error("Evidence upload failed:", err);
        setDocs(prev => prev.map(doc =>
          doc.id === newDoc.id
            ? { ...doc, progress: 0, status: 'failed', name: `${file.name} (failed)` }
            : doc
        ));
      });
  };

  const handlePreviewDocument = (doc: UploadedDoc) => {
    setSelectedPreview(doc);
    if (doc.source !== 'backend') return;
    fetchDocumentPreview(doc.id)
      .then(async (previewDoc) => {
        let pdfObjectUrl: string | undefined;
        if (previewDoc.canPreviewPdf) {
          const blob = await fetchDocumentFileBlob(previewDoc.id);
          pdfObjectUrl = URL.createObjectURL(blob);
        }
        const mapped = {
          ...doc,
          preview: previewDoc.preview,
          canPreviewPdf: previewDoc.canPreviewPdf,
          pdfObjectUrl,
        };
        setSelectedPreview(mapped);
        setDocs((prev) => prev.map((item) => item.id === doc.id ? mapped : item));
      })
      .catch(() => undefined);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    Array.from(e.dataTransfer.files).forEach(file => {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (ALLOWED_EXTS.includes(ext)) {
        handleFileUpload(file);
      }
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (ALLOWED_EXTS.includes(ext)) {
          handleFileUpload(file);
        }
      });
    }
  };

  return (
    <div className="flex flex-col w-full gap-4 h-full max-h-screen overflow-y-auto pr-1 pointer-events-auto">
      
      {/* Environment Widget - Very Transparent */}
      <div className="glass-panel rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-colors backdrop-blur-sm">
        <div className="absolute top-0 left-0 w-1 h-full bg-emerald-300/60"></div>
        <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-display font-bold uppercase text-emerald-200 tracking-widest">Approved Evidence Corpus</h3>
            <span className={`text-[10px] border rounded px-2 py-0.5 ${
              backendAvailable
                ? 'text-emerald-200 border-emerald-300/20'
                : backendAvailable === false
                  ? 'text-amber-200 border-amber-300/20'
                  : 'text-gray-400 border-white/10'
            }`}>
              {backendAvailable ? 'Backend' : backendAvailable === false ? 'Offline' : 'Pilot'}
            </span>
        </div>
        
        <div className="space-y-2 mb-4">
            {[
              'Climate Action Plan portfolio assessment',
              'Executive brief materials',
              'AQS baseline review',
              'Moyiba AAP materials',
              'Public FCC climate documents'
            ].map((item) => (
              <div key={item} className="flex items-start gap-2 text-xs text-gray-300">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-sky-200 shrink-0"></span>
                <span>{item}</span>
              </div>
            ))}
        </div>
        
        <p className="text-[10px] text-gray-500 leading-relaxed">
          This panel represents curated briefing evidence for the prototype. It is not a live FCC data system or tracker replacement.
        </p>

        {corpusStats && (
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3">
            <div>
              <p className="text-[9px] uppercase tracking-widest text-gray-500">Docs</p>
              <p className="text-sm text-gray-100">{corpusStats.totalDocuments}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-gray-500">Indexed</p>
              <p className="text-sm text-emerald-200">{corpusStats.indexedDocuments}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest text-gray-500">Chunks</p>
              <p className="text-sm text-sky-200">{corpusStats.totalChunks}</p>
            </div>
          </div>
        )}
      </div>

      {/* Document Upload Zone */}
      <div 
        className="flex-1 glass-panel rounded-xl p-4 flex flex-col backdrop-blur-sm"
        onDragOver={(e) => {
          if (!canManageCorpus) return;
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => canManageCorpus && setIsDragging(false)}
        onDrop={canManageCorpus ? handleDrop : undefined}
      >
        <div className="flex justify-between items-center mb-4">
            <h3 className="text-xs font-display font-bold uppercase text-sky-200 tracking-widest">
              {selectedProjects.length > 0
                ? 'Project Evidence'
                : canManageCorpus
                  ? 'Evidence Upload'
                  : 'Corpus Registry'}
            </h3>
            {canManageCorpus && (
              <span className="text-[10px] text-gray-500">
                {isPlatformOwner ? 'Owner' : 'Operator'}
              </span>
            )}
            {isRegistryLoading && (
              <span className="text-[10px] text-gray-500">Loading registry</span>
            )}
        </div>

        {/* Drop Area */}
        {canManageCorpus ? (
          <div 
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer mb-4 group bg-black/5 ${
              isDragging 
                ? 'border-freetown-blue/50 bg-freetown-blue/10' 
                : 'border-white/10 hover:border-freetown-blue/50 hover:bg-freetown-blue/5'
            }`}
          >
            <input 
              type="file" 
              multiple 
              className="hidden" 
              id="file-upload" 
              onChange={handleFileSelect}
              accept=".md,.txt,.json,.html,.htm,.pdf,.docx,.xlsx,.xls"
            />
            <label htmlFor="file-upload">
              <svg className="w-8 h-8 text-gray-500 mx-auto mb-2 group-hover:text-freetown-blue transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-xs text-gray-300">Add evidence document</p>
              <p className="text-[9px] text-gray-600 mt-1">MD, TXT, JSON, HTML, PDF, DOCX, XLSX</p>
            </label>
          </div>
        ) : (
          <div className="border border-white/10 rounded-lg p-4 mb-4 bg-black/5">
            <p className="text-xs text-gray-300">Approved evidence view</p>
            <p className="text-[10px] text-gray-500 mt-1 leading-relaxed">
              {selectedProjects.length > 0
                ? `Showing documents linked to ${selectedProjects.map((project) => project.name).join(', ')}.`
                : 'Upload and ingestion operations are limited to corpus operators and the platform owner.'}
            </p>
          </div>
        )}

        <p className="text-[10px] text-gray-500 leading-relaxed mb-3">
          {canManageCorpus
            ? isPlatformOwner
              ? 'Platform-owner access includes corpus operations plus owner-only governance and debug routes.'
              : 'Corpus-operator access supports evidence upload, metadata updates, ingestion, and reindexing. Owner-only debug routes remain restricted.'
            : 'This panel shows the approved pilot corpus available for normal briefing use.'}
        </p>

        {/* File List */}
        <div className="flex-1 flex flex-col justify-between space-y-2">
          {displayedDocs.slice(0, 6).map(doc => (
            <button
              type="button"
              key={doc.id}
              onClick={() => handlePreviewDocument(doc)}
              className="text-left bg-black/5 p-2 rounded border border-white/5 flex items-center gap-3 group hover:border-white/20 transition-colors cursor-pointer hover:bg-black/10"
            >
              <div className="w-8 h-8 rounded bg-freetown-blue/10 flex items-center justify-center text-[10px] text-freetown-blue font-bold">
                {doc.type}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 truncate group-hover:text-white shadow-black">{doc.name}</p>
                <p className="text-[10px] text-gray-600">
                  {doc.status === 'failed'
                    ? 'Upload failed'
                    : doc.status === 'uploading'
                      ? 'Uploading...'
                      : `${doc.ingestionStatus || 'registered'} • ${doc.size}`}
                </p>
              </div>
              <div className={`w-1.5 h-1.5 rounded-full ${
                doc.status === 'failed'
                  ? 'bg-red-500'
                  : doc.progress === 100
                    ? 'bg-freetown-green'
                  : 'bg-freetown-blue'
              }`}></div>
            </button>
          ))}
          {displayedDocs.length === 0 && selectedProjects.length > 0 && (
            <div className="rounded border border-white/10 bg-black/10 p-3 text-xs text-gray-400 leading-relaxed">
              No linked documents yet. The backend will still use the selected project name to focus retrieval until documents are linked.
            </div>
          )}
        </div>

        {selectedPreview && (
          <div className="mt-4 border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] uppercase tracking-widest text-gray-500">Preview</p>
              <span className="text-[10px] text-gray-500">{selectedPreview.type}</span>
            </div>
            <p className="text-xs text-gray-200 mb-2 truncate">{selectedPreview.name}</p>
            {selectedPreview.canPreviewPdf && selectedPreview.pdfObjectUrl ? (
              <iframe
                title="PDF preview"
                src={selectedPreview.pdfObjectUrl}
                className="w-full h-52 rounded border border-white/10 bg-white"
              />
            ) : (
              <div className="max-h-48 overflow-y-auto rounded border border-white/10 bg-black/20 p-3">
                <p className="text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap">
                  {selectedPreview.preview || 'No text preview available yet.'}
                </p>
              </div>
            )}
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-white/10">
             <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-300 transition-colors flex items-center justify-center gap-2">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
                Review curated corpus
             </button>
        </div>
      </div>
    </div>
  );
};
