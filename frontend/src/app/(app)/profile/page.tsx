"use client";

import React, { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { User } from "@/types";
import { User as UserIcon, Shield, Building, Mail, Key, Edit, Save, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Forms
  const [user, setUser] = useState<User | null>(null);
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await api.auth.getMe();
        setUser(res);
        setFullName(res.full_name || "");
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || saving) return;

    setSaving(true);
    setSuccess(false);
    try {
      const res = await api.auth.updateMe({ full_name: fullName.trim() });
      setUser(res);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to update profile:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(false);

    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match.");
      return;
    }

    try {
      await api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword
      });
      setPwSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Failed to change password:", err);
      setPwError(err.response?.data?.detail || "Failed to change password. Verify your current password.");
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
    <div className="p-6 space-y-6 bg-[#0F0F1A] min-h-[calc(100vh-64px)] text-slate-100 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-indigo-400" />
          User Profile
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Manage your account credentials, role attributes, and profile details.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Left Avatar Summary */}
        <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-6 flex flex-col items-center justify-center text-center space-y-4">
          <Avatar name={user?.full_name || "User"} className="w-20 h-20 text-2xl" />
          
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">{user?.full_name}</h3>
            <p className="text-[10px] text-slate-500 flex items-center justify-center gap-1">
              <Mail className="w-3 h-3" /> {user?.email}
            </p>
          </div>

          <div className="flex flex-col gap-1.5 w-full pt-4 border-t border-slate-800/40 text-[11px] text-slate-400 text-left">
            <div className="flex justify-between items-center">
              <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-indigo-400" /> Role:</span>
              <Badge variant="info" className="text-[10px] py-0">{user?.role}</Badge>
            </div>
            <div className="flex justify-between items-center mt-1">
              <span className="flex items-center gap-1"><Building className="w-3.5 h-3.5 text-indigo-400" /> Organization:</span>
              <span className="font-semibold text-slate-200 truncate max-w-[120px]">{user?.organization?.name || "Corporate Group"}</span>
            </div>
          </div>
        </Card>

        {/* 2. Right forms */}
        <div className="md:col-span-2 space-y-6">
          {/* Edit Profile Form */}
          <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
              <Edit className="w-4 h-4 text-indigo-400" /> General Details
            </h3>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {success && (
                  <span className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/15">
                    Profile successfully updated
                  </span>
                )}
                <div />
                <Button type="submit" variant="primary" disabled={saving} className="flex items-center gap-1 text-xs py-2 px-5">
                  <Save className="w-4 h-4" /> Save Details
                </Button>
              </div>
            </form>
          </Card>

          {/* Change Password Form */}
          <Card className="glass-card bg-slate-900/30 border-slate-800/80 p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-350 uppercase tracking-wider flex items-center gap-1.5">
              <Key className="w-4 h-4 text-indigo-400" /> Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">New Password</label>
                  <input
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-400">Confirm New Password</label>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
              </div>

              {pwError && <p className="text-[10px] text-red-400 font-semibold">{pwError}</p>}
              {pwSuccess && <p className="text-[10px] text-emerald-400 font-semibold">Password successfully changed!</p>}

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="primary" className="flex items-center gap-1 text-xs py-2 px-5">
                  <Key className="w-4 h-4" /> Change Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
