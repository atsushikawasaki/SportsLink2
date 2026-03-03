import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom の依存（tough-cookie/psl）が Node.js 22 ビルトイン punycode を触ることで出る
// DEP0040 を抑制（ユーザーランド実装への移行は jsdom 側の責務）
const _originalEmit = process.emit.bind(process);
process.emit = function (event: string, ...args: unknown[]) {
    if (
        event === 'warning' &&
        args[0] instanceof Error &&
        (args[0] as NodeJS.ErrnoException).code === 'DEP0040'
    ) {
        return false;
    }
    return _originalEmit(event, ...args as Parameters<typeof process.emit>);
} as typeof process.emit;

// 各テスト後にクリーンアップ
afterEach(() => {
  cleanup();
});

// グローバルマッチャーの拡張
expect.extend({});

