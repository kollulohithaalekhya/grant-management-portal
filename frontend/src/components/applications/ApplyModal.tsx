import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Grant } from '../../types';
import { applicationsAPI } from '../../api/services';
import { Modal, Button, Input, Textarea } from '../ui';
import { formatCurrency } from '../../utils/helpers';
import toast from 'react-hot-toast';

interface FormData {
  projectTitle: string; projectDescription: string;
  requestedAmount: string; organizationName: string; contactEmail: string;
}

interface Props { open: boolean; onClose: () => void; grant: Grant; onSuccess: () => void; }

const ApplyModal: React.FC<Props> = ({ open, onClose, grant, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      await applicationsAPI.submit({ ...data, grantId: grant.id, requestedAmount: parseFloat(data.requestedAmount) });
      reset();
      onSuccess();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Apply: ${grant.title}`}>
      <div className="mb-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-sm text-blue-700">Max funding: <strong>{formatCurrency(grant.amount)}</strong></p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Project Title *"
          placeholder="Your project name"
          error={errors.projectTitle?.message}
          {...register('projectTitle', { required: 'Required' })}
        />
        <Textarea
          label="Project Description *"
          placeholder="Describe your project and its impact..."
          error={errors.projectDescription?.message}
          {...register('projectDescription', { required: 'Required' })}
        />
        <Input
          label="Requested Amount ($) *"
          type="number"
          placeholder={String(grant.amount)}
          error={errors.requestedAmount?.message}
          {...register('requestedAmount', {
            required: 'Required',
            max: { value: grant.amount, message: `Max is ${formatCurrency(grant.amount)}` },
          })}
        />
        <Input
          label="Organization Name *"
          placeholder="Your organization"
          error={errors.organizationName?.message}
          {...register('organizationName', { required: 'Required' })}
        />
        <Input
          label="Contact Email *"
          type="email"
          placeholder="contact@org.com"
          error={errors.contactEmail?.message}
          {...register('contactEmail', { required: 'Required' })}
        />
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={loading}>Submit Application</Button>
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Modal>
  );
};

export default ApplyModal;
