import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'
import devGuideContent from '../DEV_GUIDE.md?raw'
import 'highlight.js/styles/github-dark.css'
import './devdoc.css'

export default function DevDocPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <article className="prose prose-neutral dark:prose-invert max-w-none prose-lg">
        <Markdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeHighlight, rehypeSlug]}
        >
          {devGuideContent}
        </Markdown>
      </article>
    </div>
  )
}
