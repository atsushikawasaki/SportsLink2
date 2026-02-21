import { checkRateLimit } from '@/lib/rateLimit';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { Database } from '@/types/database.types';

type User = Database['public']['Tables']['users']['Row'];

export async function loginUser(request: Request) {
    try {
        const { allowed, retryAfter } = checkRateLimit(request, 'login');
        if (!allowed) {
            return NextResponse.json(
                { error: 'ログイン試行が多すぎます。しばらく経ってからお試しください。', code: 'E-RATE-001' },
                { status: 429, headers: retryAfter ? { 'Retry-After': String(retryAfter) } : undefined }
            );
        }

        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: 'メールアドレスとパスワードを入力してください', code: 'E-VER-003' },
                { status: 400 }
            );
        }

        if (process.env.NODE_ENV === 'development') {
            console.log('Login attempt:', { email: email, hasPassword: !!password });
        }

        const supabase = await createClient();

        // Supabase環境変数の確認（開発環境のみ）
        if (process.env.NODE_ENV === 'development') {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
            console.log('Supabase config check:', {
                hasUrl: !!supabaseUrl,
                url: supabaseUrl?.substring(0, 30) + '...',
                hasAnonKey: hasAnonKey,
            });
        }

        // メール確認をスキップする設定（開発環境のみ）
        const signInOptions: { email: string; password: string; options?: { captchaToken?: string } } = {
            email: email.trim().toLowerCase(),
            password,
        };

        const { data, error } = await supabase.auth.signInWithPassword(signInOptions);

        // Supabase Authでのログインが失敗した場合のフォールバック処理
        // Note: Database trigger (handle_new_user) が有効な場合、この処理は通常不要です
        // 既存データとの互換性のために残しています
        if (error) {
            const normalizedEmail = email.trim().toLowerCase();
            
            // public.usersテーブルからユーザーを検索
            const adminClient = createAdminClient();
            const { data: userProfileData, error: userError } = await adminClient
                .from('users')
                .select('*')
                .eq('email', normalizedEmail)
                .single();
            
            const userProfile = userProfileData as User | null;

            if (userError || !userProfile) {
                console.error('User not found in users table:', {
                    email: normalizedEmail,
                    error: userError,
            });
                
            return NextResponse.json(
                { 
                        error: 'メールアドレスまたはパスワードが正しくありません', 
                    code: 'E-AUTH-001',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                },
                { status: 401 }
            );
            }

            // password_hashが存在する場合、bcryptでパスワードを検証
            if (!userProfile.password_hash) {
                console.error('User has no password_hash:', {
                    userId: userProfile.id,
                    email: normalizedEmail,
                });
                
                return NextResponse.json(
                    { 
                        error: 'パスワードが設定されていません。パスワードリセットを行ってください。', 
                        code: 'E-AUTH-001',
                    },
                    { status: 401 }
                );
            }

            const isValidPassword = await bcrypt.compare(password, userProfile.password_hash);

            if (!isValidPassword) {
                console.error('Invalid password for user:', {
                    userId: userProfile.id,
                    email: normalizedEmail,
                });
                
                return NextResponse.json(
                    { 
                        error: 'メールアドレスまたはパスワードが正しくありません', 
                        code: 'E-AUTH-001',
                    },
                    { status: 401 }
                );
            }

            // パスワード検証が成功した場合、Supabase Authにユーザーが存在するか確認
            // 存在しない場合は作成する
            const { data: authUsers } = await adminClient.auth.admin.listUsers();
            let authUser = authUsers?.users?.find((u) => u.email?.toLowerCase() === normalizedEmail);

            if (!authUser) {
                // Supabase Authにユーザーを作成（既存のusersテーブルのIDを使用）
                // 注意: Supabase Authは自動的にUUIDを生成するため、作成後にIDを同期する必要がある
                // ユーザーが入力したパスワードを使用（既に検証済み）
                const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
                    email: normalizedEmail,
                    email_confirm: true, // メール確認をスキップ
                    password: password, // ユーザーが入力したパスワードを使用（既に検証済み）
                    user_metadata: {
                        display_name: userProfile.display_name,
                    },
                });

                if (createError || !newAuthUser.user) {
                    console.error('Failed to create auth user:', {
                        error: createError,
                        email: normalizedEmail,
                        errorMessage: createError?.message,
                        errorStatus: createError?.status,
                        errorName: createError?.name,
                    });
                    
                    // エラーの詳細を返す（開発環境のみ）
                    const errorDetails = process.env.NODE_ENV === 'development' 
                        ? {
                            message: createError?.message,
                            status: createError?.status,
                            name: createError?.name,
                        }
                        : undefined;
                    
                    return NextResponse.json(
                        { 
                            error: '認証ユーザーの作成に失敗しました', 
                            code: 'E-AUTH-003',
                            details: errorDetails,
                        },
                        { status: 500 }
                    );
                }

                authUser = newAuthUser.user;
                
                // usersテーブルのIDをSupabase AuthのIDに更新
                // データベース関数を使用して、関連テーブルも含めて一括更新
                if (userProfile.id !== authUser.id) {
                    const oldUserId = userProfile.id;
                    
                    // データベース関数を使用してID不一致を修正（関連テーブルも自動更新）
                    type FixResult = {
                        result_status?: string;
                        result_affected_tables?: string[];
                    };
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { data: fixResult, error: fixError } = await (adminClient as any)
                        .rpc('fix_single_user_id_mismatch', {
                            user_email: normalizedEmail,
                        });
                    
                    if (fixError) {
                        console.error('Failed to fix user ID mismatch:', fixError);
                        // ID更新に失敗した場合でも続行（外部キー制約の問題がある可能性）
                    } else if (fixResult) {
                        userProfile.id = authUser.id;
                        const result: FixResult = Array.isArray(fixResult) && fixResult.length > 0 
                            ? (fixResult[0] as FixResult)
                            : (fixResult as FixResult);
                        console.log('Fixed user ID mismatch:', {
                            oldId: oldUserId,
                            newId: authUser.id,
                            affectedTables: result?.result_affected_tables,
                            status: result?.result_status,
                        });
                    } else {
                        // 関数が結果を返さない場合（既に一致している、またはエラー）
                        // 念のため、userProfileのIDを更新
                        userProfile.id = authUser.id;
                        console.log('User ID already matches or fix function returned no result');
                    }
                }

                console.log('Created auth user for existing user:', {
                    userId: authUser.id,
                    email: normalizedEmail,
                });
                
                // 新規作成した場合は、そのパスワードで直接ログインを試みる
                const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });

                if (retryError || !retryData.session) {
                    console.error('Failed to create session after user creation:', retryError);
                    return NextResponse.json(
                        { 
                            error: 'セッションの作成に失敗しました', 
                            code: 'E-AUTH-002',
                            details: process.env.NODE_ENV === 'development' ? retryError?.message : undefined,
                        },
                        { status: 500 }
                    );
                }

                // 成功した場合、通常のフローに戻る
                return NextResponse.json({
                    user: userProfile,
                    session: {
                        access_token: retryData.session.access_token,
                        refresh_token: retryData.session.refresh_token,
                        expires_at: retryData.session.expires_at,
                    },
                });
            } else {
                // 既存のauthユーザーが見つかった場合、IDの整合性を確認
                if (userProfile.id !== authUser.id) {
                    console.warn('User ID mismatch:', {
                        usersTableId: userProfile.id,
                        authUserId: authUser.id,
                        email: normalizedEmail,
                    });
                    
                    // usersテーブルのIDをSupabase AuthのIDに更新
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const { error: updateError } = await (adminClient as any)
                        .from('users')
                        .update({ id: authUser.id })
                        .eq('id', userProfile.id);
                    
                    if (!updateError) {
                        userProfile.id = authUser.id;
                    }
                }

                // 既存のauthユーザーのパスワードを更新
                try {
                    const { error: updatePasswordError } = await adminClient.auth.admin.updateUserById(authUser.id, {
                        password: password,
                    });
                    
                    if (updatePasswordError) {
                        console.error('Failed to update password:', updatePasswordError);
                        // パスワード更新に失敗した場合でも、既存のパスワードでログインを試みる
                    }
                } catch (updateError) {
                    console.error('Password update error:', updateError);
                }

                // 通常のクライアントで再度ログインを試みる
                const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                    email: normalizedEmail,
                    password,
                });

                if (retryError || !retryData.session) {
                    console.error('Failed to create session after password update:', retryError);
                    return NextResponse.json(
                        { 
                            error: 'セッションの作成に失敗しました', 
                            code: 'E-AUTH-002',
                            details: process.env.NODE_ENV === 'development' ? retryError?.message : undefined,
                        },
                        { status: 500 }
                    );
                }

                // 成功した場合、通常のフローに戻る
                return NextResponse.json({
                    user: userProfile,
                    session: {
                        access_token: retryData.session.access_token,
                        refresh_token: retryData.session.refresh_token,
                        expires_at: retryData.session.expires_at,
                    },
                });
            }
        }

        // Get user profile from users table
        // Admin Clientを使用してRLSをバイパス（ログイン直後はauth.uid()が正しく設定されていない可能性があるため）
        const adminClient = createAdminClient();
        const { data: userProfile, error: profileError } = await adminClient
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('User profile fetch error:', profileError);
            // プロファイルが存在しない場合でも、認証は成功しているので続行
            // ただし、ユーザープロファイルがない場合は警告をログに記録
            if (process.env.NODE_ENV === 'development') {
                console.warn('User profile not found for user:', data.user.id);
            }
        }

        if (!data.session) {
            console.error('No session returned from Supabase');
            return NextResponse.json(
                { error: 'セッションの作成に失敗しました', code: 'E-AUTH-002' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            user: userProfile || {
                id: data.user.id,
                email: data.user.email,
                created_at: data.user.created_at,
            },
            session: {
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                expires_at: data.session.expires_at,
            },
        });
    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            { error: 'ログインに失敗しました', code: 'E-SERVER-001' },
            { status: 500 }
        );
    }
}

