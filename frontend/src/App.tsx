import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import CollectionList from './components/CollectionList/CollectionList';
import CollectionDetail from './components/CollectionDetail/CollectionDetail';
import ContentLibrary from './components/ContentLibrary/ContentLibrary';
import LearningPage from './components/LearningPage/LearningPage';
import UploadForm from './components/UploadForm/UploadForm';
import LoginPage from './components/LoginPage/LoginPage';
import { isLoggedIn, verifyToken, logout as apiLogout, setOnUnauthorized } from './services/api';

function UploadPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const collectionId = searchParams.get('collection') || undefined;

  const handleBack = () => {
    if (collectionId) {
      navigate(`/collection/${collectionId}`);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="p-2 rounded-lg hover:bg-[#2a2a2a] transition min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ←
          </button>
          <h1 className="text-xl font-bold">
            <span className="text-[#e74c3c]">Sub</span>Learn
            <span className="text-xs text-[#555] ml-1.5 font-normal">v0.2.0</span>
          </h1>
        </div>
        <span className="text-sm text-[#a0a0a0]">上传视频</span>
      </header>
      <div className="flex items-center justify-center min-h-[calc(100vh-60px)] px-4 py-8">
        <UploadForm
          collectionId={collectionId}
          onSuccess={(videoId) => navigate(`/learn/${videoId}`)}
          onCancel={handleBack}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!isLoggedIn()) {
        if (!cancelled) {
          setAuthenticated(false);
          setAuthChecked(true);
        }
        return;
      }

      const valid = await verifyToken();
      if (!cancelled) {
        setAuthenticated(valid);
        setAuthChecked(true);
      }
    }

    checkAuth();
    return () => { cancelled = true; };
  }, []);

  // Register global 401 handler to force logout
  useEffect(() => {
    setOnUnauthorized(() => {
      setAuthenticated(false);
    });
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setAuthenticated(true);
  }, []);

  const handleLogout = useCallback(() => {
    apiLogout();
    setAuthenticated(false);
  }, []);

  // Show a minimal loading state while verifying token
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#e74c3c] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[#888]">验证中...</span>
        </div>
      </div>
    );
  }

  // Not authenticated → show login
  if (!authenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Authenticated → normal routes
  return (
    <Routes>
      <Route path="/" element={<CollectionList onLogout={handleLogout} />} />
      <Route path="/collection/:collectionId" element={<CollectionDetail />} />
      <Route path="/videos" element={<ContentLibrary />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/learn/:videoId" element={<LearningPage />} />
    </Routes>
  );
}