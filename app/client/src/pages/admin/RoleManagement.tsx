import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Users,
  Settings,
  Key,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from '@/integrations/supabase/client';
import { toast } from "@/hooks/use-toast";

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  user_count?: number;
  created_at?: string;
  updated_at?: string;
  is_active: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

const RoleManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    try {
      setLoading(true);
      // For now, we'll use a simplified approach since we don't have a roles table
      // In a real implementation, you'd have a roles table in Supabase
      const mockRoles: Role[] = [
        {
          id: '1',
          name: 'Super Admin',
          description: 'Full system access with all permissions',
          permissions: ['all'],
          user_count: 2,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: '2',
          name: 'Admin',
          description: 'Administrative access with most permissions',
          permissions: ['users.read', 'users.write', 'attendance.read', 'attendance.write', 'sessions.read', 'sessions.write'],
          user_count: 5,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: '3',
          name: 'Teacher',
          description: 'Teaching staff with limited administrative access',
          permissions: ['attendance.read', 'sessions.read', 'sessions.write', 'reports.read'],
          user_count: 25,
          is_active: true,
          created_at: new Date().toISOString()
        },
        {
          id: '4',
          name: 'Student',
          description: 'Basic user access for attendance marking',
          permissions: ['attendance.write', 'profile.read'],
          user_count: 500,
          is_active: true,
          created_at: new Date().toISOString()
        }
      ];

      setRoles(mockRoles);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    // Mock permissions data
    const mockPermissions: Permission[] = [
      { id: 'users.read', name: 'View Users', description: 'Can view user profiles and information', category: 'Users' },
      { id: 'users.write', name: 'Manage Users', description: 'Can create, edit, and delete users', category: 'Users' },
      { id: 'users.delete', name: 'Delete Users', description: 'Can permanently delete users', category: 'Users' },
      { id: 'attendance.read', name: 'View Attendance', description: 'Can view attendance records', category: 'Attendance' },
      { id: 'attendance.write', name: 'Mark Attendance', description: 'Can create and modify attendance records', category: 'Attendance' },
      { id: 'sessions.read', name: 'View Sessions', description: 'Can view session information', category: 'Sessions' },
      { id: 'sessions.write', name: 'Manage Sessions', description: 'Can create and modify sessions', category: 'Sessions' },
      { id: 'reports.read', name: 'View Reports', description: 'Can access system reports', category: 'Reports' },
      { id: 'reports.write', name: 'Generate Reports', description: 'Can create custom reports', category: 'Reports' },
      { id: 'settings.read', name: 'View Settings', description: 'Can view system settings', category: 'System' },
      { id: 'settings.write', name: 'Modify Settings', description: 'Can modify system settings', category: 'System' },
      { id: 'audit.read', name: 'View Audit Logs', description: 'Can view system audit logs', category: 'Audit' },
    ];

    setPermissions(mockPermissions);
  };

  const filteredRoles = roles.filter(role =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateRole = () => {
    setEditingRole(null);
    setSelectedPermissions([]);
    setShowRoleModal(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setSelectedPermissions(role.permissions);
    setShowRoleModal(true);
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.user_count && role.user_count > 0) {
      toast({
        title: "Cannot Delete Role",
        description: `This role has ${role.user_count} users assigned. Please reassign users before deleting.`,
        variant: "destructive"
      });
      return;
    }

    if (window.confirm(`Are you sure you want to delete the role "${role.name}"?`)) {
      try {
        setRoles(roles.filter(r => r.id !== role.id));
        toast({
          title: "Success",
          description: "Role deleted successfully"
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete role",
          variant: "destructive"
        });
      }
    }
  };

  const handleSaveRole = async () => {
    if (!editingRole && !selectedPermissions.length) {
      toast({
        title: "Error",
        description: "Please select at least one permission",
        variant: "destructive"
      });
      return;
    }

    try {
      const roleData = {
        id: editingRole?.id || Date.now().toString(),
        name: editingRole?.name || `New Role ${Date.now()}`,
        description: editingRole?.description || 'New role description',
        permissions: selectedPermissions,
        user_count: editingRole?.user_count || 0,
        is_active: editingRole?.is_active ?? true,
        created_at: editingRole?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      if (editingRole) {
        setRoles(roles.map(r => r.id === editingRole.id ? roleData : r));
        toast({
          title: "Success",
          description: "Role updated successfully"
        });
      } else {
        setRoles([...roles, roleData]);
        toast({
          title: "Success",
          description: "Role created successfully"
        });
      }

      setShowRoleModal(false);
      setEditingRole(null);
      setSelectedPermissions([]);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save role",
        variant: "destructive"
      });
    }
  };

  const getRoleBadgeColor = (isActive: boolean) => {
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  };

  const groupedPermissions = permissions.reduce((acc, permission) => {
    if (!acc[permission.category]) {
      acc[permission.category] = [];
    }
    acc[permission.category].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Role Management</h1>
          <p className="text-muted-foreground">Manage user roles and permissions</p>
        </div>
        <Button onClick={handleCreateRole} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {roles.filter(r => r.is_active).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {roles.reduce((sum, role) => sum + (role.user_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{permissions.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search roles..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center p-8">Loading...</div>
        ) : filteredRoles.length === 0 ? (
          <div className="col-span-full text-center p-8 text-gray-500">No roles found</div>
        ) : (
          filteredRoles.map((role) => (
            <motion.div
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="h-full">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Shield className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{role.name}</CardTitle>
                        <Badge className={getRoleBadgeColor(role.is_active)}>
                          {role.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditRole(role)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDeleteRole(role)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="mb-4">
                    {role.description}
                  </CardDescription>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Users:</span>
                      <span className="font-medium">{role.user_count || 0}</span>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Permissions:</span>
                      <span className="font-medium">{role.permissions.length}</span>
                    </div>

                    <div>
                      <p className="text-sm text-gray-600 mb-2">Key Permissions:</p>
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.slice(0, 3).map((permission) => (
                          <Badge key={permission} variant="secondary" className="text-xs">
                            {permission}
                          </Badge>
                        ))}
                        {role.permissions.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{role.permissions.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))
        )}
      </div>

      {/* Role Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingRole ? 'Edit Role' : 'Create New Role'}
              </CardTitle>
              <CardDescription>
                {editingRole ? 'Modify role permissions and settings' : 'Set up a new role with specific permissions'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Role Name</label>
                  <Input
                    value={editingRole?.name || ''}
                    onChange={(e) => setEditingRole(prev => prev ? {...prev, name: e.target.value} : null)}
                    placeholder="Enter role name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      checked={editingRole?.is_active ?? true}
                      onCheckedChange={(checked) => setEditingRole(prev => prev ? {...prev, is_active: checked} : null)}
                    />
                    <span className="text-sm">{editingRole?.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Description</label>
                <Input
                  value={editingRole?.description || ''}
                  onChange={(e) => setEditingRole(prev => prev ? {...prev, description: e.target.value} : null)}
                  placeholder="Enter role description"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-4 block">Permissions</label>
                <Tabs defaultValue="users" className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    <TabsTrigger value="users">Users</TabsTrigger>
                    <TabsTrigger value="attendance">Attendance</TabsTrigger>
                    <TabsTrigger value="sessions">Sessions</TabsTrigger>
                    <TabsTrigger value="reports">Reports</TabsTrigger>
                    <TabsTrigger value="system">System</TabsTrigger>
                  </TabsList>

                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <TabsContent key={category} value={category.toLowerCase()}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-3 p-3 border rounded-lg">
                            <input
                              type="checkbox"
                              id={permission.id}
                              checked={selectedPermissions.includes(permission.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPermissions([...selectedPermissions, permission.id]);
                                } else {
                                  setSelectedPermissions(selectedPermissions.filter(p => p !== permission.id));
                                }
                              }}
                              className="w-4 h-4"
                            />
                            <div className="flex-1">
                              <label htmlFor={permission.id} className="text-sm font-medium cursor-pointer">
                                {permission.name}
                              </label>
                              <p className="text-xs text-gray-500">{permission.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            </CardContent>
            <div className="flex justify-end gap-2 p-6 pt-0">
              <Button variant="outline" onClick={() => setShowRoleModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveRole}>
                {editingRole ? 'Update Role' : 'Create Role'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

export default RoleManagement;
