/**
 * PDFエクスポート機能（クライアント側）
 * jsPDFを使用して試合結果をPDF形式でエクスポート
 */

export interface MatchResult {
    round_name: string;
    teamA: string;
    teamB: string;
    scoreA: number;
    scoreB: number;
    final_score: string;
    court_number: number | null;
    started_at: string | null;
}

export interface TournamentResults {
    tournament: string;
    results: MatchResult[];
    count: number;
}

/**
 * PDFを生成してダウンロード
 * 注意: この関数はクライアント側でのみ実行可能
 * jsPDFライブラリが必要です（npm install jspdf）
 */
export async function exportToPDF(data: TournamentResults) {
    // 動的インポート（クライアント側のみ）
    if (typeof window === 'undefined') {
        throw new Error('PDF export is only available on the client side');
    }

    try {
        // jsPDFを動的インポート
        const { default: jsPDF } = await import('jspdf');

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 20;
        const lineHeight = 7;
        let yPosition = margin;

        // タイトル
        doc.setFontSize(18);
        doc.text(data.tournament, pageWidth / 2, yPosition, { align: 'center' });
        yPosition += lineHeight * 2;

        doc.setFontSize(12);
        doc.text('試合結果一覧', pageWidth / 2, yPosition, { align: 'center' });
        yPosition += lineHeight * 2;

        // 試合結果テーブル
        doc.setFontSize(10);
        const tableStartY = yPosition;

        // ヘッダー
        doc.setFont('helvetica', 'bold');
        doc.text('ラウンド', margin, yPosition);
        doc.text('チームA', margin + 40, yPosition);
        doc.text('スコア', margin + 80, yPosition);
        doc.text('チームB', margin + 110, yPosition);
        doc.text('コート', margin + 150, yPosition);
        yPosition += lineHeight;

        // 区切り線
        doc.setLineWidth(0.5);
        doc.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += lineHeight;

        // データ行
        doc.setFont('helvetica', 'normal');
        for (const result of data.results) {
            // ページを超える場合は新しいページを作成
            if (yPosition > pageHeight - margin - lineHeight * 3) {
                doc.addPage();
                yPosition = margin;
            }

            doc.text(result.round_name, margin, yPosition);
            doc.text(result.teamA, margin + 40, yPosition);
            doc.text(`${result.scoreA} - ${result.scoreB}`, margin + 80, yPosition);
            doc.text(result.teamB, margin + 110, yPosition);
            doc.text(result.court_number?.toString() || '-', margin + 150, yPosition);
            yPosition += lineHeight;
        }

        // フッター
        const totalPages = doc.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.text(
                `ページ ${i} / ${totalPages}`,
                pageWidth / 2,
                pageHeight - 10,
                { align: 'center' }
            );
            doc.text(
                `生成日時: ${new Date().toLocaleString('ja-JP')}`,
                pageWidth - margin,
                pageHeight - 10,
                { align: 'right' }
            );
        }

        // PDFをダウンロード
        const fileName = `${data.tournament}_試合結果_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(fileName);
    } catch (error) {
        console.error('PDF export error:', error);
        throw new Error('PDFの生成に失敗しました。jsPDFライブラリがインストールされているか確認してください。');
    }
}

/**
 * 簡易版PDFエクスポート（jsPDFなし）
 * ブラウザの印刷機能を使用
 */
export function exportToPDFSimple(data: TournamentResults) {
    if (typeof window === 'undefined') {
        throw new Error('PDF export is only available on the client side');
    }

    // HTMLコンテンツを生成
    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>${data.tournament} - 試合結果</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                }
                h1 {
                    text-align: center;
                    margin-bottom: 10px;
                }
                h2 {
                    text-align: center;
                    color: #666;
                    margin-bottom: 30px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }
                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                }
                th {
                    background-color: #f2f2f2;
                    font-weight: bold;
                }
                tr:nth-child(even) {
                    background-color: #f9f9f9;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                }
            </style>
        </head>
        <body>
            <h1>${data.tournament}</h1>
            <h2>試合結果一覧</h2>
            <table>
                <thead>
                    <tr>
                        <th>ラウンド</th>
                        <th>チームA</th>
                        <th>スコア</th>
                        <th>チームB</th>
                        <th>コート</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.results
                        .map(
                            (result) => `
                        <tr>
                            <td>${result.round_name}</td>
                            <td>${result.teamA}</td>
                            <td>${result.scoreA} - ${result.scoreB}</td>
                            <td>${result.teamB}</td>
                            <td>${result.court_number || '-'}</td>
                        </tr>
                    `
                        )
                        .join('')}
                </tbody>
            </table>
            <p style="text-align: center; margin-top: 30px; color: #666;">
                生成日時: ${new Date().toLocaleString('ja-JP')}
            </p>
        </body>
        </html>
    `;

    // 新しいウィンドウで開いて印刷
    const printWindow = window.open('', '_blank');
    if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.onload = () => {
            printWindow.print();
        };
    }
}

