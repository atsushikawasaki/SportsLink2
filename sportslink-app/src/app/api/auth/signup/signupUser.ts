import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getConsentVersions } from '@/lib/consent-versions';

export async function signupUser(request: Request) {
    try {
        const { email, password, displayName, agreeTerms } = await request.json();

        if (!email || !password || !displayName) {
            return NextResponse.json(
                { error: '必須項目を入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (!agreeTerms) {
            return NextResponse.json(
                { error: '利用規約とプライバシーポリシーに同意してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (password.length < 8) {
            return NextResponse.json(
                { error: 'パスワードは8文字以上で入力してください（NIST推奨）', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const supabase = await createClient();

        // Create auth user
        // Note: Database trigger (handle_new_user) will automatically create public.users record
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    display_name: displayName,
                },
            },
        });

        if (authError) {
            return NextResponse.json(
                { error: authError.message, code: 'E-AUTH-002' },
                { status: 400 }
            );
        }

        if (!authData.user) {
            return NextResponse.json(
                { error: 'ユーザー作成に失敗しました', code: 'E-AUTH-003' },
                { status: 500 }
            );
        }

        const adminClient = createAdminClient();
        const maxAttempts = 5;
        const baseDelayMs = 50;
        let userProfile: { id: string } | null = null;
        let profileError: { message: string } | null = null;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (attempt > 0) {
                await new Promise((r) => setTimeout(r, baseDelayMs * attempt));
            }
            const result = await adminClient
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();
            userProfile = result.data;
            profileError = result.error;
            if (userProfile) break;
        }

        if (profileError || !userProfile) {
            console.error('Profile creation error (trigger may have failed):', profileError);
            // Try to create manually as fallback
            const passwordHash = await bcrypt.hash(password, 10);
            const { data: fallbackProfile, error: fallbackError } = await adminClient
            .from('users')
            .insert({
                id: authData.user.id,
                email,
                display_name: displayName,
                password_hash: passwordHash,
            } as unknown as never)
            .select()
            .single();

            if (fallbackError) {
            return NextResponse.json(
                { error: 'プロフィール作成に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
            }

            // Update password_hash for fallback profile
            const { data: updatedFallbackProfile } = await adminClient
                .from('users')
                .update({ password_hash: passwordHash })
                .eq('id', authData.user.id)
                .select()
                .single();

            // Record consent logs
            const requestHeaders = request.headers;
            const ipAddress = requestHeaders.get('x-forwarded-for') || requestHeaders.get('x-real-ip') || 'unknown';
            const userAgent = requestHeaders.get('user-agent') || 'unknown';
            const versions = getConsentVersions();

            const { error: consentError } = await adminClient
                .from('user_consents')
                .insert([
                    {
                        user_id: authData.user.id,
                        consent_type: 'terms',
                        version: versions.terms,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    },
                    {
                        user_id: authData.user.id,
                        consent_type: 'privacy',
                        version: versions.privacy,
                        ip_address: ipAddress,
                        user_agent: userAgent,
                    },
                ] as unknown as never[]);

            if (consentError) {
                console.error('Consent log error:', consentError);
            }

            return NextResponse.json({
                user: updatedFallbackProfile || fallbackProfile,
                message: 'アカウントが作成されました',
            });
        }

        // Update password_hash (not handled by trigger)
        const passwordHash = await bcrypt.hash(password, 10);
        const { data: updatedProfile, error: updateError } = await adminClient
            .from('users')
            .update({
                password_hash: passwordHash,
            })
            .eq('id', authData.user.id)
            .select()
            .single();

        if (updateError) {
            console.error('Failed to update password_hash:', updateError);
            // Continue with profile from trigger (password_hash will be set later)
        }

        // Record consent logs (terms and privacy policy)
        const requestHeaders = request.headers;
        const ipAddress = requestHeaders.get('x-forwarded-for') || requestHeaders.get('x-real-ip') || 'unknown';
        const userAgent = requestHeaders.get('user-agent') || 'unknown';
        const versions = getConsentVersions();

        // Insert consent logs using admin client
        const { error: consentError } = await adminClient
            .from('user_consents')
            .insert([
                {
                    user_id: authData.user.id,
                    consent_type: 'terms',
                    version: versions.terms,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                },
                {
                    user_id: authData.user.id,
                    consent_type: 'privacy',
                    version: versions.privacy,
                    ip_address: ipAddress,
                    user_agent: userAgent,
                },
            ] as unknown as never[]);

        if (consentError) {
            console.error('Consent log error:', consentError);
            // Don't fail signup if consent logging fails, but log it
        }

        return NextResponse.json({
            user: updatedProfile || userProfile,
            message: 'アカウントが作成されました',
        });
    } catch (error) {
        console.error('Signup error:', error);
        return NextResponse.json(
            { error: 'サインアップに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

