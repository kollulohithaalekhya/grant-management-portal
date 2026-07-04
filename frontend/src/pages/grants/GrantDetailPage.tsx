import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Award, Calendar, DollarSign, Users, Edit, Trash2, FileText } from 'lucide-react';
import { Grant } from '../../types';
import { grantsAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { Button, Badge, Card, Spinner } from '../../components/ui';
import { formatCurrency, formatDate, daysUntilDeadline } from '../../utils/helpers';
import ApplyModal from '../../components/applications/ApplyModal';
import toast from 'react-hot-toast';

const GrantDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [grant, setGrant] = useState<Grant | null>(null);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);

  const canManage = user?.role === 'ADMIN' || user?.role === 'GRANT_MANAGER';

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await grantsAPI.getById(id!);
        setGrant(res.data.data);
      } catch { toast.error('Grant not found'); navigate('/grants'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('Delete this grant and all its applications?')) return;
    try {
      await grantsAPI.delete(id!);
      toast.success('Grant deleted');
      navigate('/grants');
    } catch { toast.error('Failed to delete'); }
  };

  if (loading) return <Spinner />;
  if (!grant) return null;

  const days = daysUntilDeadline(grant.deadline);
  const canApply = user?.role === 'APPLICANT' && grant.status === 'OPEN' && days >= 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/grants')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-50 rounded-xl flex items-center justify-center">
                  <Award className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <Badge label={grant.status} status={grant.status} />
                  <span className="ml-2 text-sm text-gray-500">{grant.category}</span>
                </div>
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => navigate(`/grants/${id}/edit`)}>
                    <Edit className="w-4 h-4" /> Edit
                  </Button>
                  {user?.role === 'ADMIN' && (
                    <Button variant="danger" size="sm" onClick={handleDelete}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-3">{grant.title}</h1>
            <p className="text-gray-600 leading-relaxed">{grant.description}</p>
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 mb-3">Eligibility Criteria</h2>
            <p className="text-gray-600">{grant.eligibility}</p>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Grant Details</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-50 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Funding Amount</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(grant.amount)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${days < 7 && days >= 0 ? 'bg-red-50' : 'bg-blue-50'}`}>
                  <Calendar className={`w-4 h-4 ${days < 7 && days >= 0 ? 'text-red-600' : 'text-blue-600'}`} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className={`font-semibold ${days < 7 && days >= 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {formatDate(grant.deadline)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {days < 0 ? 'Expired' : `${days} days remaining`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-purple-50 rounded-lg flex items-center justify-center">
                  <Users className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Applications</p>
                  <p className="font-semibold text-gray-900">{grant.applicationCount ?? 0}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-50 rounded-lg flex items-center justify-center">
                  <FileText className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Posted by</p>
                  <p className="font-semibold text-gray-900">{grant.createdByName}</p>
                  <p className="text-xs text-gray-400">{formatDate(grant.createdAt)}</p>
                </div>
              </div>
            </div>

            {canApply && (
              <Button className="w-full mt-6" onClick={() => setApplyOpen(true)}>
                Apply for this Grant
              </Button>
            )}
            {user?.role === 'APPLICANT' && grant.status !== 'OPEN' && (
              <p className="text-center text-sm text-gray-400 mt-4">This grant is not accepting applications.</p>
            )}
            {user?.role === 'APPLICANT' && grant.status === 'OPEN' && days < 0 && (
              <p className="text-center text-sm text-red-500 mt-4">The application deadline has passed.</p>
            )}
          </Card>

          {canManage && (
            <Card>
              <Link to={`/applications?grantId=${grant._id}`}>
                <Button variant="secondary" className="w-full">
                  <FileText className="w-4 h-4" /> View Applications
                </Button>
              </Link>
            </Card>
          )}
        </div>
      </div>

      <ApplyModal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        grant={grant}
        onSuccess={() => { setApplyOpen(false); toast.success('Application submitted!'); }}
      />
    </div>
  );
};

export default GrantDetailPage;
