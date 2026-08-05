import React, { useEffect, useState } from 'react';
import { Search, Users, ToggleLeft, ToggleRight } from 'lucide-react';
import { Role, User } from '../../types';
import { usersAPI } from '../../api/services';
import { Badge, Card, Spinner, EmptyState, Pagination, Select, Button } from '../../components/ui';
import { formatDate, getInitials } from '../../utils/helpers';
import { ROLE_LABELS } from '../../utils/roles';
import toast from 'react-hot-toast';

const ROLE_FILTER_OPTIONS = [{ value: '', label: 'All Roles' }, ...ROLE_LABELS];

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

  /**
   * Roles are a set, so toggling one sends the whole resulting list. The last
   * remaining role cannot be removed — the API requires at least one.
   */
  const handleRoleToggle = async (target: User, role: Role) => {
    const next = target.roles.includes(role)
      ? target.roles.filter((r) => r !== role)
      : [...target.roles, role];

    if (next.length === 0) {
      toast.error('A user must keep at least one role');
      return;
    }

    try {
      await usersAPI.updateRoles(target.id, next);
      toast.success('Roles updated');
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update roles');
    }
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
            options={ROLE_FILTER_OPTIONS}
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
                    {['User', 'Roles', 'Status', 'Joined', 'Provider', 'Actions'].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
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
                        <div className="flex flex-wrap gap-1">
                          {ROLE_LABELS.map(({ value, label }) => {
                            const active = u.roles.includes(value);
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => handleRoleToggle(u, value)}
                                aria-pressed={active}
                                title={active ? `Remove ${label}` : `Grant ${label}`}
                                className={`text-xs rounded-md px-2 py-1 border transition-colors ${
                                  active
                                    ? 'bg-primary-50 border-primary-200 text-primary-700'
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
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
                          label={u.provider === 'LOCAL' ? 'Password' : 'Google'}
                          className={u.provider === 'LOCAL' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-600'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(u.id, u.isActive)}
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
