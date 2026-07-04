import React, { useEffect, useState } from 'react';
import { Search, Users, Shield, ToggleLeft, ToggleRight } from 'lucide-react';
import { User } from '../../types';
import { usersAPI } from '../../api/services';
import { Badge, Card, Spinner, EmptyState, Pagination, Select, Button } from '../../components/ui';
import { formatDate, getInitials } from '../../utils/helpers';
import toast from 'react-hot-toast';

const ROLE_OPTIONS = [
  { value: '', label: 'All Roles' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GRANT_MANAGER', label: 'Grant Manager' },
  { value: 'APPLICANT', label: 'Applicant' },
];

const ROLE_CHANGE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'GRANT_MANAGER', label: 'Grant Manager' },
  { value: 'APPLICANT', label: 'Applicant' },
];

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (roleFilter) params.role = roleFilter;
      if (search) params.search = search;
      const res = await usersAPI.getAll(params);
      setUsers(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, [page, roleFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchUsers(); };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await usersAPI.updateRole(userId, role);
      toast.success('Role updated');
      fetchUsers();
    } catch { toast.error('Failed to update role'); }
  };

  const handleToggleActive = async (userId: string, isActive: boolean) => {
    if (!confirm(`${isActive ? 'Deactivate' : 'Activate'} this user?`)) return;
    try {
      await usersAPI.toggleActive(userId);
      toast.success(`User ${isActive ? 'deactivated' : 'activated'}`);
      fetchUsers();
    } catch { toast.error('Failed to update user'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1">Manage user accounts and permissions</p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
            className="sm:w-44"
          />
          <Button type="submit" variant="secondary">Search</Button>
        </form>
      </Card>

      {loading ? <Spinner /> : users.length === 0 ? (
        <EmptyState icon={<Users className="w-12 h-12" />} title="No users found" />
      ) : (
        <>
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {['User', 'Role', 'Status', 'Joined', 'Provider', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {getInitials(u.name)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{u.name}</p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          {ROLE_CHANGE_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          label={u.isActive ? 'Active' : 'Inactive'}
                          className={u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                        />
                      </td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          label={u.provider}
                          className={u.provider === 'local' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(u._id, u.isActive)}
                          className={`flex items-center gap-1 text-xs font-medium transition-colors ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-500 hover:text-green-700'}`}
                        >
                          {u.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          {u.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default UsersPage;
