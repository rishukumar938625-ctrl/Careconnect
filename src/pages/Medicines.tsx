import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { MedicineCard, MedicalDisclaimer } from '../components/health/HealthCards';
import { EmptyState, LoadingState } from '../components/ui/StateComponents';
import { Pill } from 'lucide-react';
import { healthApi } from '../services/api';
import type { Medicine } from '../types';

export const Medicines: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMedicines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await healthApi.getMedicines({ q: searchQuery, limit: 100 });
      const normalised = response.data.map((m) => ({
        ...m,
        id: (m as unknown as { _id: string })._id ?? m.id,
      }));
      setMedicines(normalised);
    } catch (err) {
      setError('Failed to load medicines. Please try again.');
      console.error('[Medicines] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchMedicines, 300);
    return () => clearTimeout(timer);
  }, [fetchMedicines]);

  return (
    <PageContainer>
      <PageHeader
        title="Medicines"
        subtitle="Educational information about common medicines."
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search medicines…"
        className="mb-4"
        id="medicines-search"
      />

      <MedicalDisclaimer className="mb-5" />

      <p className="text-xs text-text-muted mb-4">
        Medication information is provided for educational purposes. Always
        follow guidance from a qualified healthcare professional.
      </p>

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          icon={<Pill className="h-8 w-8" />}
          title="Could not load medicines"
          description={error}
          action={{ label: 'Retry', onClick: fetchMedicines }}
        />
      ) : medicines.length === 0 ? (
        <EmptyState
          icon={<Pill className="h-8 w-8" />}
          title="No medicines found"
          description={`No results for "${searchQuery}". Try a different search term.`}
          action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {medicines.map((medicine) => (
            <MedicineCard
              key={medicine.id}
              medicine={medicine}
              onView={(id) => navigate(`/health/${id}`)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Medicines;
