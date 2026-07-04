import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, Award, Calendar, DollarSign, Users } from 'lucide-react';
import { Grant } from '../../types';
import { grantsAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, Card, Spinner, EmptyState, Pagination, Input, Select } from '../../components/ui';
import { formatCurrency, formatDate, daysUntilDeadline } from '../../utils/helpers';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'Community Development', label: 'Community Development' },
  { value: 'Education', label: 'Education' },
  { value: 'Environment', label: 'Environment' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Arts & Culture', label: 'Arts & Culture' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DRAFT', label: 'Draft' },
];

const GrantsPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [grants, setGrants] = useState<Grant[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'GRANT_MANAGER';

  const fetchGrants = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 9 };
      if (search) params.search = search;
      if (status) params.status = status;
      if (category) params.category = category;
      const res = await grantsAPI.getAll(params);
      setGrants(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      toast.error('Failed to load grants');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchGrants(); }, [page, status, category]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); fetchGrants(); };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this grant? This will also delete all associated applications.')) return;
    try {
      await grantsAPI.delete(id);
      toast.success('Grant deleted');
      fetchGrants();
    } catch { toast.error('Failed to delete grant'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Grants</h1>
          <p className="text-gray-500 mt-1">Browse and manage available grants</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate('/grants/new')}>
            <Plus className="w-4 h-4" /> New Grant
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Search grants..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="sm:w-40"
          />
          <Select
            options={CATEGORIES}
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="sm:w-48"
          />
          <Button type="submit" variant="secondary">
            <Filter className="w-4 h-4" /> Search
          </Button>
        </form>
      </Card>

      {/* Grid */}
      {loading ? <Spinner /> : grants.length === 0 ? (
        <EmptyState
          icon={<Award className="w-12 h-12" />}
          title="No grants found"
          description="Try adjusting your filters or check back later."
          action={canCreate ? <Button onClick={() => navigate('/grants/new')}><Plus className="w-4 h-4" /> Create Grant</Button> : undefined}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {grants.map((grant) => {
              const days = daysUntilDeadline(grant.deadline);
              return (
                <Card key={grant._id} className="flex flex-col hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                      <Award className="w-5 h-5 text-primary-600" />
                    </div>
                    <Badge label={grant.status} status={grant.status} />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">{grant.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-2 flex-1 mb-4">{grant.description}</p>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <DollarSign className="w-4 h-4 text-green-500" />
                      <span className="font-medium">{formatCurrency(grant.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className={days < 7 && days >= 0 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                        {days < 0 ? `Expired ${Math.abs(days)}d ago` : `${days} days left`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span>{grant.applicationCount ?? 0} applications</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-auto pt-4 border-t border-gray-100">
                    <Link to={`/grants/${grant._id}`} className="flex-1">
                      <Button variant="secondary" className="w-full" size="sm">View Details</Button>
                    </Link>
                    {canCreate && (
                      <Button variant="ghost" size="sm" onClick={() => navigate(`/grants/${grant._id}/edit`)}>Edit</Button>
                    )}
                    {user?.role === 'ADMIN' && (
                      <Button variant="danger" size="sm" onClick={() => handleDelete(grant._id)}>Del</Button>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default GrantsPage;
