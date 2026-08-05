import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, User, Calendar, DollarSign, Building, Mail, CheckCircle, XCircle, Clock } from 'lucide-react';
import { Application } from '../../types';
import { applicationsAPI } from '../../api/services';
import { useAuth } from '../../context/AuthContext';
import { hasRole } from '../../utils/roles';
import { Button, Badge, Card, Spinner, Select, Textarea } from '../../components/ui';
import { formatCurrency, formatDate, formatDateTime } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface ReviewForm { status: string; reviewNotes: string; }

const ApplicationDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [app, setApp] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);

  const isReviewer = hasRole(user, 'ADMIN', 'GRANT_MANAGER');

  const { register, handleSubmit } = useForm<ReviewForm>({
    defaultValues: { status: 'UNDER_REVIEW', reviewNotes: '' },
  });

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await applicationsAPI.getById(id!);
        setApp(res.data.data);
      } catch { toast.error('Application not found'); navigate('/applications'); }
      finally { setLoading(false); }
    };
    fetch();
  }, [id]);

  const onReview = async (data: ReviewForm) => {
    setReviewing(true);
    try {
      await applicationsAPI.review(id!, data);
      toast.success('Application reviewed');
      const res = await applicationsAPI.getById(id!);
      setApp(res.data.data);
      setShowReviewForm(false);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Review failed');
    } finally { setReviewing(false); }
  };

  const handleWithdraw = async () => {
    if (!confirm('Withdraw this application?')) return;
    try {
      await applicationsAPI.withdraw(id!);
      toast.success('Withdrawn');
      navigate('/applications');
    } catch (err: any) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  if (loading) return <Spinner />;
  if (!app) return null;

  const statusIcon = {
    APPROVED: <CheckCircle className="w-5 h-5 text-green-500" />,
    REJECTED: <XCircle className="w-5 h-5 text-red-500" />,
    UNDER_REVIEW: <Clock className="w-5 h-5 text-blue-500" />,
    PENDING: <Clock className="w-5 h-5 text-yellow-500" />,
  }[app.status];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/applications')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {statusIcon}
                <Badge label={app.status} status={app.status} />
              </div>
              {hasRole(user, 'APPLICANT') && app.status === 'PENDING' && (
                <Button variant="danger" size="sm" onClick={handleWithdraw}>Withdraw</Button>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-1">{app.projectTitle}</h1>
            <p className="text-sm text-primary-600 mb-4">
              Grant: {(app as any).grant?.title || app.grantTitle}
            </p>
            <p className="text-gray-600 leading-relaxed">{app.projectDescription}</p>
          </Card>

          {app.reviewNotes && (
            <Card className="border-l-4 border-l-blue-400">
              <h2 className="font-semibold text-gray-900 mb-2">Review Notes</h2>
              <p className="text-gray-600">{app.reviewNotes}</p>
              {app.reviewedAt && (
                <p className="text-xs text-gray-400 mt-2">Reviewed on {formatDateTime(app.reviewedAt)}</p>
              )}
            </Card>
          )}

          {/* Reviewer actions */}
          {isReviewer && app.status !== 'APPROVED' && app.status !== 'REJECTED' && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">Review Application</h2>
                {!showReviewForm && (
                  <Button size="sm" onClick={() => setShowReviewForm(true)}>Start Review</Button>
                )}
              </div>
              {showReviewForm && (
                <form onSubmit={handleSubmit(onReview)} className="space-y-4">
                  <Select
                    label="Decision *"
                    options={[
                      { value: 'UNDER_REVIEW', label: 'Mark as Under Review' },
                      { value: 'APPROVED', label: 'Approve' },
                      { value: 'REJECTED', label: 'Reject' },
                    ]}
                    {...register('status', { required: true })}
                  />
                  <Textarea
                    label="Review Notes"
                    placeholder="Optional notes for the applicant..."
                    {...register('reviewNotes')}
                  />
                  <div className="flex gap-3">
                    <Button type="submit" loading={reviewing}>Submit Review</Button>
                    <Button type="button" variant="secondary" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                  </div>
                </form>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold text-gray-900 mb-4">Application Details</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-4 h-4 text-green-500 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Requested Amount</p>
                  <p className="font-semibold text-gray-900">{formatCurrency(app.requestedAmount)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Building className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Organization</p>
                  <p className="font-medium text-gray-900">{app.organizationName}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Contact Email</p>
                  <p className="font-medium text-gray-900 break-all">{app.contactEmail}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400">Submitted</p>
                  <p className="font-medium text-gray-900">{formatDate(app.createdAt)}</p>
                </div>
              </div>
            </div>
          </Card>

          {isReviewer && (
            <Card>
              <h2 className="font-semibold text-gray-900 mb-4">Applicant</h2>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Name</p>
                    <p className="font-medium text-gray-900">{app.applicantName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-400">Email</p>
                    <p className="font-medium text-gray-900 break-all">{app.applicantEmail}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApplicationDetailPage;
