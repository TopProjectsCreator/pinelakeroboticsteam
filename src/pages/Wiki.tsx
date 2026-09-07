import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { marked } from 'marked';
import { gfmHeadingId } from 'marked-gfm-heading-id';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface WikiPage {
  name: string;
  path: string;
}

// Configure marked for GitHub-flavored markdown
marked.setOptions({
  gfm: true,
  breaks: true,
});
marked.use(gfmHeadingId());

// Allowlist wiki page names to prevent path traversal / URL injection.
// GitHub wiki pages are flat names; reject ".." and unexpected characters.
const isValidWikiPage = (name: string): boolean => {
  if (!name || name.length > 200) return false;
  if (name.includes('..')) return false;
  return /^[A-Za-z0-9 _.-]+$/.test(name);
};

const Wiki = () => {
  const { page } = useParams<{ page?: string }>();
  const [content, setContent] = useState<string>('');
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [pagesError, setPagesError] = useState(false);
  const [pagesRetryKey, setPagesRetryKey] = useState(0);
  const [contentError, setContentError] = useState<null | 'not-found' | 'rate-limited' | 'invalid' | 'error'>(null);
  const [contentRetryKey, setContentRetryKey] = useState(0);
  const { toast } = useToast();
  const currentPage = page || 'Home';
  const navigate = useNavigate();

  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const anchor = target.closest('a') as HTMLAnchorElement | null;
    if (!anchor) return;

    const hrefAttr = anchor.getAttribute('href') || '';
    if (hrefAttr.startsWith('#') || hrefAttr.startsWith('mailto:')) return;

    const isExternal = /^https?:\/\//i.test(hrefAttr);
    if (isExternal || anchor.target === '_blank') return;

    const url = new URL(anchor.href, window.location.origin);
    if (url.pathname.startsWith('/wiki/')) {
      e.preventDefault();
      navigate(url.pathname + url.search + url.hash);
    }
  };

  useEffect(() => {
    const fetchWikiPages = async () => {
      setPagesLoading(true);
      setPagesError(false);
      const fetchTree = async (branch: string) => {
        const res = await fetch(
          `https://api.github.com/repos/EdwardCasler/FtcRobotController.wiki/git/trees/${branch}?recursive=1`
        );
        if (res.status === 403) {
          throw new Error('GitHub API rate limit reached (403)');
        }
        if (!res.ok) throw new Error('Failed to fetch wiki tree');
        return res.json();
      };

      try {
        let data;
        try {
          data = await fetchTree('main');
        } catch {
          data = await fetchTree('master');
        }

        const wikiPages = (data.tree || [])
          .filter((node: any) => node.type === 'blob' && node.path.endsWith('.md'))
          .map((node: any) => ({
            name: node.path.replace('.md', '').replace(/-/g, ' '),
            path: node.path.replace('.md', ''),
          }))
          .sort((a: WikiPage, b: WikiPage) => a.name.localeCompare(b.name));

        setPages(wikiPages);
      } catch (error) {
        console.error('Error fetching wiki pages:', error);
        setPagesError(true);
        const isRateLimited = error instanceof Error && error.message.includes('rate limit');
        toast({
          title: isRateLimited ? 'Wiki rate limit reached' : 'Error',
          description: isRateLimited
            ? 'GitHub API rate limit reached. Please wait a bit and try again.'
            : 'Failed to load wiki page list.',
          variant: 'destructive',
        });
      } finally {
        setPagesLoading(false);
      }
    };

    fetchWikiPages();
  }, [toast, pagesRetryKey]);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setContentError(null);
      if (!isValidWikiPage(currentPage)) {
        setContent('');
        setContentError('invalid');
        toast({
          title: 'Invalid page',
          description: 'The wiki page name contains invalid characters.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/wiki/EdwardCasler/FtcRobotController/${encodeURIComponent(currentPage)}.md`
        );

        if (response.status === 403) {
          setContent('');
          setContentError('rate-limited');
          toast({
            title: 'Wiki rate limit reached',
            description: 'GitHub rate limit reached. Please wait a bit and try again.',
            variant: 'destructive',
          });
          return;
        }
        if (response.status === 404) {
          setContent('');
          setContentError('not-found');
          toast({
            title: 'Page not found',
            description: 'The wiki page you requested does not exist.',
            variant: 'destructive',
          });
          return;
        }
        if (response.ok) {
          const markdownText = await response.text();
          const htmlContent = await marked.parse(markdownText);

          // Rewrite links to route through /wiki and open externals in new tab
          const parser = new DOMParser();
          const doc = parser.parseFromString(htmlContent, 'text/html');
          doc.querySelectorAll('a').forEach((a) => {
            const href = a.getAttribute('href') || '';
            if (!href) return;
            if (href.startsWith('#') || href.startsWith('mailto:')) return;
            if (/^https?:\/\//i.test(href)) {
              a.setAttribute('target', '_blank');
              a.setAttribute('rel', 'noopener noreferrer');
              return;
            }
            let pageHref = href.replace(/^\/?wiki\//, '').replace(/\.md$/, '');
            pageHref = pageHref.replace(/\s+/g, '-');
            a.setAttribute('href', `/wiki/${encodeURI(pageHref)}`);
          });

          const rewrittenHtml = doc.body.innerHTML;
          const sanitizedHtml = DOMPurify.sanitize(rewrittenHtml);
          setContent(sanitizedHtml);
          setContentError(null);
        } else {
          setContent('');
          setContentError('error');
          toast({
            title: 'Error',
            description: 'Failed to load wiki content.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching wiki content:', error);
        setContent('');
        setContentError('error');
        toast({
          title: 'Error',
          description: 'Failed to load wiki content.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [currentPage, toast, contentRetryKey]);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link to="/">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <h2 className="text-4xl font-bold">FTC Robot Controller Wiki</h2>
          </div>
          <p className="text-muted-foreground">
            Documentation and guides for the FTC Robot Controller
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar */}
          <Card className="p-4 h-fit lg:sticky lg:top-4">
            <h2 className="font-semibold mb-4 text-lg">Wiki Pages</h2>
            <nav className="space-y-1">
              {pagesLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : pagesError ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Failed to load wiki pages.</p>
                  <Button variant="outline" size="sm" onClick={() => setPagesRetryKey((k) => k + 1)}>
                    Try Again
                  </Button>
                </div>
              ) : pages.length > 0 ? (
                pages.map((wikiPage) => (
                  <Link
                    key={wikiPage.path}
                    to={`/wiki/${wikiPage.path}`}
                    className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                      currentPage === wikiPage.path
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-accent'
                    }`}
                  >
                    {wikiPage.name}
                  </Link>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No wiki pages found.</p>
              )}
            </nav>
          </Card>

          {/* Content */}
          <Card className="p-8 lg:col-span-3">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : contentError === 'rate-limited' ? (
              <div className="text-center py-8">
                <h1 className="text-2xl font-bold mb-2">Wiki Rate Limit Reached</h1>
                <p className="text-muted-foreground mb-6">GitHub rate limit reached. Please wait a bit and try again.</p>
                <Button variant="outline" onClick={() => setContentRetryKey((k) => k + 1)}>
                  Try Again
                </Button>
              </div>
            ) : contentError === 'error' ? (
              <div className="text-center py-8">
                <h1 className="text-2xl font-bold mb-2">Failed to Load Page</h1>
                <p className="text-muted-foreground mb-6">There was an error loading the wiki page. Please try again.</p>
                <Button variant="outline" onClick={() => setContentRetryKey((k) => k + 1)}>
                  Try Again
                </Button>
              </div>
            ) : contentError === 'invalid' ? (
              <div className="text-center py-8">
                <h1 className="text-2xl font-bold mb-2">Invalid Page</h1>
                <p className="text-muted-foreground mb-6">The requested wiki page name is invalid.</p>
                <Link to="/wiki/Home">
                  <Button variant="outline">Back to Wiki Home</Button>
                </Link>
              </div>
            ) : contentError === 'not-found' ? (
              <div className="text-center py-8">
                <h1 className="text-2xl font-bold mb-2">Page Not Found</h1>
                <p className="text-muted-foreground mb-6">The requested wiki page could not be found.</p>
                <Link to="/wiki/Home">
                  <Button variant="outline">Back to Wiki Home</Button>
                </Link>
              </div>
            ) : (
              <div
                className="prose prose-slate dark:prose-invert max-w-none [&_a]:text-primary [&_a]:underline [&_a:hover]:opacity-80"
                onClick={handleContentClick}
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Wiki;
