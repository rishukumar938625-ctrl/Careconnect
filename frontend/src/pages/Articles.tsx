import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer, PageHeader } from '../components/layout/PageContainer';
import { SearchBar } from '../components/ui/SearchBar';
import { HealthArticleCard } from '../components/health/HealthCards';
import { EmptyState, LoadingState } from '../components/ui/StateComponents';
import { BookOpen } from 'lucide-react';
import { healthApi } from '../services/api';
import type { HealthArticle } from '../types';

export const Articles: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const isBookmarkedOnly = searchParams.get('bookmarked') === 'true';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [articles, setArticles] = useState<HealthArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await healthApi.getArticles({
        q: searchQuery,
        bookmarked: isBookmarkedOnly,
        limit: 100,
      });
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
  }, [searchQuery, isBookmarkedOnly]);

  useEffect(() => {
    const timer = setTimeout(fetchArticles, 300);
    return () => clearTimeout(timer);
  }, [fetchArticles]);

  const handleToggleBookmark = async (slugOrId: string) => {
    try {
      const res = await healthApi.toggleArticleBookmark(slugOrId);
      setArticles((prev) =>
        isBookmarkedOnly
          ? prev.filter((a) => (a.slug || a.id) !== slugOrId)
          : prev.map((a) =>
              (a.slug || a.id) === slugOrId
                ? { ...a, bookmarked: res.bookmarked, isSaved: res.bookmarked }
                : a
            )
      );
    } catch (err) {
      console.error('[Articles] toggle bookmark error:', err);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={isBookmarkedOnly ? 'Saved Articles' : 'Health Articles'}
        subtitle={
          isBookmarkedOnly
            ? 'Your bookmarked educational articles.'
            : 'Trusted educational content on health and wellness.'
        }
      />

      <SearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder={isBookmarkedOnly ? 'Search saved articles…' : 'Search articles…'}
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
          title={isBookmarkedOnly ? 'No saved articles' : 'No articles found'}
          description={
            isBookmarkedOnly
              ? searchQuery
                ? `No saved articles matching "${searchQuery}".`
                : 'You have not saved any articles yet.'
              : `No results for "${searchQuery}". Try a different search term.`
          }
          action={
            isBookmarkedOnly && !searchQuery
              ? { label: 'Browse all articles', onClick: () => navigate('/health/articles') }
              : { label: 'Clear search', onClick: () => setSearchQuery('') }
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {articles.map((article) => (
            <HealthArticleCard
              key={article.id}
              article={article}
              onRead={(id) => navigate(`/health/${id}`)}
              onSave={handleToggleBookmark}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
};

export default Articles;
