import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '利用規約 | SportsLink',
    description: 'SportsLinkの利用規約',
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
