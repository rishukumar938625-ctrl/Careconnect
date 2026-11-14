import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Pill,
  AlertCircle,
  Heart,
  ShieldCheck,
  ChevronRight,
  Stethoscope,
} from 'lucide-react';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { HealthCategoryCard, HealthArticleCard, MedicalDisclaimer } from '../components/health/HealthCards';
import { Card } from '../components/ui/Card';
import { mockArticles, popularTopics } from '../data/mockHealthData';
import { healthApi } from '../services/api';
import type { HealthArticle } from '../types';

const categories = [
  {
    label: 'Conditions',
    icon: <Activity className="h-6 w-6" />,
    iconBgClass: 'bg-blue-100 text-blue-600',
    path: '/health/conditions',
    count: 8,
  },
  {
    label: 'Medicines',
    icon: <Pill className="h-6 w-6" />,
    iconBgClass: 'bg-secondary-100 text-secondary-600',
    path: '/health/medicines',
    count: 8,
  },
  {
    label: 'Symptoms',
    icon: <AlertCircle className="h-6 w-6" />,
    iconBgClass: 'bg-amber-100 text-amber-600',
    path: '/health/conditions',
    count: 12,
  },
  {
    label: 'Wellness',
    icon: <Heart className="h-6 w-6" />,
    iconBgClass: 'bg-green-100 text-green-600',
    path: '/health/articles',
    count: 6,
  },
  {
    label: 'First Aid',
    icon: <ShieldCheck className="h-6 w-6" />,
    iconBgClass: 'bg-red-100 text-red-600',
    path: '/health/articles',
    count: 5,
  },
] as const;

export const Health: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredArticles, setFeaturedArticles] = useState<HealthArticle[]>(mockArticles.slice(0, 3));

  useEffect(() => {
    let active = true;
    try {
      const promise = healthApi.getArticles({ limit: 3 });
      if (promise && typeof promise.then === 'function') {
        promise
          .then((res) => {
            if (active && res && res.data && res.data.length > 0) {
              const normalised = res.data.map((a) => ({
                ...a,
                id: (a as unknown as { _id: string })._id ?? a.id,
              }));
              setFeaturedArticles(normalised);
            }
          })
          .catch((err) => {
            console.warn('[Health] Failed to fetch featured articles from API, using fallback:', err);
          });
      }
    } catch (err) {
      console.warn('[Health] Error calling getArticles:', err);
    }
    return () => {
      active = false;
    };
  }, []);

  const handleToggleBookmark = async (slugOrId: string) => {
    try {
      const res = await healthApi.toggleArticleBookmark(slugOrId);
      setFeaturedArticles((prev) =>
        prev.map((a) =>
          (a.slug || a.id) === slugOrId
            ? { ...a, bookmarked: res.bookmarked, isSaved: res.bookmarked }
            : a
        )
      );
    } catch (err) {
      console.error('[Health] Failed to toggle article bookmark:', err);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/health/conditions?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Health Information"
        subtitle="Learn about conditions, medicines, and wellness topics."
      />

      {/* Search */}
      <form onSubmit={handleSearch} role="search" className="mb-6">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search conditions, medicines, or health topics..."
          id="health-main-search"
        />
      </form>

      {/* Disclaimer */}
      <MedicalDisclaimer className="mb-6" />

      {/* Categories */}
      <section aria-labelledby="categories-heading" className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 id="categories-heading" className="text-base font-semibold text-text-primary">
            Browse by category
          </h2>
        </div>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {categories.map((cat) => (
            <HealthCategoryCard
              key={cat.label}
              label={cat.label}
              icon={cat.icon}
              iconBgClass={cat.iconBgClass}
              count={cat.count}
              onClick={() => navigate(cat.path)}
            />
          ))}
        </div>
      </section>

      {/* Popular Topics */}
      <section aria-labelledby="popular-topics-heading" className="mb-6">
        <h2 id="popular-topics-heading" className="text-base font-semibold text-text-primary mb-3">
          Popular topics
        </h2>
        <div className="flex flex-col gap-2">
          {popularTopics.map((topic) => (
            <button
              key={topic.label}
              onClick={() =>
                topic.conditionId
                  ? navigate(`/health/${topic.conditionId}`)
                  : topic.articleId
                  ? navigate(`/health/${topic.articleId}`)
                  : navigate('/health/conditions')
              }
              className={[
                'flex items-center gap-3 p-3.5 rounded-xl bg-white shadow-card',
                'hover:shadow-card-hover transition-all duration-150 text-left',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              ].join(' ')}
              aria-label={`Search for ${topic.label}`}
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100">
                <Stethoscope className="h-4 w-4 text-text-muted" aria-hidden="true" />
              </div>
              <span className="text-sm font-medium text-text-primary flex-1">
                {topic.label}
              </span>
              <ChevronRight className="h-4 w-4 text-text-muted" aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>

      {/* Featured Articles */}
      <section aria-labelledby="featured-articles-heading">
        <div className="flex items-center justify-between mb-3">
          <h2 id="featured-articles-heading" className="text-base font-semibold text-text-primary">
            Featured articles
          </h2>
          <button
            className="text-xs font-medium text-primary-600 hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            onClick={() => navigate('/health/articles')}
          >
            See all
          </button>
        </div>
        <div className="flex flex-col gap-3">
          {featuredArticles.map((article) => (
            <HealthArticleCard
              key={article.id}
              article={article}
              onRead={(id) => navigate(`/health/${id}`)}
              onSave={handleToggleBookmark}
            />
          ))}
        </div>
      </section>

      {/* Quick links to conditions/medicines */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <Card
          hover
          className="flex flex-col gap-2 cursor-pointer"
          onClick={() => navigate('/health/conditions')}
          role="button"
          tabIndex={0}
          aria-label="Browse all conditions"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100">
            <Activity className="h-5 w-5 text-blue-600" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">All Conditions</h3>
          <p className="text-xs text-text-muted">Browse 8+ health conditions</p>
          <ChevronRight className="h-4 w-4 text-text-muted mt-auto" aria-hidden="true" />
        </Card>
        <Card
          hover
          className="flex flex-col gap-2 cursor-pointer"
          onClick={() => navigate('/health/medicines')}
          role="button"
          tabIndex={0}
          aria-label="Browse all medicines"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-secondary-100">
            <Pill className="h-5 w-5 text-secondary-600" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">All Medicines</h3>
          <p className="text-xs text-text-muted">Browse 8+ medicines</p>
          <ChevronRight className="h-4 w-4 text-text-muted mt-auto" aria-hidden="true" />
        </Card>
      </div>
    </PageContainer>
  );
};

export default Health;
