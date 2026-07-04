import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Search, Filter } from 'lucide-react';
import { Application } from '../../types';
import { applicationsAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { Badge, Card, Spinner, EmptyState, Pagination, Select, Button } from '../../components/ui';
import { formatCurrency, formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'UNDER_REVIEW', label: 'Under Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

const ApplicationsPage: React.FC = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const isReviewer = user?.role === 'ADMIN' || user?.role === 'GRANT_MANAGER';

  const fetchApps = async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, limit: 10 };
      if (status) params.status = status;
      const res = await applicationsAPI.getAll(params);
      setApps(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch { toast.error('Failed to load applications'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchApps(); }, [page, status]);

  const handleWithdraw = async (id: string) => {
    if (!confirm('Withdraw this application?')) return;
    try {
      await applicationsAPI.withdraw(id);
      toast.success('Application withdrawn');
      fetchApps();
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed to withdraw'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
        <p className="text-gray-500 mt-1">
          {isReviewer ? 'Review and manage grant applications' : 'Track your grant applications'}
        </p>
      </div>

      <Card className="p-4">
        <div className="flex gap-3">
          <Select
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="w-48"
          />
        </div>
      </Card>

      {loading ? <Spinner /> : apps.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title="No applications found"
          description={user?.role === 'APPLICANT' ? 'Browse grants and apply for funding.' : 'No applications to review yet.'}
          action={user?.role === 'APPLICANT' ? <Link to="/grants"><Button>Browse Grants</Button></Link> : undefined}
        />
      ) : (
        <>
          <div className="space-y-3">
            {apps.map((app) => (
              <Card key={app._id} className="hover:shadow-md transition-shadow">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-gray-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">{app.projectTitle}</h3>
                        <p className="text-sm text-primary-600 mt-0.5">{app.grantTitle}</p>
                        {isReviewer && (
                          <p className="text-sm text-gray-500 mt-0.5">by {app.applicantName} · {app.applicantEmail}</p>
                        )}
                      </div>
                      <Badge label={app.status} status={app.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span>{formatCurrency(app.requestedAmount)}</span>
                      <span>·</span>
                      <span>{app.organizationName}</span>
                      <span>·</span>
                      <span>Submitted {formatDate(app.createdAt)}</span>
                    </div>
                    {app.reviewNotes && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                        <span className="font-medium">Review notes:</span> {app.reviewNotes}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link to={`/applications/${app._id}`}>
                      <Button variant="secondary" size="sm">View</Button>
                    </Link>
                    {user?.role === 'APPLICANT' && app.status === 'PENDING' && (
                      <Button variant="danger" size="sm" onClick={() => handleWithdraw(app._id)}>Withdraw</Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
          <Pagination page={page} totalPages={totalPages} onChange={setPage} />
        </>
      )}
    </div>
  );
};

export default ApplicationsPage;
