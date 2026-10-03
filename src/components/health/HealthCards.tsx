import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Pill,
  AlertCircle,
  Heart,
  ShieldCheck,
  Stethoscope,
  Zap,
  ChevronRight,
  Bookmark,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import type { HealthCondition, HealthArticle, Medicine, HealthCategory } from '../../types';

// ─── Category Icon Map ────────────────────────────────────────────────────────

const categoryIconMap: Record<HealthCategory | string, React.ReactNode> = {
  Respiratory: <Activity className="h-5 w-5" />,
  Neurological: <Zap className="h-5 w-5" />,
  Cardiovascular: <Heart className="h-5 w-5" />,
  Digestive: <Activity className="h-5 w-5" />,
  Musculoskeletal: <Activity className="h-5 w-5" />,
  Dermatological: <ShieldCheck className="h-5 w-5" />,
  Immunological: <ShieldCheck className="h-5 w-5" />,
  'Mental Health': <Heart className="h-5 w-5" />,
  'Infectious Disease': <AlertCircle className="h-5 w-5" />,
  Wellness: <Heart className="h-5 w-5" />,
};

const categoryColorMap: Record<HealthCategory | string, string> = {
  Respiratory: 'bg-blue-100 text-blue-600',
  Neurological: 'bg-purple-100 text-purple-600',
  Cardiovascular: 'bg-red-100 text-red-600',
  Digestive: 'bg-orange-100 text-orange-600',
  Musculoskeletal: 'bg-teal-100 text-teal-600',
  Dermatological: 'bg-pink-100 text-pink-600',
  Immunological: 'bg-amber-100 text-amber-600',
  'Mental Health': 'bg-violet-100 text-violet-600',
  'Infectious Disease': 'bg-red-100 text-red-600',
  Wellness: 'bg-green-100 text-green-600',
};

// ─── Condition Card ───────────────────────────────────────────────────────────

interface ConditionCardProps {
  condition: HealthCondition;
  onView?: (id: string) => void;
  onSave?: (id: string) => void;
}

export const ConditionCard: React.FC<ConditionCardProps> = ({
  condition,
  onView,
  onSave,
}) => {
  const navigate = useNavigate();
  const iconBg = categoryColorMap[condition.category] ?? 'bg-slate-100 text-slate-600';
  const icon = categoryIconMap[condition.category] ?? <Activity className="h-5 w-5" />;

  const handleView = () => {
    const slugOrId = condition.slug || condition.id;
    if (onView) onView(slugOrId);
    else navigate(`/health/${slugOrId}`);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className={`flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 ${iconBg}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              {condition.name}
            </h3>
            <button
              onClick={() => onSave && onSave(condition.id)}
              aria-label={condition.isSaved ? 'Remove from saved' : 'Save condition'}
              className={`flex-shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded ${
                condition.isSaved ? 'text-primary-600' : 'text-text-muted hover:text-primary-500'
              }`}
            >
              <Bookmark
                className="h-4 w-4"
                fill={condition.isSaved ? 'currentColor' : 'none'}
              />
            </button>
          </div>
          <Badge variant="neutral" className="mt-1">
            {condition.category}
          </Badge>
        </div>
      </div>
      <p className="text-sm text-text-secondary leading-relaxed">
        {condition.shortDescription}
      </p>
      <Button
        variant="outline"
        size="sm"
        fullWidth
        rightIcon={<ChevronRight className="h-4 w-4" />}
        onClick={handleView}
        aria-label={`View information about ${condition.name}`}
      >
        View details
      </Button>
    </Card>
  );
};

// ─── Medicine Card ────────────────────────────────────────────────────────────

interface MedicineCardProps {
  medicine: Medicine;
  onView?: (id: string) => void;
  onSave?: (id: string) => void;
}

export const MedicineCard: React.FC<MedicineCardProps> = ({
  medicine,
  onView,
  onSave,
}) => {
  const navigate = useNavigate();

  const handleView = () => {
    const slugOrId = medicine.slug || medicine.id;
    if (onView) onView(slugOrId);
    else navigate(`/health/${slugOrId}`);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary-50 text-secondary-600 flex-shrink-0"
            aria-hidden="true"
          >
            <Pill className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary">
              {medicine.name}
            </h3>
            <p className="text-xs text-text-muted">{medicine.genericName}</p>
          </div>
        </div>
        <button
          onClick={() => onSave && onSave(medicine.id)}
          aria-label={medicine.isSaved ? 'Remove from saved' : 'Save medicine'}
          className={`flex-shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded ${
            medicine.isSaved ? 'text-primary-600' : 'text-text-muted hover:text-primary-500'
          }`}
        >
          <Bookmark
            className="h-4 w-4"
            fill={medicine.isSaved ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <Badge variant="secondary">{medicine.category}</Badge>

      <p className="text-sm text-text-secondary leading-relaxed">
        {medicine.shortDescription}
      </p>

      <Button
        variant="outline"
        size="sm"
        fullWidth
        rightIcon={<ChevronRight className="h-4 w-4" />}
        onClick={handleView}
        aria-label={`View information about ${medicine.name}`}
      >
        View information
      </Button>
    </Card>
  );
};

// ─── Health Article Card ──────────────────────────────────────────────────────

interface HealthArticleCardProps {
  article: HealthArticle;
  onRead?: (id: string) => void;
  onSave?: (id: string) => void;
}

export const HealthArticleCard: React.FC<HealthArticleCardProps> = ({
  article,
  onRead,
  onSave,
}) => {
  const navigate = useNavigate();

  const handleRead = () => {
    const slugOrId = article.slug || article.id;
    if (onRead) onRead(slugOrId);
    else navigate(`/health/${slugOrId}`);
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="primary">{article.category}</Badge>
            <span className="text-xs text-text-muted">
              {article.readTimeMinutes} min read
            </span>
          </div>
          <h3 className="text-base font-semibold text-text-primary leading-snug">
            {article.title}
          </h3>
        </div>
        <button
          onClick={() => onSave && onSave(article.id)}
          aria-label={article.isSaved ? 'Remove from saved' : 'Save article'}
          className={`flex-shrink-0 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded ${
            article.isSaved ? 'text-primary-600' : 'text-text-muted hover:text-primary-500'
          }`}
        >
          <Bookmark
            className="h-4 w-4"
            fill={article.isSaved ? 'currentColor' : 'none'}
          />
        </button>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        {article.shortDescription}
      </p>

      <Button
        variant="ghost"
        size="sm"
        rightIcon={<ChevronRight className="h-4 w-4" />}
        onClick={handleRead}
        aria-label={`Read article: ${article.title}`}
        className="self-start -ml-2"
      >
        Read article
      </Button>
    </Card>
  );
};

// ─── Health Category Card ─────────────────────────────────────────────────────

interface HealthCategoryCardProps {
  label: string;
  icon: React.ReactNode;
  iconBgClass: string;
  count?: number;
  onClick?: () => void;
}

export const HealthCategoryCard: React.FC<HealthCategoryCardProps> = ({
  label,
  icon,
  iconBgClass,
  count,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center gap-2 p-4 rounded-2xl bg-white shadow-card',
        'hover:shadow-card-hover transition-all duration-150 text-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
        'active:scale-95',
      ].join(' ')}
      aria-label={`Browse ${label}${count ? ` (${count} items)` : ''}`}
    >
      <div
        className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconBgClass}`}
        aria-hidden="true"
      >
        {icon}
      </div>
      <span className="text-xs font-semibold text-text-primary">{label}</span>
      {count !== undefined && (
        <span className="text-xs text-text-muted">{count}</span>
      )}
    </button>
  );
};

// ─── Disclaimer Banner ────────────────────────────────────────────────────────

export const MedicalDisclaimer: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 ${className}`}
    role="note"
    aria-label="Medical disclaimer"
  >
    <Stethoscope
      className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5"
      aria-hidden="true"
    />
    <p className="text-xs text-amber-900 leading-relaxed font-medium">
      CareConnect provides general educational information and is not a substitute for professional medical advice, diagnosis, or treatment.
    </p>
  </div>
);

export const MedicineSafetyNotice: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-xl p-3 ${className}`}
    role="note"
    aria-label="Medicine safety notice"
  >
    <ShieldCheck
      className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5"
      aria-hidden="true"
    />
    <p className="text-xs text-blue-900 leading-relaxed">
      Always follow your prescriber&apos;s instructions and the official medicine package label. Consult a pharmacist or qualified healthcare professional regarding potential interactions, side effects, and suitability. Individualized dosing recommendations are not provided.
    </p>
  </div>
);

export const ConditionSafetyNotice: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <div
    className={`flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3 ${className}`}
    role="note"
    aria-label="Condition safety notice"
  >
    <AlertCircle
      className="h-4 w-4 text-slate-600 flex-shrink-0 mt-0.5"
      aria-hidden="true"
    />
    <p className="text-xs text-slate-800 leading-relaxed">
      Symptom lists are provided for general educational understanding and cannot confirm a medical diagnosis. If you experience severe symptoms or red flags, seek medical attention promptly.
    </p>
  </div>
);
