"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User, Organization } from "@/types";
import {
  ShieldAlert,
  Server,
  Database,
  Shield,
  Activity,
  Trash2,
  UserCheck,
  UserX,
  History,
  Info
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Badge from "@/components/ui/Badge";
import { formatDate } from "@/lib/utils";

export default function AdminPage() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [sysStats, setSysStats] = useState<any>(null);

  useEffect(() => {
    async function loadAdminData() {
      try {
        const uList = await api.admin.listUsers();
        setUsers(uList);

        const logs = await api.admin.getAuditLogs();
        setAuditLogs(logs);

        const stats = await api.admin.getSystemStats();
        setSysStats(stats);
      } catch (err) {
        console.error("Failed to load administrative details:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, []);

  const handleToggleActive = async (userObj: User) => {
    try {
      const updated = await api.admin.updateUser(userObj.id, {
        is_active: !userObj.is_active
      });
      setUsers(users.map(u => u.id === userObj.id ? { ...u, is_active: updated.is_active } : u));
    } catch (err) {
      console.error("Failed to update user status:", err);
    }
  };

  const handleRoleChange = async (userObj: User, newRole: string) => {
    try {
      const updated = await api.admin.updateUser(userObj.id, {
        role: newRole
      });
      setUsers(users.map(u => u.id === userObj.id ? { ...u, role: updated.role } : u));
    } catch (err) {
      console.error("Failed to update user role:", err);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user account?")) return;
    try {
      await api.admin.deleteUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-64px)] bg-[#0F0F1A]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <Shield className="w-5 h-5 text-indigo-400" />
          Administrative Console
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Oversee team permissions, system service monitors, and security audit logs.
        </p>
      </div>

      {/* 1. Services Health & Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">API Services</span>
              <p className="text-xs text-slate-300 mt-0.5">FastAPI Gateways</p>
            </div>
          </div>
          <Badge variant="success">Operational</Badge>
        </Card>
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">DB Storage</span>
              <p className="text-xs text-slate-300 mt-0.5">Postgres Vector Store</p>
            </div>
          </div>
          <Badge variant="success">Operational</Badge>
        </Card>
        <Card className="glass-card bg-slate-900/40 p-4 border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-indigo-400" />
            <div>
              <span className="text-[10px] text-slate-500 font-semibold uppercase">Cache Clusters</span>
              <p className="text-xs text-slate-300 mt-0.5">Redis queues</p>
            </div>
          </div>
          <Badge variant="success">Operational</Badge>
        </Card>
      </div>

      {/* 2. Team & User list table */}
      <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Team Member Accounts</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">RBAC Role</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-slate-850 hover:bg-slate-900/20 text-slate-300">
                  <td className="py-3.5 px-4 font-semibold text-slate-200">{u.full_name}</td>
                  <td className="py-3.5 px-4">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u, e.target.value)}
                      className="bg-slate-950 border border-slate-850 text-[10px] rounded p-1 text-slate-300 focus:outline-none"
                    >
                      <option value="SUPER_ADMIN">Super Admin</option>
                      <option value="ORG_ADMIN">Org Admin</option>
                      <option value="EMPLOYEE">Employee</option>
                    </select>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={u.is_active ? "success" : "neutral"} className="text-[10px] py-0.5 px-2">
                      {u.is_active ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleToggleActive(u)}
                      className="p-1 rounded text-slate-500 hover:text-indigo-400 transition-colors"
                      title={u.is_active ? "Disable Account" : "Activate Account"}
                    >
                      {u.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDeleteUser(u.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors"
                      title="Delete User"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 3. Security Audit Log Trail */}
      <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-4 space-y-4">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <History className="w-4 h-4 text-indigo-400" />
          Security Audit Trail
        </h3>
        <div className="max-h-[300px] overflow-y-auto pr-1.5 scrollbar-thin space-y-2">
          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-10">No recent audit log entries.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex justify-between text-xs p-3 bg-slate-950/40 border border-slate-900 rounded-lg text-slate-400">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-300">{log.action}</p>
                  <p className="text-[10px] text-slate-500">
                    Logged by User {log.user_id} • IP: {log.ip_address}
                  </p>
                </div>
                <span className="text-[10px] text-slate-600 font-medium self-center">{formatDate(log.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
