import type { Metadata } from 'next';

export const metadata: Metadata = {
    title: '新規登録 | SportsLink',
    description: 'SportsLinkの新規アカウントを作成します',
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
