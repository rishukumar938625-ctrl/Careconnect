import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { ConditionCard } from '../components/health/HealthCards';
import { MedicalDisclaimer } from '../components/health/HealthCards';
import { EmptyState } from '../components/ui/StateComponents';
import { LoadingState } from '../components/ui/StateComponents';
import { Activity } from 'lucide-react';
import { healthApi } from '../services/api';
import type { HealthCondition } from '../types';

export const Conditions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [conditions, setConditions] = useState<HealthCondition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConditions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await healthApi.getConditions({ q: searchQuery, limit: 100 });
      // Normalize _id → id for frontend compatibility
      const normalised = response.data.map((c) => ({
        ...c,
        id: (c as unknown as { _id: string })._id ?? c.id,
      }));
      setConditions(normalised);
    } catch (err) {
      setError('Failed to load conditions. Please try again.');
      console.error('[Conditions] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchConditions, 300);
    return () => clearTimeout(timer);
  }, [fetchConditions]);

  return (
    <PageContainer>
      <PageHeader
        title="Health Conditions"
        subtitle="Educational overviews of common health conditions."
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search conditions…"
        className="mb-4"
        id="conditions-search"
      />

      <MedicalDisclaimer className="mb-5" />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title="Could not load conditions"
          description={error}
          action={{ label: 'Retry', onClick: fetchConditions }}
        />
      ) : conditions.length === 0 ? (
        <EmptyState
          icon={<Activity className="h-8 w-8" />}
          title="No conditions found"
          description={`No results for "${searchQuery}". Try a different search term.`}
          action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {conditions.map((condition) => (
            <ConditionCard
              key={condition.id}
              condition={condition}
              onView={(id) => navigate(`/health/${id}`)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Conditions;
