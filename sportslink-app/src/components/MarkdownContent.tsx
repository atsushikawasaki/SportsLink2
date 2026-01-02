'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownContentProps {
    content: string;
    className?: string;
}

export default function MarkdownContent({ content, className = '' }: MarkdownContentProps) {
    return (
        <div className={`prose prose-invert max-w-none space-y-6 text-slate-300 ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    h1: ({ node, ...props }) => (
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-4" {...props} />
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-semibold text-white mb-4 mt-6" {...props} />
                    ),
                    h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-semibold text-white mb-3 mt-4" {...props} />
                    ),
                    p: ({ node, ...props }) => (
                        <p className="mb-4 leading-relaxed" {...props} />
                    ),
                    ul: ({ node, ...props }) => (
                        <ul className="list-disc list-inside space-y-2 ml-4 mb-4" {...props} />
                    ),
                    ol: ({ node, ...props }) => (
                        <ol className="list-decimal list-inside space-y-2 ml-4 mb-4" {...props} />
                    ),
                    li: ({ node, ...props }) => (
                        <li className="mb-1" {...props} />
                    ),
                    strong: ({ node, ...props }) => (
                        <strong className="font-semibold text-white" {...props} />
                    ),
                    hr: ({ node, ...props }) => (
                        <hr className="border-slate-700 my-6" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
}

