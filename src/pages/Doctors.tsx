import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { DoctorCard } from '../components/appointments/AppointmentCards';
import { EmptyState } from '../components/ui/StateComponents';
import { mockDoctors } from '../data/mockDoctorData';
import { filterByQuery } from '../utils';
import { Users } from 'lucide-react';

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

  const filtered = useMemo(() => {
    let result = filterByQuery(mockDoctors, searchQuery, ['name', 'specialty', 'qualifications']);
    if (activeSpecialty !== 'All') {
      result = result.filter((d) => d.specialty === activeSpecialty);
    }
    return result;
  }, [searchQuery, activeSpecialty]);

  return (
    <PageContainer>
      <PageHeader
        title="Find a Doctor"
        subtitle="Browse our network of healthcare professionals."
      />

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

      {/* Results count */}
      <p className="text-xs text-text-muted mb-3">
        {filtered.length} doctor{filtered.length !== 1 ? 's' : ''} found
      </p>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No doctors found"
          description="Try adjusting your search or filter."
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
          {filtered.map((doctor) => (
            <DoctorCard
              key={doctor.id}
              doctor={doctor}
              onBook={() => navigate('/appointments/book')}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Doctors;
