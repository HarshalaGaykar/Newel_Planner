'use client';

import { AppFeature } from '@/lib/whats-new-api';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DynamicIcon } from './DynamicIcon';
import { ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface FeatureDetailModalProps {
  feature: AppFeature | null;
  isOpen: boolean;
  onClose: () => void;
}

export function FeatureDetailModal({ feature, isOpen, onClose }: FeatureDetailModalProps) {
  const router = useRouter();

  if (!feature) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <DynamicIcon name={feature.iconName} className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-2xl font-bold">{feature.title}</DialogTitle>
          <DialogDescription className="text-center text-base mt-2">
            {feature.shortDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {feature.demoVideoUrl && (
            <div className="w-full aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center border">
               <a href={feature.demoVideoUrl} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-2">
                 Watch Demo Video <ExternalLink size={16} />
               </a>
            </div>
          )}
          
          {feature.fullDescription && (
            <div className="bg-muted/30 p-4 rounded-lg border text-sm text-foreground/90 whitespace-pre-wrap">
              {feature.fullDescription}
            </div>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {feature.featureUrl && (
            <Button onClick={() => router.push(feature.featureUrl!)}>
              Open Feature
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
