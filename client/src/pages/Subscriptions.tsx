import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  subscriptionApi,
  Subscription,
  SubscriptionCandidate,
  categories,
} from '@/lib/subscriptions';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import AddSubscriptionDialog from '@/components/AddSubscriptionDialog';
import EditSubscriptionDialog from '@/components/EditSubscriptionDialog';
import UploadReceiptDialog from '@/components/UploadReceiptDialog';
import ReviewExtractedDialog from '@/components/ReviewExtractedDialog';
import { format } from 'date-fns';
import { getApiErrorMessage } from '@/lib/utils';

export default function Subscriptions() {
  const location = useLocation();
  const navigate = useNavigate();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [extractedCandidate, setExtractedCandidate] = useState<SubscriptionCandidate | null>(null);
  const [selectedSubscription, setSelectedSubscription] = useState<Subscription | null>(null);

  const loadSubscriptions = async () => {
    try {
      setLoading(true);
      const data = await subscriptionApi.getAll();
      setSubscriptions(data);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load subscriptions'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  // Open the upload flow directly when navigated here from an "add" button
  // elsewhere (e.g. the Dashboard). Clear the state so it doesn't re-fire on refresh/back.
  useEffect(() => {
    if ((location.state as { openAdd?: boolean } | null)?.openAdd) {
      setUploadDialogOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate]);

  const handleDelete = async (id: string) => {
    try {
      await subscriptionApi.delete(id);
      await loadSubscriptions();
    } catch (err) {
      alert(getApiErrorMessage(err, 'Failed to delete subscription'));
    }
  };

  const handleEdit = (subscription: Subscription) => {
    setSelectedSubscription(subscription);
    setEditDialogOpen(true);
  };

  // Filter subscriptions
  const filteredSubscriptions = subscriptions.filter((sub) => {
    const matchesSearch = sub.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || sub.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-bold">All Subscriptions</h2>
        <Button onClick={() => setUploadDialogOpen(true)}>
          Add Subscription
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search subscriptions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="max-w-sm"
        />
        <Select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="max-w-xs"
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-muted-foreground py-12">
          Loading subscriptions...
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredSubscriptions.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground mb-4">
              {searchTerm || categoryFilter !== 'all'
                ? 'No subscriptions match your filters'
                : 'No subscriptions yet'}
            </p>
            {!searchTerm && categoryFilter === 'all' && (
              <Button onClick={() => setUploadDialogOpen(true)}>
                Add Your First Subscription
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Subscription List */}
      {!loading && filteredSubscriptions.length > 0 && (
        <div className="grid gap-4">
          {filteredSubscriptions.map((sub) => (
            <Card key={sub.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-semibold">{sub.name}</h3>
                      <Badge variant="secondary">
                        {categories.find((c) => c.id === sub.category)?.name || sub.category}
                      </Badge>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground font-mono">
                        {sub.currency} {parseFloat(sub.cost).toFixed(2)}
                      </span>
                      <span>{sub.billingCycle}</span>
                      <span className="font-mono">
                        Next: {format(new Date(sub.renewalDate), 'MMM d, yyyy')}
                      </span>
                    </div>

                    {sub.notes && (
                      <p className="text-sm text-muted-foreground">{sub.notes}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(sub)}
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Showing count */}
      {!loading && filteredSubscriptions.length > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredSubscriptions.length} of {subscriptions.length} subscriptions
        </p>
      )}

      {/* Dialogs */}
      <AddSubscriptionDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        onSuccess={loadSubscriptions}
      />

      <EditSubscriptionDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        subscription={selectedSubscription}
        onSuccess={loadSubscriptions}
        onDelete={handleDelete}
      />

      <UploadReceiptDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        onExtracted={(candidate) => {
          setExtractedCandidate(candidate);
          setUploadDialogOpen(false);
          setReviewDialogOpen(true);
        }}
        onManual={() => {
          setUploadDialogOpen(false);
          setAddDialogOpen(true);
        }}
      />

      <ReviewExtractedDialog
        open={reviewDialogOpen}
        onOpenChange={setReviewDialogOpen}
        candidate={extractedCandidate}
        onSuccess={loadSubscriptions}
      />
    </div>
  );
}
