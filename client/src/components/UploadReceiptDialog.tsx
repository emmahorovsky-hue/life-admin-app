import { useState } from 'react';
import { Upload } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { subscriptionApi, SubscriptionCandidate } from '@/lib/subscriptions';
import { getApiErrorMessage } from '@/lib/utils';

interface UploadReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExtracted: (candidate: SubscriptionCandidate) => void;
}

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp';

export default function UploadReceiptDialog({
  open,
  onOpenChange,
  onExtracted,
}: UploadReceiptDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setFile(null);
    setLoading(false);
    setError('');
  };

  const handleClose = (next: boolean) => {
    if (loading) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;
    setError('');
    setLoading(true);

    try {
      const result = await subscriptionApi.extract(file);
      if (result.candidates.length === 0) {
        setError(
          "We couldn't read a subscription from that file. Please add it manually."
        );
        return;
      }
      onExtracted(result.candidates[0]);
      reset();
      onOpenChange(false);
    } catch (err) {
      setError(
        getApiErrorMessage(
          err,
          'Failed to extract subscription from file. Please try again or add it manually.'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Receipt</DialogTitle>
          <DialogDescription>
            Upload a receipt or invoice (PDF or image) and we&apos;ll extract the
            subscription details for you to review.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleExtract} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt file</Label>
            <Input
              id="receipt"
              type="file"
              accept={ACCEPTED}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setError('');
              }}
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground">
              PDF, PNG, JPEG, or WebP. Max 10 MB.
            </p>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              {error}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? 'Extracting...' : 'Extract'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
