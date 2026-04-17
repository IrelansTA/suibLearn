import { Routes, Route, useNavigate, useSearchParams } from 'react-router-dom';
import CollectionList from './components/CollectionList/CollectionList';
import CollectionDetail from './components/CollectionDetail/CollectionDetail';
import ContentLibrary from './components/ContentLibrary/ContentLibrary';
import LearningPage from './components/LearningPage/LearningPage';
import UploadForm from './components/UploadForm/UploadForm';

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
  return (
    <Routes>
      <Route path="/" element={<CollectionList />} />
      <Route path="/collection/:collectionId" element={<CollectionDetail />} />
      <Route path="/videos" element={<ContentLibrary />} />
      <Route path="/upload" element={<UploadPage />} />
      <Route path="/learn/:videoId" element={<LearningPage />} />
    </Routes>
  );
}
