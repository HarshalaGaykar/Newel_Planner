'use client';

import { useEffect, useState, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import {
  assetConfirmationsApi,
  AssetConfirmationCurrent,
} from '@/lib/asset-confirmations-api';

function getErrorMessage(error: unknown, fallback: string) {
  const message = (error as { response?: { data?: { message?: string | string[] } } })
    .response?.data?.message;
  return Array.isArray(message) ? message.join(', ') : message || fallback;
}

function fmtDateTime(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AssetConfirmationsPage() {
  const [data, setData] = useState<AssetConfirmationCurrent | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      setData(await assetConfirmationsApi.getCurrent());
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to load your asset confirmations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async () => {
    try {
      setConfirming(true);
      setError('');
      await assetConfirmationsApi.confirm();
      await load();
    } catch (e) {
      setError(getErrorMessage(e, 'Failed to confirm'));
    } finally {
      setConfirming(false);
    }
  };

  const confirmed = data?.status === 'CONFIRMED';

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="h-6 w-6 text-indigo-600" />
        <h1 className="text-2xl font-bold text-slate-900">Asset Allocation Confirmation</h1>
      </div>
      <p className="text-sm text-slate-500 mb-6">
        Confirm that the assets currently held by your team members are recorded correctly
        {data ? ` for ${data.monthLabel}` : ''}.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-4 mb-6">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-slate-500 py-16">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : !data ? null : (
        <>
          {confirmed && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-4 mb-6">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="font-medium">
                Confirmed{data.confirmedAt ? ` on ${fmtDateTime(data.confirmedAt)}` : ''}. Thank you!
              </p>
            </div>
          )}

          {data.assetCount === 0 ? (
            <div className="text-sm text-slate-500 bg-slate-50 border border-slate-200 rounded-md p-6 text-center">
              No assets are currently recorded against your team.
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-2.5">Asset Tag</th>
                    <th className="text-left font-semibold px-4 py-2.5">Name</th>
                    <th className="text-left font-semibold px-4 py-2.5">Type</th>
                    <th className="text-left font-semibold px-4 py-2.5">Currently Used By</th>
                  </tr>
                </thead>
                <tbody>
                  {data.assets.map((a) => (
                    <tr key={a.id} className="border-t border-slate-100">
                      <td className="px-4 py-2.5 font-medium text-slate-800">{a.assetTag}</td>
                      <td className="px-4 py-2.5 text-slate-700">{a.name}</td>
                      <td className="px-4 py-2.5 text-slate-600">{a.type}</td>
                      <td className="px-4 py-2.5 text-slate-700">{a.usedByName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex items-center justify-between">
            <p className="text-xs text-slate-500">
              If any allocation is wrong, update it in Asset Management first, then confirm.
            </p>
            <button
              onClick={handleConfirm}
              disabled={confirming || confirmed}
              className="flex items-center gap-2 h-10 px-5 rounded-md bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirmed ? 'Confirmed' : 'Confirm all correct'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
