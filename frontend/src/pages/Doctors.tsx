import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, AlertCircle, Info, Loader2 } from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { DoctorCard } from '../components/appointments/AppointmentCards';
import { EmptyState } from '../components/ui/StateComponents';
import { Button } from '../components/ui/Button';
import { doctorApi } from '../services/api';
import type { Doctor } from '../types';

const specialties = [
  'All',
  'General Physician',
  'Cardiologist',
  'Dermatologist',
  'Neurologist',
  'Pediatrician',
  'Orthopedist',
] as const;

type FilterSpecialty = (typeof specialties)[number];

export const Doctors: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSpecialty, setActiveSpecialty] = useState<FilterSpecialty>('All');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await doctorApi.getAll({
        q: searchQuery.trim() || undefined,
        specialty: activeSpecialty !== 'All' ? activeSpecialty : undefined,
      });
      setDoctors(res.data || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load doctors directory.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, activeSpecialty]);

  useEffect(() => {
    // Debounce search input by 250ms
    const timer = setTimeout(() => {
      fetchDoctors();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchDoctors]);

  return (
    <PageContainer>
      <PageHeader
        title="Find a Doctor"
        subtitle="Browse our network of healthcare professionals."
      />

      {/* Demo Data Disclaimer Banner */}
      <div className="flex items-start gap-3 p-3.5 mb-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
        <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <span className="font-semibold">Development &amp; Demonstration Mode:</span> All doctor records, qualifications, and schedules shown in this directory are simulated demo data for application testing and do not represent actual medical practices.
        </div>
      </div>

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search doctors by name or specialty…"
        className="mb-4"
        id="doctors-search"
      />

      {/* Specialty filter chips */}
      <div
        className="flex gap-2 overflow-x-auto pb-2 mb-5 scrollbar-none"
        role="group"
        aria-label="Filter by specialty"
      >
        {specialties.map((specialty) => (
          <button
            key={specialty}
            onClick={() => setActiveSpecialty(specialty)}
            aria-pressed={activeSpecialty === specialty}
            className={[
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              activeSpecialty === specialty
                ? 'bg-primary-600 text-white'
                : 'bg-white text-text-secondary border border-slate-200 hover:border-primary-300',
            ].join(' ')}
          >
            {specialty}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 text-text-muted gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
          <p className="text-xs">Loading doctors directory…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-danger" />
          <p className="text-sm text-text-primary font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchDoctors}>
            Retry
          </Button>
        </div>
      )}

      {/* Results content */}
      {!loading && !error && (
        <>
          <p className="text-xs text-text-muted mb-3">
            {doctors.length} doctor{doctors.length !== 1 ? 's' : ''} found
          </p>

          {doctors.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              title="No doctors found"
              description="Try adjusting your search query or specialty filter."
              action={{
                label: 'Clear filters',
                onClick: () => {
                  setSearchQuery('');
                  setActiveSpecialty('All');
                },
              }}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {doctors.map((doctor) => {
                const docId = doctor.id || (doctor._id as string) || doctor.slug || '';
                return (
                  <DoctorCard
                    key={docId}
                    doctor={doctor}
                    onBook={(id) => navigate(`/appointments/book?doctorId=${id}`)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
};

export default Doctors;
