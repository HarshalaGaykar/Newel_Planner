'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
} from '@/components/kibo-ui/combobox';
import { usersApi, type User } from '@/lib/users-api';
import { maturityApi, type EmployeeMaturity } from '@/lib/maturity-api';
import { toast } from 'sonner';

interface MaturityFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: EmployeeMaturity | null;
  onSaved: () => void;
}

function toMonthInputValue(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthInputToIsoDate(monthValue: string) {
  return `${monthValue}-01`;
}

export function MaturityFormDialog({ open, onOpenChange, record, onSaved }: MaturityFormDialogProps) {
  const isEdit = !!record;
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState('');
  const [maturityValue, setMaturityValue] = useState('');
  const [forTheMonth, setForTheMonth] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    usersApi.getUsers().then(setUsers).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (record) {
      setUserId(record.userId);
      setMaturityValue(String(record.currentMaturityValue));
      setForTheMonth(toMonthInputValue(record.forTheMonth));
      setRemarks(record.remarks ?? '');
      setIsActive(record.isActive);
    } else {
      setUserId('');
      setMaturityValue('');
      const now = new Date();
      setForTheMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      setRemarks('');
      setIsActive(true);
    }
  }, [open, record]);

  const userOptions = useMemo(
    () =>
      users.map((u) => ({
        value: u.id,
        label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      })),
    [users],
  );

  async function handleSave() {
    setError(null);
    if (!userId) {
      setError('Please select an employee.');
      return;
    }
    if (!forTheMonth) {
      setError('Please select the month.');
      return;
    }
    const numericValue = maturityValue === '' ? undefined : Number(maturityValue);
    if (!isEdit && numericValue === undefined) {
      setError('Please enter a maturity value.');
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit && record) {
        await maturityApi.update(record.userId, {
          forTheMonth: monthInputToIsoDate(forTheMonth),
          maturityValue: numericValue,
          remarks: remarks || undefined,
          isActive,
        });
        toast.success('Maturity record updated');
      } else {
        await maturityApi.create({
          userId,
          currentMaturityValue: numericValue!,
          forTheMonth: monthInputToIsoDate(forTheMonth),
          remarks: remarks || undefined,
          isActive,
        });
        toast.success('Maturity record created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Update Maturity' : 'Add Employee Maturity'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Record or correct this employee’s maturity value for a given month.'
              : 'Create the first maturity record for an employee.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Employee *</Label>
            <Combobox
              data={userOptions}
              type="employee"
              value={userId}
              onValueChange={setUserId}
              open={isEdit ? false : undefined}
            >
              <ComboboxTrigger className="w-full justify-between" disabled={isEdit} />
              <ComboboxContent>
                <ComboboxInput />
                <ComboboxEmpty />
                <ComboboxList>
                  <ComboboxGroup>
                    {userOptions.map((o) => (
                      <ComboboxItem key={o.value} value={o.value}>
                        {o.label}
                      </ComboboxItem>
                    ))}
                  </ComboboxGroup>
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Maturity Value {isEdit ? '' : '*'}</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                value={maturityValue}
                onChange={(e) => setMaturityValue(e.target.value)}
                placeholder={isEdit ? 'Leave blank to keep current' : 'e.g. 0.7'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>For The Month *</Label>
              <Input
                type="month"
                value={forTheMonth}
                onChange={(e) => setForTheMonth(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Remarks</Label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes about this evaluation"
              rows={3}
            />
          </div>

          {isEdit && (
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Active</Label>
            </div>
          )}

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={submitting}>
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
