"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import { Header } from "@/components/layout/header";
import { useAuthStore } from "@/lib/store";
import { Users, Shield, Mail, Building } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLE_CONFIG = {
  admin:     { label: "Admin",     color: "badge-critical" },
  lab_staff: { label: "Lab Staff", color: "badge-warning" },
  student:   { label: "Student",   color: "badge-info" },
};

export default function SettingsPage() {
  const { user: me } = useAuthStore();
  const qc = useQueryClient();

  const { data: users } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersApi.list().then((r) => r.data),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User updated"); },
  });

  return (
    <div>
      <Header title="Settings" subtitle="System configuration and user management" />

      <div className="p-6 space-y-6">
        {/* User management */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Users size={16} className="text-muted-foreground" />
            <h2 className="font-display font-600">User Management</h2>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">User</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Department</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Role</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-center px-5 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u: any) => {
                const roleCfg = ROLE_CONFIG[u.role as keyof typeof ROLE_CONFIG];
                return (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                          {u.full_name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{u.department ?? "—"}</td>
                    <td className="px-5 py-3">
                      {u.id === me?.id ? (
                        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", roleCfg?.color)}>
                          {roleCfg?.label}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) => updateMutation.mutate({ id: u.id, data: { role: e.target.value } })}
                          className="px-2 py-1 rounded-lg border border-border bg-background text-xs focus:outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="lab_staff">Lab Staff</option>
                          <option value="student">Student</option>
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", u.is_active ? "badge-good" : "badge-critical")}>
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {u.id !== me?.id && (
                        <button
                          onClick={() => updateMutation.mutate({ id: u.id, data: { is_active: !u.is_active } })}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          {u.is_active ? "Deactivate" : "Activate"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* System info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: Shield, title: "Security", desc: "JWT Auth · bcrypt hashing · Role-based access control" },
            { icon: Mail, title: "Notifications", desc: "In-app notifications · Email alerts via SMTP" },
            { icon: Building, title: "Deployment", desc: "Frontend: Vercel · Backend: Render · DB: Supabase" },
          ].map((card) => (
            <div key={card.title} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <card.icon size={16} className="text-primary" />
                <h3 className="font-medium text-sm">{card.title}</h3>
              </div>
              <p className="text-xs text-muted-foreground">{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
