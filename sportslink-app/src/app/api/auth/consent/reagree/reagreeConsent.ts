import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { getConsentVersions } from '@/lib/consent-versions';

// POST /api/auth/consent/reagree - 規約再同意
export async function reagreeConsent(request: Request) {
    try {
        const body = await request.json();
        const { agree_terms, agree_privacy } = body;

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

        // public.usersにユーザーが存在することを確認
        // トリガーが動作していない場合に備えて、存在しない場合は作成
        const adminClient = createAdminClient();
        const { data: userProfile, error: profileError } = await adminClient
            .from('users')
            .select('id')
            .eq('id', user.id)
            .single();

        if (profileError || !userProfile) {
            // public.usersにユーザーが存在しない場合、作成する
            // トリガーが動作していない可能性があるため、手動で作成
            console.warn('User profile not found by ID, checking by email:', {
                userId: user.id,
                email: user.email,
                profileError: profileError,
            });

            // まず、メールアドレスで既存のユーザーを検索
            const { data: existingUserByEmail, error: emailSearchError } = await adminClient
                .from('users')
                .select('id, email')
                .eq('email', user.email || '')
                .single();

            if (existingUserByEmail && existingUserByEmail.id !== user.id) {
                // 同じメールアドレスで異なるIDのユーザーが存在する場合
                // ID不一致を修正する関数を呼び出す
                console.warn('User exists with same email but different ID, fixing mismatch:', {
                    existingId: existingUserByEmail.id,
                    authId: user.id,
                    email: user.email,
                });

                try {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: fixResult, error: fixError } = await (adminClient as any)
                        .rpc('fix_single_user_id_mismatch', {
                            user_email: user.email || '',
                        });

                    if (fixError) {
                        console.error('Failed to fix user ID mismatch:', fixError);
                        return NextResponse.json(
                            { 
                                error: 'ユーザーIDの修正に失敗しました', 
                                code: 'E-DB-002',
                                details: process.env.NODE_ENV === 'development' ? {
                                    message: fixError.message,
                                    code: fixError.code,
                                } : undefined,
                            },
                            { status: 500 }
                        );
                    }

                    console.log('Fixed user ID mismatch:', fixResult);
                    // 修正後、再度ユーザープロファイルを取得
                    const { data: fixedProfile, error: fixedError } = await adminClient
                        .from('users')
                        .select('id')
                        .eq('id', user.id)
                        .single();

                    if (fixedError || !fixedProfile) {
                        console.error('User profile still not found after fix:', fixedError);
                        return NextResponse.json(
                            { 
                                error: 'ユーザープロファイルの取得に失敗しました', 
                                code: 'E-DB-001',
                            },
                            { status: 500 }
                        );
                    }

                    console.log('User profile found after ID fix');
                    // 成功したので続行
                } catch (fixError) {
                    console.error('Error fixing user ID mismatch:', fixError);
                    return NextResponse.json(
                        { 
                            error: 'ユーザーIDの修正中にエラーが発生しました', 
                            code: 'E-DB-002',
                        },
                        { status: 500 }
                    );
                }
            } else if (!existingUserByEmail) {
                // メールアドレスでも見つからない場合、新規作成
                console.log('User not found by email, creating new profile');

                // sync_existing_auth_users RPC関数を試す（より安全）
                try {
                    const { data: syncResult, error: syncError } = await adminClient.rpc('sync_existing_auth_users');
                    
                    if (!syncError && syncResult > 0) {
                        console.log('Synced users via RPC:', syncResult);
                        // 再度ユーザープロファイルを取得
                        const { data: syncedProfile, error: syncedError } = await adminClient
                            .from('users')
                            .select('id')
                            .eq('id', user.id)
                            .single();
                        
                        if (!syncedError && syncedProfile) {
                            console.log('User profile found after sync');
                            // 成功したので続行
                        } else {
                            // RPCで同期できなかった場合、手動で作成を試みる
                            throw new Error('RPC sync did not create user profile');
                        }
                    } else if (syncError) {
                        console.warn('RPC sync failed, falling back to manual creation:', syncError);
                        // RPCが失敗した場合、手動で作成を試みる
                        throw syncError;
                    } else {
                        // 同期するユーザーがなかった場合、手動で作成を試みる
                        throw new Error('No users to sync');
                    }
                } catch (syncError) {
                    // RPCが失敗した場合、手動で作成を試みる
                    console.warn('RPC sync failed, attempting manual creation:', syncError);
                    
                    // 新規作成
                    const { data: createdProfile, error: createError } = await adminClient
                        .from('users')
                        .insert({
                            id: user.id,
                            email: user.email || '',
                            display_name: user.user_metadata?.display_name || '',
                        } as unknown as never)
                        .select()
                        .single();

                    if (createError) {
                        console.error('Failed to create user profile for consent:', {
                            error: createError,
                            code: createError.code,
                            message: createError.message,
                            details: createError.details,
                            hint: createError.hint,
                            userId: user.id,
                            email: user.email,
                        });
                        
                        // より詳細なエラーメッセージを返す
                        const errorMessage = process.env.NODE_ENV === 'development' 
                            ? `ユーザープロファイルの作成に失敗しました: ${createError.message} (Code: ${createError.code})`
                            : 'ユーザープロファイルの作成に失敗しました';
                        
                        return NextResponse.json(
                            { 
                                error: errorMessage, 
                                code: 'E-DB-001',
                                details: process.env.NODE_ENV === 'development' ? {
                                    message: createError.message,
                                    code: createError.code,
                                    details: createError.details,
                                    hint: createError.hint,
                                } : undefined,
                            },
                            { status: 500 }
                        );
                    }

                    console.log('Successfully created user profile:', {
                        userId: createdProfile?.id,
                        email: createdProfile?.email,
                    });
                }
            } else {
                // 既に存在している場合（IDが一致している）
                console.log('User profile already exists');
            }
        }

        const requestHeaders = request.headers;
        const ipAddress = requestHeaders.get('x-forwarded-for') || requestHeaders.get('x-real-ip') || 'unknown';
        const userAgent = requestHeaders.get('user-agent') || 'unknown';
        const versions = getConsentVersions();

        const consentsToInsert: any[] = [];

        if (agree_terms) {
            consentsToInsert.push({
                user_id: user.id,
                consent_type: 'terms',
                version: versions.terms,
                ip_address: ipAddress,
                user_agent: userAgent,
            });
        }

        if (agree_privacy) {
            consentsToInsert.push({
                user_id: user.id,
                consent_type: 'privacy',
                version: versions.privacy,
                ip_address: ipAddress,
                user_agent: userAgent,
            });
        }

        if (consentsToInsert.length === 0) {
            return NextResponse.json(
                { error: '同意が必要です', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        const { error: consentError } = await supabase
            .from('user_consents')
            .insert(consentsToInsert as never[]);

        if (consentError) {
            console.error('Re-consent error:', consentError);
            return NextResponse.json(
                { error: '再同意の記録に失敗しました', code: 'E-DB-001' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            message: '再同意を記録しました',
        });
    } catch (error) {
        console.error('Re-consent error:', error);
        return NextResponse.json(
            { error: '再同意の処理に失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

