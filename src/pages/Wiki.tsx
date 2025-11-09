import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { marked } from 'marked';
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

const Wiki = () => {
  const { page } = useParams<{ page?: string }>();
  const [content, setContent] = useState<string>('');
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const currentPage = page || 'Home';

  useEffect(() => {
    const fetchWikiPages = async () => {
      try {
        const response = await fetch(
          'https://api.github.com/repos/EdwardCasler/FtcRobotController/contents?ref=wiki'
        );
        
        if (response.ok) {
          const files = await response.json();
          const wikiPages = files
            .filter((file: any) => file.name.endsWith('.md'))
            .map((file: any) => ({
              name: file.name.replace('.md', '').replace(/-/g, ' '),
              path: file.name.replace('.md', ''),
            }));
          setPages(wikiPages);
        }
      } catch (error) {
        console.error('Error fetching wiki pages:', error);
      }
    };

    fetchWikiPages();
  }, []);

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://raw.githubusercontent.com/wiki/EdwardCasler/FtcRobotController/${currentPage}.md`
        );
        
        if (response.ok) {
          const markdownText = await response.text();
          const htmlContent = await marked.parse(markdownText);
          const sanitizedHtml = DOMPurify.sanitize(htmlContent);
          setContent(sanitizedHtml);
        } else {
          setContent('<h1>Page Not Found</h1><p>The requested wiki page could not be found.</p>');
          toast({
            title: 'Page not found',
            description: 'The wiki page you requested does not exist.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching wiki content:', error);
        setContent('<h1>Error Loading Page</h1><p>There was an error loading the wiki page.</p>');
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
  }, [currentPage, toast]);

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
            <h1 className="text-4xl font-bold">FTC Robot Controller Wiki</h1>
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
              {pages.length > 0 ? (
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
                <div className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
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
            ) : (
              <div 
                className="prose prose-slate dark:prose-invert max-w-none"
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
