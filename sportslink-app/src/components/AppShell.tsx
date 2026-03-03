import NavigationMenu from './NavigationMenu';
import AppHeader from './AppHeader';
import BottomNav from './BottomNav';

export default function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-[var(--color-bg-primary)] flex">
            <aside className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-60 bg-[var(--color-bg-surface)] border-r border-[var(--color-border-base)] z-40">
                <NavigationMenu />
            </aside>

            <div className="flex-1 flex flex-col min-h-screen lg:ml-60">
                <AppHeader />
                <main className="flex-1 pb-16 lg:pb-0">
                    {children}
                </main>
            </div>

            <BottomNav />
        </div>
    );
}
