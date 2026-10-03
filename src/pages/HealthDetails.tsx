import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Bookmark, Share2, Tag } from 'lucide-react';
import { PageContainer } from '../components/layout/PageContainer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { MedicalDisclaimer } from '../components/health/HealthCards';
import { EmptyState, LoadingState } from '../components/ui/StateComponents';
import { healthApi } from '../services/api';
import type { HealthCondition, Medicine, HealthArticle } from '../types';

type FoundItem =
  | { type: 'condition'; data: HealthCondition }
  | { type: 'medicine'; data: Medicine }
  | { type: 'article'; data: HealthArticle };

export const HealthDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [found, setFound] = useState<FoundItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    // Try condition → medicine → article in sequence
    const tryFetch = async () => {
      try {
        const condition = await healthApi.getConditionBySlug(id);
        setFound({ type: 'condition', data: condition });
        return;
      } catch {
        // not a condition slug
      }
      try {
        const medicine = await healthApi.getMedicineBySlug(id);
        setFound({ type: 'medicine', data: medicine });
        return;
      } catch {
        // not a medicine slug
      }
      try {
        const article = await healthApi.getArticleBySlug(id);
        setFound({ type: 'article', data: article });
        return;
      } catch {
        // not found in any collection
      }
      setFound(null);
      setError('not_found');
    };

    tryFetch().finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <PageContainer>
        <LoadingState message="Loading details…" />
      </PageContainer>
    );
  }

  if (error === 'not_found' || !found) {
    return (
      <PageContainer>
        <EmptyState
          title="Item not found"
          description="We couldn't find what you were looking for."
          action={{ label: 'Go back', onClick: () => navigate(-1) }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary mb-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
        aria-label="Go back"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back
      </button>

      {/* Condition Detail */}
      {found.type === 'condition' && (() => {
        const condition = found.data;
        return (
          <article>
            <div className="flex items-start justify-between gap-2 mb-2">
              <h1 className="text-2xl font-bold text-text-primary">
                {condition.name}
              </h1>
              <button
                aria-label="Save condition"
                className="mt-1 text-text-muted hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <Bookmark className="h-5 w-5" />
              </button>
            </div>
            <Badge variant="neutral" className="mb-4">
              {condition.category}
            </Badge>
            <MedicalDisclaimer className="mb-5" />
            <p className="text-base text-text-secondary leading-relaxed mb-5">
              {condition.description || condition.overview}
            </p>

            {(condition.symptoms?.length ?? 0) > 0 && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Common symptoms
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {condition.symptoms.map((symptom) => (
                    <li
                      key={symptom}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {symptom}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(condition.causes?.length ?? 0) > 0 && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Causes
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {(condition.causes ?? []).map((cause) => (
                    <li
                      key={cause}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {cause}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(condition.prevention?.length ?? 0) > 0 && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Prevention
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {(condition.prevention ?? []).map((step) => (
                    <li
                      key={step}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {step}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {(condition.whenToSeekMedicalHelp?.length ?? 0) > 0 && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                <h2 className="text-sm font-semibold text-red-800 mb-2">
                  When to seek medical help
                </h2>
                <ul className="flex flex-col gap-1">
                  {(condition.whenToSeekMedicalHelp ?? []).map((tip) => (
                    <li key={tip} className="text-sm text-red-700 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" aria-hidden="true" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {condition.tags && condition.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {condition.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            <Button
              variant="primary"
              size="md"
              fullWidth
              onClick={() => navigate('/appointments/book')}
            >
              Book a consultation
            </Button>
          </article>
        );
      })()}

      {/* Article Detail */}
      {found.type === 'article' && (() => {
        const article = found.data;
        return (
          <article>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <Badge variant="primary" className="mb-2">
                  {article.category}
                </Badge>
                <h1 className="text-2xl font-bold text-text-primary">
                  {article.title}
                </h1>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <button
                  aria-label="Save article"
                  className="text-text-muted hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  <Bookmark className="h-5 w-5" />
                </button>
                <button
                  aria-label="Share article"
                  className="text-text-muted hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
                >
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>
            <p className="text-sm text-text-muted mb-4">
              {article.readTimeMinutes ?? article.readingTimeMinutes ?? 5} min read · Published{' '}
              {new Date(article.publishedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </p>
            <MedicalDisclaimer className="mb-5" />
            <p className="text-base text-text-secondary leading-relaxed mb-4">
              {article.shortDescription ?? article.summary}
            </p>
            {article.content && (
              <div className="prose prose-sm max-w-none text-text-secondary leading-relaxed mb-4 whitespace-pre-line">
                {article.content}
              </div>
            )}
            {article.tags && article.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {article.tags.map((tag) => (
                  <Badge key={tag} variant="neutral">
                    <Tag className="h-3 w-3" aria-hidden="true" />
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </article>
        );
      })()}

      {/* Medicine Detail */}
      {found.type === 'medicine' && (() => {
        const medicine = found.data;
        const uses = medicine.commonUses ?? medicine.uses ?? [];
        const sideEffects = medicine.commonSideEffects ?? medicine.sideEffects ?? [];
        return (
          <article>
            <div className="flex items-start justify-between gap-2 mb-2">
              <div>
                <h1 className="text-2xl font-bold text-text-primary">
                  {medicine.name}
                </h1>
                <p className="text-sm text-text-muted">{medicine.genericName}</p>
              </div>
              <button
                aria-label="Save medicine"
                className="mt-1 text-text-muted hover:text-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
              >
                <Bookmark className="h-5 w-5" />
              </button>
            </div>
            <Badge variant="secondary" className="mb-4">
              {medicine.category}
            </Badge>
            <MedicalDisclaimer className="mb-5" />
            <p className="text-base text-text-secondary leading-relaxed mb-5">
              {medicine.shortDescription ?? medicine.description}
            </p>

            {uses.length > 0 && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Common uses
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {uses.map((use) => (
                    <li
                      key={use}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-secondary-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {use}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {sideEffects.length > 0 && (
              <>
                <h2 className="text-base font-semibold text-text-primary mb-3">
                  Common side effects
                </h2>
                <ul className="flex flex-col gap-2 mb-6">
                  {sideEffects.map((effect) => (
                    <li
                      key={effect}
                      className="flex items-center gap-2 text-sm text-text-secondary"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
                        aria-hidden="true"
                      />
                      {effect}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {medicine.warnings && medicine.warnings.length > 0 && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                <h2 className="text-sm font-semibold text-amber-800 mb-2">Warnings</h2>
                <ul className="flex flex-col gap-1">
                  {medicine.warnings.map((w) => (
                    <li key={w} className="text-sm text-amber-700">{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {medicine.dosageInstructions && (
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <h2 className="text-sm font-semibold text-blue-800 mb-1">Dosage Instructions</h2>
                <p className="text-sm text-blue-700">{medicine.dosageInstructions}</p>
              </div>
            )}

            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-xs text-amber-800 leading-relaxed">
                Always consult your doctor or pharmacist before starting, stopping,
                or changing any medication.
              </p>
            </div>
          </article>
        );
      })()}
    </PageContainer>
  );
};

export default HealthDetails;
