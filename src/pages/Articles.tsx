import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { HealthArticleCard } from '../components/health/HealthCards';
import { EmptyState, LoadingState } from '../components/ui/StateComponents';
import { BookOpen } from 'lucide-react';
import { healthApi } from '../services/api';
import type { HealthArticle } from '../types';

export const Articles: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await healthApi.getArticles({ q: searchQuery, limit: 100 });
      const normalised = response.data.map((a) => ({
        ...a,
        id: (a as unknown as { _id: string })._id ?? a.id,
      }));
      setArticles(normalised);
    } catch (err) {
      setError('Failed to load articles. Please try again.');
      console.error('[Articles] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(fetchArticles, 300);
    return () => clearTimeout(timer);
  }, [fetchArticles]);

  return (
    <PageContainer>
      <PageHeader
        title="Health Articles"
        subtitle="Trusted educational content on health and wellness."
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search articles…"
        className="mb-5"
        id="articles-search"
      />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="Could not load articles"
          description={error}
          action={{ label: 'Retry', onClick: fetchArticles }}
        />
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-8 w-8" />}
          title="No articles found"
          description={`No results for "${searchQuery}". Try a different search term.`}
          action={{ label: 'Clear search', onClick: () => setSearchQuery('') }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map((article) => (
            <HealthArticleCard
              key={article.id}
              article={article}
              onRead={(id) => navigate(`/health/${id}`)}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Articles;
