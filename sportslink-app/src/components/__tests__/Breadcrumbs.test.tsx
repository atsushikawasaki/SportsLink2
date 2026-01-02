import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Breadcrumbs from '../Breadcrumbs';

// Next.js Linkコンポーネントをモック
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// lucide-reactアイコンをモック
vi.mock('lucide-react', () => ({
  ChevronRight: () => <span data-testid="chevron-right">›</span>,
  Home: () => <span data-testid="home-icon">🏠</span>,
}));

describe('Breadcrumbs Component', () => {
  it('should render without crashing', () => {
    render(<Breadcrumbs items={[]} />);
    expect(screen.getByTestId('home-icon')).toBeDefined();
  });

  it('should render breadcrumb items with links', () => {
    const items = [
      { label: 'Tournaments', href: '/tournaments' },
      { label: 'Tournament 1', href: '/tournaments/1' },
    ];
    render(<Breadcrumbs items={items} />);
    
    expect(screen.getByText('Tournaments')).toBeDefined();
    expect(screen.getByText('Tournament 1')).toBeDefined();
  });

  it('should render breadcrumb items without links', () => {
    const items = [
      { label: 'Current Page' },
    ];
    render(<Breadcrumbs items={items} />);
    
    expect(screen.getByText('Current Page')).toBeDefined();
  });
});

