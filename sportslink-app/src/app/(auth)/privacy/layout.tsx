import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'プライバシーポリシー | SportsLink',
    description: 'SportsLinkのプライバシーポリシー',
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
