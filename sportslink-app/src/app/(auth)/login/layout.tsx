import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: 'ログイン | SportsLink',
    description: 'SportsLinkにログインして大会・試合を管理できます',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
