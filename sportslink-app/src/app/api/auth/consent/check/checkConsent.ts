import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getConsentVersions } from '@/lib/consent-versions';

// GET /api/auth/consent/check - 規約同意状況チェック
export async function checkConsent(request: Request) {
    try {
        const supabase = await createClient();

        // 現在のユーザーを取得
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: '認証が必要です', code: 'E-AUTH-001' },
                { status: 401 }
            );
        }

        // ユーザーの最新の同意ログを取得
        const { data: consents, error: consentError } = await supabase
            .from('user_consents')
            .select('*')
            .eq('user_id', user.id)
            .order('agreed_at', { ascending: false });

        if (consentError) {
            console.error('Get consents error:', consentError);
            return NextResponse.json(
                { error: '同意状況の取得に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        // 最新の同意を確認
        const versions = getConsentVersions();
        const latestTermsConsent = consents?.find((c) => c.consent_type === 'terms');
        const latestPrivacyConsent = consents?.find((c) => c.consent_type === 'privacy');

        const needsReconsent = {
            terms: !latestTermsConsent || latestTermsConsent.version !== versions.terms,
            privacy: !latestPrivacyConsent || latestPrivacyConsent.version !== versions.privacy,
        };

        return NextResponse.json({
            needs_reconsent: needsReconsent.terms || needsReconsent.privacy,
            terms: {
                needs_reconsent: needsReconsent.terms,
                current_version: versions.terms,
                agreed_version: latestTermsConsent?.version || null,
            },
            privacy: {
                needs_reconsent: needsReconsent.privacy,
                current_version: versions.privacy,
                agreed_version: latestPrivacyConsent?.version || null,
            },
        });
    } catch (error) {
        console.error('Check consent error:', error);
        return NextResponse.json(
            { error: '同意状況の確認に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}
