'use client';

import { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertCircle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { activitiesApi, ActivityRecurrence } from '@/lib/activities-api';

function getErrorMessage(error: unknown, fallback: string) {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    const message = error.response?.data?.message;
    return Array.isArray(message) ? message.join(', ') : message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}

interface Props {
  series: ActivityRecurrence;
  onClose: () => void;
  onCancelled: () => void;
}

export default function CancelSeriesDialog({ series, onClose, onCancelled }: Props) {
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: { preventDefault(): void }) => {
    event.preventDefault();
    setError('');

    try {
      setSaving(true);
      await activitiesApi.cancelRecurrence(series.id, remarks.trim() || undefined);
      toast.success('Series stopped');
      onCancelled();
      onClose();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Failed to stop this series'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">Stop Recurring Activity</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-3 text-xs">
            <p className="font-bold text-foreground">{series.name}</p>
            <p className="mt-1 text-muted-foreground">{series.summary}</p>
          </div>

          {/* Says plainly what is destroyed and what survives — the whole point
              of the confirmation step. */}
          <p className="text-xs text-muted-foreground">
            No further activities will be created. Every activity from this series still ahead of
            now will be cancelled. Activities already completed, cancelled or in the past are left
            exactly as they are.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Reason (optional)</Label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Shared with the assignees"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-8 text-xs">
              Keep It
            </Button>
            <Button type="submit" variant="destructive" disabled={saving} className="h-8 text-xs">
              {saving ? 'Stopping...' : 'Stop Series'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
