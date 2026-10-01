'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Loader2, MessageSquare, XCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { activitiesApi, Activity, ActivityStatus } from '@/lib/activities-api';

interface Props {
  activity: Activity | null;
  open: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

const STATUS_OPTIONS: { value: ActivityStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export default function UpdateStatusDialog({ activity, open, onClose, onUpdated }: Props) {
  const [status, setStatus] = useState<ActivityStatus>(activity?.status ?? 'COMPLETED');
  const [remarks, setRemarks] = useState('');
  const [loading, setLoading] = useState(false);

  if (!activity) return null;

  // Only the creator (or an admin) may change status — an assignee gets a
  // remarks-only note appended to the history instead.
  const canManageStatus = activity.canManage === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = remarks.trim();

    if (!canManageStatus && !trimmed) {
      toast.error('Enter a remark before saving');
      return;
    }

    try {
      setLoading(true);
      if (canManageStatus) {
        await activitiesApi.updateStatus(activity.id, {
          status,
          remarks: trimmed || undefined,
        });
        toast.success(`Activity status updated to ${status.toLowerCase()}`);
      } else {
        await activitiesApi.addRemark(activity.id, trimmed);
        toast.success('Remark added');
      }
      onUpdated();
      onClose();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to save';
      toast.error(Array.isArray(msg) ? msg.join(', ') : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground">
            {canManageStatus ? 'Update Activity Status & Remarks' : 'Add Remark'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
            {activity.name}
          </p>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-sm">
          {canManageStatus && (
            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-semibold text-muted-foreground">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as ActivityStatus)}
                disabled={loading}
              >
                <SelectTrigger id="status" className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} className="text-sm">
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="remarks" className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                <MessageSquare size={13} /> {canManageStatus ? 'Remarks / Update Note' : 'Remark'}
                {!canManageStatus && <span className="text-destructive">*</span>}
              </Label>
              <span className="text-[11px] text-muted-foreground">{remarks.length}/500</span>
            </div>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, 500))}
              placeholder="Add your remarks or progress notes..."
              rows={3}
              disabled={loading}
              className="resize-none text-xs sm:text-sm"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="text-xs gap-1.5"
            >
              {loading && <Loader2 size={13} className="animate-spin" />}
              {canManageStatus ? 'Save Status' : 'Save Remark'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
