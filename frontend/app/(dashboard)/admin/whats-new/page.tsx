'use client';

import { useEffect, useState } from 'react';
import { whatsNewApi, AppFeature } from '@/lib/whats-new-api';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/lib/store/auth';
import { useRouter } from 'next/navigation';

export default function AdminWhatsNewPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [features, setFeatures] = useState<AppFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Kick out non-admins immediately
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      toast.error('Unauthorized access');
      router.push('/dashboard'); // or wherever your home is
    }
  }, [user, router]);

  // Form State
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [iconName, setIconName] = useState('Settings2');
  const [featureUrl, setFeatureUrl] = useState('');
  const [demoVideoUrl, setDemoVideoUrl] = useState('');
  const [roles, setRoles] = useState<string[]>(['ADMIN', 'HR', 'PM', 'TL', 'USER', 'FREELANCER']);

  const loadFeatures = async () => {
    try {
      setLoading(true);
      const data = await whatsNewApi.getAllFeaturesAdmin();
      setFeatures(data);
    } catch (error) {
      toast.error('Failed to load features');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFeatures();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await whatsNewApi.createFeature({
        title,
        shortDescription,
        fullDescription,
        iconName,
        featureUrl,
        demoVideoUrl,
        roles,
      });
      toast.success('Feature announcement created!');
      setIsModalOpen(false);
      loadFeatures();
      
      // Reset form
      setTitle('');
      setShortDescription('');
      setFullDescription('');
      setFeatureUrl('');
      setDemoVideoUrl('');
      setIconName('Settings2');
    } catch (error) {
      toast.error('Failed to create feature');
    }
  };

  const toggleRole = (role: string) => {
    setRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Announcements</h2>
        
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-2 h-4 w-4" /> Create Announcement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Feature Announcement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Title</Label>
                <Input required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Customizable Layouts" />
              </div>
              <div className="space-y-2">
                <Label>Short Description (Card Subtitle)</Label>
                <Input required value={shortDescription} onChange={e => setShortDescription(e.target.value)} placeholder="One quick sentence" />
              </div>
              <div className="space-y-2">
                <Label>Full Description (Detailed Modal)</Label>
                <Textarea value={fullDescription} onChange={e => setFullDescription(e.target.value)} rows={4} placeholder="Full explanation of the feature..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Icon Name (Lucide)</Label>
                  <Input value={iconName} onChange={e => setIconName(e.target.value)} placeholder="e.g. Settings2, Bot, Film" />
                </div>
                <div className="space-y-2">
                  <Label>Feature URL (Optional)</Label>
                  <Input value={featureUrl} onChange={e => setFeatureUrl(e.target.value)} placeholder="e.g. /reports/compliance" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Demo Video URL (Optional)</Label>
                <Input value={demoVideoUrl} onChange={e => setDemoVideoUrl(e.target.value)} placeholder="e.g. https://youtube.com/..." />
              </div>
              <div className="space-y-2">
                <Label>Target Roles</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {['ADMIN', 'HR', 'PM', 'TL', 'USER', 'FREELANCER'].map(r => (
                    <div 
                      key={r}
                      onClick={() => toggleRole(r)}
                      className={`px-3 py-1 text-sm rounded-full cursor-pointer border ${roles.includes(r) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                    >
                      {r}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit">Publish Feature</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Target Roles</TableHead>
              <TableHead>Published At</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : features.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">No announcements found.</TableCell>
              </TableRow>
            ) : (
              features.map(f => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell>
                     {/* @ts-ignore - The API wrapper types roles as string[], adjust if nested */}
                     {Array.isArray(f.roles) ? f.roles.map((r: any) => r.roleName || r).join(', ') : 'All'}
                  </TableCell>
                  <TableCell>{new Date(f.publishedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {f.isActive ? (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-green-100 text-green-800">Active</span>
                    ) : (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-gray-100 text-gray-800">Inactive</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
