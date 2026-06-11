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
import { AuthUser } from '../types';

type AdminTab = 'overview' | 'users' | 'user-detail' | 'activity' | 'api' | 'security' | 'audit';

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
  }, [activeTab, refreshOverview, refreshUsers, refreshApiData, refreshAuditLog]);

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
