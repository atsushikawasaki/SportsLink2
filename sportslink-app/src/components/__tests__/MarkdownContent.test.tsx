import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MarkdownContent from '../MarkdownContent';

// react-markdownをモック
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

// remark-gfmをモック（default exportとして関数を返す）
vi.mock('remark-gfm', () => {
  const mockPlugin = () => {};
  return {
    default: mockPlugin,
  };
});

describe('MarkdownContent Component', () => {
  it('should render markdown content', () => {
    const content = '# Test Heading\n\nThis is a test paragraph.';
    render(<MarkdownContent content={content} />);

    expect(screen.getByTestId('markdown')).toBeDefined();
  });

  it('should render with custom className', () => {
    const content = 'Test content';
    const { container } = render(<MarkdownContent content={content} className="custom-class" />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should render empty content', () => {
    render(<MarkdownContent content="" />);
    expect(screen.getByTestId('markdown')).toBeDefined();
  });

  it('should render long content', () => {
    const longContent = '# Heading\n\n'.repeat(100) + 'End content';
    render(<MarkdownContent content={longContent} />);
    expect(screen.getByTestId('markdown')).toBeDefined();
  });

  it('should have default className when not provided', () => {
    const content = 'Test content';
    const { container } = render(<MarkdownContent content={content} />);

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('prose');
    expect(wrapper).toHaveClass('prose-invert');
  });
});

