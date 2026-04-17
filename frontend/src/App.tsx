import { Routes, Route } from 'react-router-dom';
import ContentLibrary from './components/ContentLibrary/ContentLibrary';
import LearningPage from './components/LearningPage/LearningPage';
import UploadForm from './components/UploadForm/UploadForm';
import { useNavigate } from 'react-router-dom';

function UploadPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-[#e0e0e0]">
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
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
          onSuccess={(videoId) => navigate(`/learn/${videoId}`)}
          onCancel={() => navigate('/')}
        />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ContentLibrary />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/learn/:videoId" element={<LearningPage />} />
    </Routes>
  );
}