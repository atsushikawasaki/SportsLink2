import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
});

export const signupSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    confirmPassword: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    displayName: z.string().min(1, '表示名を入力してください'),
    agreeTerms: z.boolean().refine((val) => val === true, {
        message: '利用規約とプライバシーポリシーに同意してください',
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('有効なメールアドレスを入力してください'),
});

export const resetPasswordSchema = z.object({
    password: z.string().min(6, 'パスワードは6文字以上で入力してください'),
    confirmPassword: z.string().min(6, 'パスワードは6文字以上で入力してください'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'パスワードが一致しません',
    path: ['confirmPassword'],
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
