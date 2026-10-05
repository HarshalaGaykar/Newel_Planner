'use client';

import { useEffect, useState } from 'react';
import { whatsNewApi, AppFeature } from '@/lib/whats-new-api';
import { DynamicIcon } from '@/components/whats-new/DynamicIcon';
import { FeatureDetailModal } from '@/components/whats-new/FeatureDetailModal';

export default function WhatsNewPage() {
  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<AppFeature | null>(null);

  useEffect(() => {
    // 1. Fetch the features
    whatsNewApi.getFeatures()
      .then(data => {
        setFeatures(data);
        setLoading(false);
        // 2. Mark them all as seen so the red dot clears
        whatsNewApi.markAllSeen().catch(err => console.error('Failed to mark seen', err));
      })
      .catch(err => {
        console.error('Failed to fetch features', err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="px-6 py-12 md:py-20 w-full max-w-7xl mx-auto">
      <h2 className="mx-auto max-w-3xl text-center text-3xl md:text-4xl font-medium tracking-tighter">
        Newel Planner Updates
      </h2>
      <p className="mt-3 text-pretty text-center text-lg text-muted-foreground tracking-[-0.01em] sm:text-xl">
        Discover the latest features, improvements, and tools designed for you.
      </p>

      {loading ? (
        <div className="mt-20 text-center text-muted-foreground animate-pulse">Loading features...</div>
      ) : features.length === 0 ? (
        <div className="mt-20 text-center text-muted-foreground">No new features available for your role at this time.</div>
      ) : (
        <div className="mx-auto mt-10 grid max-w-7xl gap-6 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.id}
              onClick={() => setSelectedFeature(feature)}
              className="group relative flex flex-col rounded-xl border bg-card p-6 cursor-pointer hover:border-primary transition-all hover:shadow-sm"
            >
              {/* NEW BADGE */}
              {feature.isNew && (
                <span className="absolute top-4 right-4 flex h-5 items-center rounded-full bg-blue-100 dark:bg-blue-900 px-2.5 text-[10px] font-bold text-blue-700 dark:text-blue-100 uppercase tracking-wider">
                  New
                </span>
              )}

              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full bg-muted group-hover:bg-primary/10 transition-colors">
                <DynamicIcon name={feature.iconName} className="size-6 text-foreground group-hover:text-primary transition-colors" />
              </div>
              <span className="font-medium text-lg leading-tight">{feature.title}</span>
              <p className="mt-2 text-[15px] text-muted-foreground leading-relaxed">
                {feature.shortDescription}
              </p>
            </div>
          ))}
        </div>
      )}

      <FeatureDetailModal 
        feature={selectedFeature} 
        isOpen={!!selectedFeature} 
        onClose={() => setSelectedFeature(null)} 
      />
    </div>
  );
}
