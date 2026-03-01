'use client';

import { useState } from 'react';
import { toast } from '@/lib/toast';
import { FileDown, Loader2 } from 'lucide-react';
import { exportToPDFSimple, type TournamentResults } from '@/lib/pdf-export';

interface PDFExportButtonProps {
    tournamentId: string;
    tournamentName: string;
}

export default function PDFExportButton({ tournamentId, tournamentName }: PDFExportButtonProps) {
    const [isExporting, setIsExporting] = useState(false);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await fetch(`/api/tournaments/${tournamentId}/results/export?format=pdf`);
            if (!response.ok) {
                const error = await response.json();
                toast.error(error.error || 'PDFのエクスポートに失敗しました');
                return;
            }

            const data: TournamentResults = await response.json();
            
            // 簡易版PDFエクスポート（ブラウザの印刷機能を使用）
            exportToPDFSimple(data);
        } catch (error) {
            console.error('PDF export error:', error);
            toast.error('PDFのエクスポートに失敗しました');
        } finally {
            setIsExporting(false);
        }
    };

    return (
        <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-lg shadow-lg hover:from-blue-600 hover:to-cyan-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
        >
            {isExporting ? (
                <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>エクスポート中...</span>
                </>
            ) : (
                <>
                    <FileDown className="w-5 h-5" />
                    <span>PDFでエクスポート</span>
                </>
            )}
        </button>
    );
}

