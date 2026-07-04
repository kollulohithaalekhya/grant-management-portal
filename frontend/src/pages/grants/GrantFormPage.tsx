import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft } from 'lucide-react';
import { grantsAPI } from '../../api/services';
import { Button, Card, Input, Textarea, Select, Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

interface FormData {
  title: string; description: string; amount: string;
  deadline: string; category: string; eligibility: string; status: string;
}

const CATEGORIES = [
  { value: 'Community Development', label: 'Community Development' },
  { value: 'Education', label: 'Education' },
  { value: 'Environment', label: 'Environment' },
  { value: 'Healthcare', label: 'Healthcare' },
  { value: 'Technology', label: 'Technology' },
  { value: 'Arts & Culture', label: 'Arts & Culture' },
  { value: 'Other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Open' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DRAFT', label: 'Draft' },
];

const GrantFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>({
    defaultValues: { status: 'OPEN', category: 'Community Development' },
  });

  useEffect(() => {
    if (!isEdit) return;
    const fetch = async () => {
      try {
        const res = await grantsAPI.getById(id!);
        const g = res.data.data;
        reset({
          title: g.title, description: g.description,
          amount: String(g.amount), category: g.category,
          eligibility: g.eligibility, status: g.status,
          deadline: g.deadline.split('T')[0],
        });
      } catch { toast.error('Failed to load grant'); navigate('/grants'); }
      finally { setFetching(false); }
    };
    fetch();
  }, [id]);

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const payload = { ...data, deadline: new Date(data.deadline).toISOString() };
      if (isEdit) {
        await grantsAPI.update(id!, payload);
        toast.success('Grant updated!');
      } else {
        await grantsAPI.create(payload);
        toast.success('Grant created!');
      }
      navigate('/grants');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save grant');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <Spinner />;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/grants')}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Grant' : 'Create New Grant'}</h1>
          <p className="text-gray-500 text-sm">Fill in the details below</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <Input
            label="Grant Title *"
            placeholder="e.g. Community Development Fund 2025"
            error={errors.title?.message}
            {...register('title', { required: 'Title is required' })}
          />
          <Textarea
            label="Description *"
            placeholder="Describe the purpose and goals of this grant..."
            error={errors.description?.message}
            {...register('description', { required: 'Description is required' })}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Funding Amount ($) *"
              type="number"
              placeholder="50000"
              error={errors.amount?.message}
              {...register('amount', { required: 'Amount is required', min: { value: 1, message: 'Must be positive' } })}
            />
            <Input
              label="Application Deadline *"
              type="date"
              error={errors.deadline?.message}
              min={new Date().toISOString().split('T')[0]}
              {...register('deadline', { required: 'Deadline is required' })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Category *"
              options={CATEGORIES}
              error={errors.category?.message}
              {...register('category', { required: 'Category is required' })}
            />
            <Select
              label="Status *"
              options={STATUS_OPTIONS}
              {...register('status')}
            />
          </div>
          <Textarea
            label="Eligibility Criteria *"
            placeholder="Who is eligible to apply for this grant..."
            error={errors.eligibility?.message}
            {...register('eligibility', { required: 'Eligibility is required' })}
          />

          <div className="flex gap-3 pt-2">
            <Button type="submit" loading={loading}>
              {isEdit ? 'Update Grant' : 'Create Grant'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/grants')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default GrantFormPage;
