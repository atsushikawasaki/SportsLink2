import { create } from 'zustand';

interface OfflinePoint {
    id: string;
    matchId: string;
    pointType: 'A_score' | 'B_score';
    clientUuid: string;
    createdAt: string;
}

interface MatchState {
    matchId: string | null;
    umpireId: string | null;
    matchStatus: 'pending' | 'inprogress' | 'paused' | 'finished';
    serverVersion: number;
    localQueue: OfflinePoint[];
    gameCountA: number;
    gameCountB: number;
    currentScoreA: string;
    currentScoreB: string;
    isSyncing: boolean;
    hasConflict: boolean;
}

interface MatchStoreState extends MatchState {
    connectionState: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
    setMatchState: (state: Partial<MatchState>) => void;
    updateScore: (gameCountA: number, gameCountB: number, currentScoreA: string, currentScoreB: string) => void;
    addPointToQueue: (point: OfflinePoint) => void;
    removePointFromQueue: (id: string) => void;
    clearQueue: () => void;
    setConnectionState: (state: 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING') => void;
    setSyncing: (syncing: boolean) => void;
    setConflict: (hasConflict: boolean) => void;
    clearConflict: () => void;
    resetMatch: () => void;
}

const initialMatchState: MatchState = {
    matchId: null,
    umpireId: null,
    matchStatus: 'pending',
    serverVersion: 1,
    localQueue: [],
    gameCountA: 0,
    gameCountB: 0,
    currentScoreA: '0',
    currentScoreB: '0',
    isSyncing: false,
    hasConflict: false,
};

export const useMatchStore = create<MatchStoreState>((set) => ({
    ...initialMatchState,
    connectionState: 'DISCONNECTED',
    setMatchState: (state) => set((prev) => ({ ...prev, ...state })),
    updateScore: (gameCountA, gameCountB, currentScoreA, currentScoreB) =>
        set({ gameCountA, gameCountB, currentScoreA, currentScoreB }),
    addPointToQueue: (point) =>
        set((state) => {
            if (state.localQueue.some((p) => p.clientUuid === point.clientUuid)) {
                return state;
            }
            return { localQueue: [...state.localQueue, point] };
        }),
    removePointFromQueue: (id) =>
        set((state) => ({ localQueue: state.localQueue.filter((p) => p.id !== id) })),
    clearQueue: () => set({ localQueue: [] }),
    setConnectionState: (connectionState) => set({ connectionState }),
    setSyncing: (isSyncing) => set({ isSyncing }),
    setConflict: (hasConflict) => set({ hasConflict }),
    clearConflict: () => set({ hasConflict: false }),
    resetMatch: () => set(initialMatchState),
}));
