import React, { useCallback, useEffect, useState } from 'react';
import {
  fetchApiUsageStatus,
  fetchSecurityDashboard,
  fetchApiConfig,
  saveApiConfig,
  testApiConfig,
  generateSecurityReport,
} from '../services/policyIntelligenceService';
import { fetchAdminOverview, fetchAdminUsers, fetchAdminUserDetail, fetchAdminUserUsage, fetchAdminUserActivity, fetchAdminAuditLog, createAdminUser, updateAdminUser, disableAdminUser, enableAdminUser, deleteAdminUser } from '../services/adminServiceExtended';
import { fetchAdminSessions, fetchAdminSessionMessages, fetchAdminDocuments, fetchAdminDocumentChunks, updateAdminDocumentApproval, fetchAdminProjectsOverview } from '../services/adminServiceExtended';
import { AuthUser } from '../types';

type AdminTab = 'overview' | 'users' | 'user-detail' | 'activity' | 'chat' | 'evidence' | 'projects' | 'api' | 'security' | 'audit';

interface AdminCommandCenterProps {
  currentUser: AuthUser;
}

export const AdminCommandCenter: React.FC<AdminCommandCenterProps> = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [userUsage, setUserUsage] = useState<any>(null);
  const [userActivity, setUserActivity] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [apiUsage, setApiUsage] = useState<any>(null);
  const [securityDashboard, setSecurityDashboard] = useState<any>(null);
  const [apiConfig, setApiConfig] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', name: '', password: '', role: 'briefing_user' });
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [sessionMessages, setSessionMessages] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<any>(null);
  const [documentChunks, setDocumentChunks] = useState<any[]>([]);
  const [adminProjects, setAdminProjects] = useState<any[]>([]);

  const refreshOverview = useCallback(async () => {
    try {
      const data = await fetchAdminOverview();
      setOverview(data);
    } catch (err) {
      console.error('Failed to fetch overview:', err);
    }
  }, []);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await fetchAdminUsers();
      setUsers(data.users);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    }
  }, []);

  const refreshApiData = useCallback(async () => {
    try {
      const [usage, security, config] = await Promise.all([
        fetchApiUsageStatus(),
        fetchSecurityDashboard(),
        fetchApiConfig(),
      ]);
      setApiUsage(usage);
      setSecurityDashboard(security);
      setApiConfig(config);
    } catch (err) {
      console.error('Failed to fetch API data:', err);
    }
  }, []);

  const refreshAuditLog = useCallback(async () => {
    try {
      const data = await fetchAdminAuditLog(100);
      setAuditLogs(data.logs);
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'overview') refreshOverview();
    if (activeTab === 'users' || activeTab === 'user-detail') refreshUsers();
    if (activeTab === 'api' || activeTab === 'security') refreshApiData();
    if (activeTab === 'audit') refreshAuditLog();
    if (activeTab === 'chat') refreshSessions();
    if (activeTab === 'evidence') refreshDocuments();
    if (activeTab === 'projects') refreshProjects();
  }, [activeTab, refreshOverview, refreshUsers, refreshApiData, refreshAuditLog]);

  const refreshSessions = useCallback(async () => {
    try {
      const data = await fetchAdminSessions();
      setSessions(data.sessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  }, []);

  const refreshDocuments = useCallback(async () => {
    try {
      const data = await fetchAdminDocuments();
      setDocuments(data.documents);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  }, []);

  const refreshProjects = useCallback(async () => {
    try {
      const data = await fetchAdminProjectsOverview();
      setAdminProjects(data.projects);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    }
  }, []);

  const handleViewSession = async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await fetchAdminSessionMessages(sessionId);
      setSelectedSession(data.session);
      setSessionMessages(data.messages);
    } catch (err) {
      console.error('Failed to fetch session messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDocument = async (documentId: string) => {
    setLoading(true);
    try {
      const data = await fetchAdminDocumentChunks(documentId);
      setSelectedDocument(data.document);
      setDocumentChunks(data.chunks);
    } catch (err) {
      console.error('Failed to fetch document chunks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprovalChange = async (documentId: string, approvalStatus: string) => {
    try {
      await updateAdminDocumentApproval(documentId, approvalStatus);
      refreshDocuments();
      if (selectedDocument?.id === documentId) {
        setSelectedDocument({ ...selectedDocument, approval_status: approvalStatus, approval: approvalStatus });
      }
    } catch (err) {
      console.error('Failed to update approval:', err);
    }
  };

  const handleViewUser = async (userId: string) => {
    setLoading(true);
    try {
      const [detail, usage, activity] = await Promise.all([
        fetchAdminUserDetail(userId),
        fetchAdminUserUsage(userId),
        fetchAdminUserActivity(userId, 50),
      ]);
      setSelectedUser(detail);
      setUserUsage(usage);
      setUserActivity(activity.activity);
      setActiveTab('user-detail');
    } catch (err) {
      console.error('Failed to fetch user detail:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) return;
    try {
      await createAdminUser(newUser);
      setShowCreateUser(false);
      setNewUser({ email: '', name: '', password: '', role: 'briefing_user' });
      refreshUsers();
    } catch (err) {
      console.error('Failed to create user:', err);
    }
  };

  const handleToggleUser = async (userId: string, isActive: boolean) => {
    try {
      if (isActive) {
        await disableAdminUser(userId);
      } else {
        await enableAdminUser(userId);
      }
      refreshUsers();
    } catch (err) {
      console.error('Failed to toggle user:', err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    try {
      await deleteAdminUser(userId);
      refreshUsers();
      if (selectedUser?.id === userId) {
        setActiveTab('users');
        setSelectedUser(null);
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: string }> = [
    { id: 'overview', label: 'System Overview', icon: '📊' },
    { id: 'users', label: 'Team & Users', icon: '👥' },
    { id: 'activity', label: 'Activity Logs', icon: '📋' },
    { id: 'chat', label: 'Chat History', icon: '💬' },
    { id: 'evidence', label: 'Evidence', icon: '📄' },
    { id: 'projects', label: 'Projects', icon: '🏗️' },
    { id: 'api', label: 'API & Model', icon: '🔌' },
    { id: 'security', label: 'Security', icon: '🛡️' },
    { id: 'audit', label: 'Audit Trail', icon: '🔍' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-950/50 rounded-lg border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-slate-950/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-amber-500/20 flex items-center justify-center">
              <span className="text-amber-200 text-sm font-bold">A</span>
            </div>
            <div>
              <h2 className="text-sm font-display font-bold text-white uppercase tracking-wider">
                Admin Command Center
              </h2>
              <p className="text-[10px] text-gray-400">
                Platform Owner Access • {currentUser.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-emerald-200 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
              Full Access
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-white/10 bg-slate-950/20 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'text-white border-b-2 border-amber-400 bg-white/5'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="mr-1.5">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Overview Tab */}
        {activeTab === 'overview' && overview && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Users" value={overview.totalUsers} sub={`${overview.activeUsers} active`} />
              <StatCard label="Active Sessions" value={overview.activeSessions} sub={`${overview.totalSessions} total`} />
              <StatCard label="Documents" value={overview.totalDocuments} sub={`${overview.indexedDocuments} indexed`} />
              <StatCard label="Today's Queries" value={overview.todayQueries} sub={`${overview.weekQueries} this week`} />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard label="Total Chunks" value={overview.totalChunks} />
              <StatCard label="Projects" value={overview.totalProjects} />
              <StatCard label="Total Queries" value={overview.totalQueries} />
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">API Status</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-gray-500">Provider</span>
                  <p className="text-white">{overview.apiStatus.providerType}</p>
                </div>
                <div>
                  <span className="text-gray-500">Model</span>
                  <p className="text-white">{overview.apiStatus.model}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status</span>
                  <p className={overview.apiStatus.status === 'available' ? 'text-emerald-200' : 'text-amber-200'}>
                    {overview.apiStatus.status || 'Unknown'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500">Last Tested</span>
                  <p className="text-white">{overview.apiStatus.lastTestedAt ? new Date(overview.apiStatus.lastTestedAt).toLocaleString() : 'Never'}</p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Users by Role</h3>
              <div className="flex gap-4">
                {overview.usersByRole.map((item: any) => (
                  <div key={item.role} className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      item.role === 'admin' ? 'bg-amber-400' :
                      item.role === 'operator' ? 'bg-sky-400' : 'bg-emerald-400'
                    }`} />
                    <span className="text-xs text-gray-300 capitalize">{item.role.replace('_', ' ')}</span>
                    <span className="text-xs text-white font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Recent Activity</h3>
              <div className="space-y-2">
                {overview.recentAuditSummary.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{item.action.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        item.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                        item.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-white/5 text-gray-400'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-gray-500">{item.count}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Team Members</h3>
              <button
                onClick={() => setShowCreateUser(true)}
                className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/30 rounded text-xs text-amber-200 hover:bg-amber-500/30"
              >
                + Add User
              </button>
            </div>

            {showCreateUser && (
              <div className="glass-panel rounded-lg p-4 border border-amber-500/30">
                <h4 className="text-xs font-bold text-amber-200 mb-3">Create New User</h4>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="Email"
                    className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white"
                  />
                  <input
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="Display Name"
                    className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white"
                  />
                  <input
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Password (min 10 chars)"
                    type="password"
                    className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white"
                  />
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="bg-black/30 border border-white/10 rounded px-3 py-2 text-xs text-white"
                  >
                    <option value="briefing_user">Briefing User</option>
                    <option value="operator">Operator</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleCreateUser}
                    className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/30 rounded text-xs text-emerald-200"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => setShowCreateUser(false)}
                    className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="glass-panel rounded-lg p-3 flex items-center justify-between hover:border-white/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${
                      user.role === 'admin' ? 'bg-amber-500/20 text-amber-200' :
                      user.role === 'operator' ? 'bg-sky-500/20 text-sky-200' :
                      'bg-emerald-500/20 text-emerald-200'
                    }`}>
                      {user.name?.[0] || user.email[0]}
                    </div>
                    <div>
                      <p className="text-sm text-white font-medium">{user.name}</p>
                      <p className="text-[10px] text-gray-400">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          user.role === 'admin' ? 'bg-amber-500/20 text-amber-300' :
                          user.role === 'operator' ? 'bg-sky-500/20 text-sky-300' :
                          'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {user.role.replace('_', ' ')}
                        </span>
                        <span className={`text-[10px] ${user.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                          {user.isActive ? '● Active' : '● Disabled'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <div className="text-right">
                      <p>{user.totalQueries} queries</p>
                      <p className="text-[10px]">{user.activeSessions} sessions</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleViewUser(user.id)}
                        className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[10px] hover:bg-white/10"
                      >
                        Details
                      </button>
                      <button
                        onClick={() => handleToggleUser(user.id, user.isActive)}
                        className={`px-2 py-1 border rounded text-[10px] ${
                          user.isActive
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {user.isActive ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="px-2 py-1 bg-red-500/10 border border-red-500/20 rounded text-[10px] text-red-300"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Detail Tab */}
        {activeTab === 'user-detail' && selectedUser && (
          <div className="space-y-4">
            <button
              onClick={() => setActiveTab('users')}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to Users
            </button>

            <div className="glass-panel rounded-lg p-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold ${
                  selectedUser.role === 'admin' ? 'bg-amber-500/20 text-amber-200' :
                  selectedUser.role === 'operator' ? 'bg-sky-500/20 text-sky-200' :
                  'bg-emerald-500/20 text-emerald-200'
                }`}>
                  {selectedUser.name?.[0] || selectedUser.email[0]}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedUser.name}</h3>
                  <p className="text-xs text-gray-400">{selectedUser.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      selectedUser.role === 'admin' ? 'bg-amber-500/20 text-amber-300' :
                      selectedUser.role === 'operator' ? 'bg-sky-500/20 text-sky-300' :
                      'bg-emerald-500/20 text-emerald-300'
                    }`}>
                      {selectedUser.role.replace('_', ' ')}
                    </span>
                    <span className={`text-[10px] ${selectedUser.isActive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {selectedUser.isActive ? '● Active' : '● Disabled'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Queries" value={selectedUser.totalQueries} />
              <StatCard label="Today's Queries" value={selectedUser.todayQueries} />
              <StatCard label="Active Sessions" value={selectedUser.activeSessions} />
              <StatCard label="Avg Latency" value={`${selectedUser.avgLatencyMs}ms`} />
            </div>

            {userUsage && (
              <div className="glass-panel rounded-lg p-4">
                <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Usage Breakdown</h4>
                <div className="grid grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500">This Week</span>
                    <p className="text-lg text-white font-medium">{userUsage.weekQueries}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">This Month</span>
                    <p className="text-lg text-white font-medium">{userUsage.monthQueries}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Error Rate</span>
                    <p className="text-lg text-white font-medium">{userUsage.errorRate.toFixed(1)}%</p>
                  </div>
                </div>

                <div className="mt-4">
                  <span className="text-[10px] text-gray-500 uppercase">Queries by Mode</span>
                  <div className="flex gap-2 mt-2">
                    {userUsage.queriesByMode.map((item: any) => (
                      <span key={item.mode} className="px-2 py-1 bg-white/5 rounded text-[10px] text-gray-300">
                        {item.mode}: {item.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Recent Activity</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {userActivity.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between text-xs py-1 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        log.severity === 'critical' ? 'bg-red-400' :
                        log.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <span className="text-gray-300">{log.action.replace(/_/g, ' ')}</span>
                    </div>
                    <span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Chat History Tab */}
        {activeTab === 'chat' && !selectedSession && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">All Chat Sessions</h3>
            <p className="text-xs text-gray-400">Every user's conversation history. Click a session to view messages.</p>
            <div className="space-y-2">
              {sessions.map((s: any) => (
                <button
                  key={s.id}
                  onClick={() => handleViewSession(s.id)}
                  className="w-full glass-panel rounded-lg p-3 flex items-center justify-between hover:border-white/20 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      s.user_role === 'admin' ? 'bg-amber-500/20 text-amber-200' :
                      s.user_role === 'operator' ? 'bg-sky-500/20 text-sky-200' :
                      'bg-emerald-500/20 text-emerald-200'
                    }`}>
                      {(s.user_name || s.user_email || '?')[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="text-xs text-white font-medium">{s.user_name || s.user_email || 'Unknown'}</p>
                      <p className="text-[10px] text-gray-500">{s.user_role?.replace('_', ' ')} • {s.message_count} messages</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">{new Date(s.last_active).toLocaleString()}</p>
                    <p className="text-[10px] text-gray-600">{s.id.slice(0, 8)}...</p>
                  </div>
                </button>
              ))}
              {sessions.length === 0 && <p className="text-xs text-gray-500">No sessions yet.</p>}
            </div>
          </div>
        )}

        {activeTab === 'chat' && selectedSession && (
          <div className="space-y-4">
            <button
              onClick={() => { setSelectedSession(null); setSessionMessages([]); }}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to All Sessions
            </button>
            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-1">
                Session: {selectedSession.id.slice(0, 12)}...
              </h3>
              <p className="text-[10px] text-gray-500">
                User: {sessionMessages[0]?.user_name || selectedSession.user_id || 'Unknown'} •
                {sessionMessages.length} messages •
                Created {new Date(selectedSession.created_at).toLocaleString()}
              </p>
            </div>
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {sessionMessages.map((msg: any) => (
                <div
                  key={msg.id}
                  className={`glass-panel rounded-lg p-3 ${
                    msg.role === 'user' ? 'border-l-2 border-sky-400' : 'border-l-2 border-emerald-400'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${
                      msg.role === 'user' ? 'text-sky-300' : 'text-emerald-300'
                    }`}>
                      {msg.role === 'user' ? (msg.user_name || 'User') : 'UrbanAI'}
                      {msg.mode && <span className="ml-2 text-gray-500">({msg.mode})</span>}
                    </span>
                    <span className="text-[10px] text-gray-600">{new Date(msg.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                  {msg.claim_safety && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                      <span className="text-[10px] text-amber-300">Claim Safety: </span>
                      <span className="text-[10px] text-gray-400">{msg.claim_safety}</span>
                    </div>
                  )}
                </div>
              ))}
              {sessionMessages.length === 0 && <p className="text-xs text-gray-500">No messages in this session.</p>}
            </div>
          </div>
        )}

        {/* Evidence Tab */}
        {activeTab === 'evidence' && !selectedDocument && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Evidence Corpus</h3>
            <p className="text-xs text-gray-400">All documents in the evidence base. Click to inspect chunks and change approval status.</p>
            <div className="space-y-2">
              {documents.map((doc: any) => (
                <button
                  key={doc.id}
                  onClick={() => handleViewDocument(doc.id)}
                  className="w-full glass-panel rounded-lg p-3 flex items-center justify-between hover:border-white/20 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-medium truncate">{doc.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        doc.approval_status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                        doc.approval_status === 'archived' ? 'bg-gray-500/20 text-gray-400' :
                        'bg-amber-500/20 text-amber-300'
                      }`}>
                        {doc.approval_status || doc.approval || 'draft'}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        doc.sensitivity_level === 'confidential' ? 'bg-red-500/20 text-red-300' :
                        doc.sensitivity_level === 'internal' ? 'bg-sky-500/20 text-sky-300' :
                        'bg-white/5 text-gray-400'
                      }`}>
                        {doc.sensitivity_level || doc.sensitivity || 'internal'}
                      </span>
                      <span className="text-[10px] text-gray-500">{doc.chunk_count} chunks</span>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded ${
                    doc.ingestion_status === 'indexed' ? 'bg-emerald-500/10 text-emerald-300' :
                    doc.ingestion_status === 'failed' ? 'bg-red-500/10 text-red-300' :
                    'bg-amber-500/10 text-amber-300'
                  }`}>
                    {doc.ingestion_status || 'registered'}
                  </span>
                </button>
              ))}
              {documents.length === 0 && <p className="text-xs text-gray-500">No documents in corpus.</p>}
            </div>
          </div>
        )}

        {activeTab === 'evidence' && selectedDocument && (
          <div className="space-y-4">
            <button
              onClick={() => { setSelectedDocument(null); setDocumentChunks([]); }}
              className="text-xs text-gray-400 hover:text-white"
            >
              ← Back to All Documents
            </button>
            <div className="glass-panel rounded-lg p-4">
              <h3 className="text-sm font-bold text-white mb-1">{selectedDocument.title}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  selectedDocument.approval_status === 'approved' ? 'bg-emerald-500/20 text-emerald-300' :
                  selectedDocument.approval_status === 'archived' ? 'bg-gray-500/20 text-gray-400' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {selectedDocument.approval_status || selectedDocument.approval || 'draft'}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] ${
                  selectedDocument.sensitivity_level === 'confidential' ? 'bg-red-500/20 text-red-300' :
                  'bg-sky-500/20 text-sky-300'
                }`}>
                  {selectedDocument.sensitivity_level || selectedDocument.sensitivity || 'internal'}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                {['draft', 'approved', 'archived'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleApprovalChange(selectedDocument.id, status)}
                    className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                      (selectedDocument.approval_status || selectedDocument.approval) === status
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">
                Chunks ({documentChunks.length})
              </h4>
              <div className="space-y-3 max-h-[50vh] overflow-y-auto">
                {documentChunks.map((chunk: any) => (
                  <div key={chunk.id} className="border border-white/5 rounded p-3 bg-black/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-sky-300 font-bold">Chunk {chunk.chunk_index}</span>
                      <span className="text-[10px] text-gray-600">{chunk.token_estimate || '?'} tokens</span>
                    </div>
                    <p className="text-[11px] text-gray-300 leading-relaxed whitespace-pre-wrap line-clamp-6">
                      {chunk.content?.slice(0, 500)}{chunk.content?.length > 500 ? '...' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Portfolio Projects</h3>
            <p className="text-xs text-gray-400">All FCC climate portfolio projects with linked evidence.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {adminProjects.map((project: any) => (
                <div key={project.id} className="glass-panel rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm text-white font-medium">{project.displayName || project.name}</h4>
                      <p className="text-[10px] text-gray-500">{project.slug}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      project.status === 'on_track' ? 'bg-emerald-500/20 text-emerald-300' :
                      project.status === 'delayed' ? 'bg-amber-500/20 text-amber-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>
                      {project.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed mb-3">{project.overview}</p>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center">
                      <p className="text-lg text-white font-display">{project.progress}%</p>
                      <p className="text-[9px] text-gray-500">Progress</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg text-white font-display capitalize">{project.riskLevel}</p>
                      <p className="text-[9px] text-gray-500">Risk</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg text-white font-display">{project.documentCount}</p>
                      <p className="text-[9px] text-gray-500">Docs</p>
                    </div>
                  </div>
                  {project.documents?.length > 0 && (
                    <div className="border-t border-white/5 pt-2">
                      <p className="text-[9px] text-gray-500 uppercase tracking-wider mb-1">Linked Evidence</p>
                      {project.documents.slice(0, 3).map((doc: any) => (
                        <div key={doc.id} className="flex items-center justify-between text-[10px] py-1">
                          <span className="text-gray-300 truncate">{doc.title}</span>
                          <span className={`ml-2 px-1 py-0.5 rounded ${
                            doc.approvalStatus === 'approved' ? 'bg-emerald-500/10 text-emerald-300' :
                            'bg-amber-500/10 text-amber-300'
                          }`}>
                            {doc.approvalStatus || 'draft'}
                          </span>
                        </div>
                      ))}
                      {project.documents.length > 3 && (
                        <p className="text-[10px] text-gray-600 mt-1">+{project.documents.length - 3} more</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">System Activity</h3>
            <div className="glass-panel rounded-lg p-4">
              <p className="text-xs text-gray-400 mb-3">Recent audit events across all users</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-center justify-between text-xs py-2 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full ${
                        log.severity === 'critical' ? 'bg-red-400' :
                        log.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <div>
                        <span className="text-gray-300">{log.action.replace(/_/g, ' ')}</span>
                        {log.resourceType && (
                          <span className="text-gray-500 ml-2">({log.resourceType})</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500">
                      {log.ipAddress && <span>{log.ipAddress}</span>}
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && apiUsage && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">API & Model Status</h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Status" value={apiUsage.status.toUpperCase()} />
              <StatCard label="Provider" value={apiUsage.provider.type} />
              <StatCard label="Avg Latency" value={`${apiUsage.avgLatencyMs}ms`} />
              <StatCard label="Error Rate" value={`${apiUsage.errorRate.toFixed(1)}%`} />
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Provider Details</h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-gray-500">Type</span>
                  <p className="text-white">{apiUsage.provider.type}</p>
                </div>
                <div>
                  <span className="text-gray-500">Model</span>
                  <p className="text-white">{apiUsage.provider.model || 'Not configured'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Base URL</span>
                  <p className="text-white text-[10px] break-all">{apiUsage.provider.baseUrl || 'Not configured'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Configured</span>
                  <p className={apiUsage.provider.configured ? 'text-emerald-200' : 'text-red-200'}>
                    {apiUsage.provider.configured ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Recent Errors</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {apiUsage.recentErrors.length === 0 ? (
                  <p className="text-xs text-gray-500">No recent errors</p>
                ) : (
                  apiUsage.recentErrors.map((error: any, idx: number) => (
                    <div key={idx} className="text-xs py-1 border-b border-white/5">
                      <span className="text-red-300">{error.action}</span>
                      <span className="text-gray-500 ml-2">{new Date(error.created_at).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && securityDashboard && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white">Security Dashboard</h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Active Sessions" value={securityDashboard.activeSessions} />
              <StatCard label="Today's Queries" value={securityDashboard.todayQueries} />
              <StatCard label="Suspicious Activity" value={securityDashboard.suspiciousActivity} />
              <StatCard label="Model Error Rate" value={`${(securityDashboard.modelErrorRate * 100).toFixed(1)}%`} />
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Data Classification</h4>
              <div className="flex gap-3">
                {securityDashboard.classifications.map((item: any) => (
                  <div key={item.level} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{item.level || 'unknown'}:</span>
                    <span className="text-xs text-white font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-panel rounded-lg p-4">
              <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">Audit Summary (24h)</h4>
              <div className="space-y-2">
                {securityDashboard.auditSummary.slice(0, 10).map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-300">{item.action.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                        item.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                        item.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-white/5 text-gray-400'
                      }`}>
                        {item.severity}
                      </span>
                      <span className="text-gray-500">{item.count}x</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">Audit Trail</h3>
              <button
                onClick={refreshAuditLog}
                className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-gray-300 hover:bg-white/10"
              >
                Refresh
              </button>
            </div>
            <div className="glass-panel rounded-lg p-4">
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {auditLogs.map((log: any) => (
                  <div key={log.id} className="flex items-start justify-between text-xs py-2 border-b border-white/5">
                    <div className="flex items-start gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1 ${
                        log.severity === 'critical' ? 'bg-red-400' :
                        log.severity === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                      <div>
                        <span className="text-gray-300">{log.action.replace(/_/g, ' ')}</span>
                        {log.resourceType && (
                          <span className="text-gray-500 ml-2">• {log.resourceType}</span>
                        )}
                        {log.resourceId && (
                          <span className="text-gray-600 ml-1">• {log.resourceId.slice(0, 8)}...</span>
                        )}
                        {log.details && (
                          <p className="text-[10px] text-gray-500 mt-0.5">{JSON.stringify(log.details)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-gray-500 whitespace-nowrap">
                      {log.ipAddress && <span className="text-[10px]">{log.ipAddress}</span>}
                      <span className="text-[10px]">{new Date(log.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string | number; sub?: string }> = ({ label, value, sub }) => (
  <div className="glass-panel rounded-lg p-3">
    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
    <p className="text-lg text-white font-medium mt-0.5">{value}</p>
    {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
  </div>
);
