import { useState, useCallback } from 'react';
import { login } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password.trim()) {
        setError('请输入密码');
        return;
      }

      setLoading(true);
      setError('');

      try {
        await login(password);
        onLoginSuccess();
      } catch (err: any) {
        setError(err.message || '登录失败，请重试');
        setLoading(false);
      }
    },
    [password, onLoginSuccess],
  );

  return (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Subtle animated background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#e74c3c]/[0.03] blur-[120px]" />
        <div className="absolute top-1/4 left-1/4 w-[300px] h-[300px] rounded-full bg-[#e74c3c]/[0.02] blur-[80px] animate-pulse" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-[#e74c3c]">Sub</span>
            <span className="text-[#e0e0e0]">Learn</span>
          </h1>
          <p className="mt-2 text-sm text-[#666]">沉浸式字幕学习平台</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#181818] border border-[#2a2a2a] rounded-2xl p-8 shadow-2xl shadow-black/40">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Password Field */}
            <div>
              <label className="block text-sm text-[#888] mb-2">密码</label>
              <input
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                placeholder="请输入访问密码"
                disabled={loading}
                autoFocus
                className="w-full bg-[#0f0f0f] border border-[#333] rounded-xl px-4 py-3.5 text-[#e0e0e0] placeholder-[#555] focus:border-[#e74c3c] outline-none transition disabled:opacity-50 min-h-[48px] text-base"
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 p-3 bg-[#2a1515] border border-[#e74c3c]/30 rounded-xl animate-[shake_0.3s_ease-in-out]">
                <span className="text-[#e74c3c] shrink-0 text-sm">✕</span>
                <p className="text-sm text-[#e74c3c]">{error}</p>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#e74c3c] text-white font-semibold text-base hover:bg-[#c0392b] active:scale-[0.98] transition-all duration-150 min-h-[48px] disabled:opacity-60 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  验证中...
                </span>
              ) : (
                '进入'
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center mt-8 text-xs text-[#444]">
          SubLearn · 安全访问
        </p>
      </div>
    </div>
  );
}
