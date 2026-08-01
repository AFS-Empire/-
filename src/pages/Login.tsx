import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, LogIn, User, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore(s => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(username, password);
    setLoading(false);
    if (res.success) {
      navigate(from, { replace: true });
    } else {
      setError(res.message);
    }
  };

  return (
    <div className="rune-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 标题区 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold-900/30 border border-gold-700 mb-4">
            <BookOpen size={28} className="text-gold-400" />
          </div>
          <h1 className="gold-title text-3xl font-bold mb-2">
            奥菲斯帝国档案馆
          </h1>
          <p className="text-ink-400 tracking-wide italic">帝国不需要所有人的理解</p>
          <p className="text-gold-500/70 text-sm tracking-widest mt-1">— 奥菲斯·龙岩</p>
        </div>

        {/* 卡片 */}
        <div className="panel-gold p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-text">用户名</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="input-field pl-9"
                  placeholder="请输入用户名"
                  autoComplete="username"
                />
              </div>
            </div>
            <div>
              <label className="label-text">密码</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="input-field pl-9"
                  placeholder="请输入密码"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-950/30 border border-red-900/50 rounded-lg px-3 py-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-gold w-full">
              <LogIn size={18} />
              {loading ? '登录中...' : '登 录'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-ink-500 mt-6 tracking-wide">
          数据存储于本地，无需联网
        </p>
      </div>
    </div>
  );
}
