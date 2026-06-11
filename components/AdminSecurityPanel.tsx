import React, { useEffect, useState } from 'react';
import {
  fetchApiConfig,
  fetchApiUsageStatus,
  fetchSecurityDashboard,
  generateSecurityReport,
  saveApiConfig,
  testApiConfig,
} from '../services/policyIntelligenceService';
import { ApiUsageStatus, SecurityDashboard } from '../types';

function statusClass(status?: string): string {
  if (status === 'red') return 'bg-red-400';
  if (status === 'yellow') return 'bg-amber-300';
  return 'bg-emerald-300';
}

export const AdminSecurityPanel: React.FC = () => {
  const [usage, setUsage] = useState<ApiUsageStatus | null>(null);
  const [dashboard, setDashboard] = useState<SecurityDashboard | null>(null);
  const [config, setConfig] = useState<any>(null);
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: 'primary',
    providerType: 'nvidia',
    baseUrl: '',
    model: '',
    apiKey: '',
    timeoutMs: 30000,
    maxTokens: 800,
  });

  const refresh = () => {
    Promise.all([fetchApiUsageStatus(), fetchSecurityDashboard(), fetchApiConfig()])
      .then(([usageData, dashboardData, configData]) => {
        setUsage(usageData);
        setDashboard(dashboardData);
        setConfig(configData);
        const active = configData.active;
        if (active) {
          setForm((prev) => ({
            ...prev,
            name: active.name || prev.name,
            providerType: active.providerType || prev.providerType,
            baseUrl: active.baseUrl || '',
            model: active.model || '',
            timeoutMs: active.timeoutMs || 30000,
            maxTokens: active.maxTokens || 800,
          }));
        }
      })
      .catch(() => undefined);
  };

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const submitConfig = async () => {
    const confirmed = window.confirm('Apply API provider configuration for all users?');
    if (!confirmed) return;
    await saveApiConfig({ ...form, activate: true });
    setForm((prev) => ({ ...prev, apiKey: '' }));
    refresh();
  };

  const runTest = async () => {
    setTestResult('Testing...');
    try {
      const result = await testApiConfig();
      setTestResult(result.ok ? `Available (${result.latencyMs} ms)` : `Failed (${result.status})`);
    } catch (error) {
      setTestResult(error instanceof Error ? error.message.slice(0, 120) : 'Test failed');
    }
  };

  const runReport = async () => {
    const report = await generateSecurityReport();
    setTestResult(`Report generated: ${report.path}`);
  };

  return (
    <div className="glass-panel rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-display font-bold uppercase tracking-widest text-sky-200">
          Admin Security
        </h3>
        <span className={`h-2.5 w-2.5 rounded-full ${statusClass(usage?.status)}`} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-black/20 rounded border border-white/5 p-2">
          <span className="block text-gray-500 uppercase">Provider</span>
          <span className="text-gray-100">{usage?.provider.type || 'none'}</span>
        </div>
        <div className="bg-black/20 rounded border border-white/5 p-2">
          <span className="block text-gray-500 uppercase">Avg response</span>
          <span className="text-gray-100">{usage?.avgLatencyMs ?? 0} ms</span>
        </div>
        <div className="bg-black/20 rounded border border-white/5 p-2">
          <span className="block text-gray-500 uppercase">Today</span>
          <span className="text-gray-100">{usage?.todayQueries ?? 0} queries</span>
        </div>
        <div className="bg-black/20 rounded border border-white/5 p-2">
          <span className="block text-gray-500 uppercase">Errors</span>
          <span className="text-gray-100">{(usage?.errorRate ?? 0).toFixed(1)}%</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-[10px]">
        <div>
          <span className="block text-gray-500">Sessions</span>
          <span>{dashboard?.activeSessions ?? 0}</span>
        </div>
        <div>
          <span className="block text-gray-500">Suspicious</span>
          <span>{dashboard?.suspiciousActivity ?? 0}</span>
        </div>
        <div>
          <span className="block text-gray-500">Tokens</span>
          <span>{usage?.todayTokenUsage ?? 0}</span>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-3">
        <select
          value={form.providerType}
          onChange={(e) => setForm((prev) => ({ ...prev, providerType: e.target.value }))}
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
        >
          <option value="nvidia">NVIDIA</option>
          <option value="openai_compatible">OpenAI compatible</option>
          <option value="anthropic">Anthropic</option>
        </select>
        <input
          value={form.baseUrl}
          onChange={(e) => setForm((prev) => ({ ...prev, baseUrl: e.target.value }))}
          placeholder="Base URL"
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
        />
        <input
          value={form.model}
          onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
          placeholder="Model"
          className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
        />
        <div className="flex gap-1">
          <input
            value={apiKeyVisible ? form.apiKey : form.apiKey ? '••••••••' : ''}
            onChange={(e) => setForm((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder={config?.active?.apiKeyMasked || 'API key'}
            type={apiKeyVisible ? 'text' : 'password'}
            className="min-w-0 flex-1 bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => setApiKeyVisible((prev) => !prev)}
            className="px-2 rounded border border-white/10 text-[10px]"
          >
            Show
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={form.timeoutMs}
            onChange={(e) => setForm((prev) => ({ ...prev, timeoutMs: Number(e.target.value) }))}
            type="number"
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
          />
          <input
            value={form.maxTokens}
            onChange={(e) => setForm((prev) => ({ ...prev, maxTokens: Number(e.target.value) }))}
            type="number"
            className="bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs"
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          <button type="button" onClick={submitConfig} className="py-1.5 rounded bg-sky-500/20 border border-sky-300/20 text-[10px]">
            Save
          </button>
          <button type="button" onClick={runTest} className="py-1.5 rounded bg-white/5 border border-white/10 text-[10px]">
            Test
          </button>
          <button type="button" onClick={runReport} className="py-1.5 rounded bg-white/5 border border-white/10 text-[10px]">
            Report
          </button>
        </div>
      </div>

      {testResult && <p className="text-[10px] text-gray-400 leading-snug">{testResult}</p>}
    </div>
  );
};
