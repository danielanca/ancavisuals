import React, { useState } from 'react';
import './QRMoments.scss';

const QRMomentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio'>('photos');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Înlocuiește cu modul real (ex: useParams, context, query params)
  const eventId = "nunta-ana-matei-11072026"; // Exemplu temporar

  const openFilePicker = (accept: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = accept;
    input.onchange = (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files) {
        handleFilesSelected(target.files);
      }
    };
    input.click();
  };

  const handleFilesSelected = (files: FileList) => {
    const newFiles = Array.from(files);
    const validFiles = newFiles.filter(file => {
      if (activeTab === 'photos' && !file.type.startsWith('image/')) return false;
      if (activeTab === 'videos' && !file.type.startsWith('video/')) return false;
      return true;
    });

    // Adaugă la lista existentă
    setSelectedFiles(prev => [...prev, ...validFiles]);

    // Generează preview-uri
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));

    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]); // Curăță memoria
      return prev.filter((_, i) => i !== index);
    });
  };

 const handleUploadAll = async () => {
  if (selectedFiles.length === 0) return;

  setUploading(true);
  setUploadMessage(null);

  const formData = new FormData();
  formData.append('eventId', eventId);
  formData.append('type', activeTab === 'photos' ? 'photo' : 'video');

  selectedFiles.forEach(file => formData.append('files', file));

  try {
    const response = await fetch('/api/upload-qr-moment', {  // ← ruta ta Express
      method: 'POST',
      body: formData,
    });

    if (!response.ok) throw new Error('Eroare');

    const result = await response.json();
    setUploadMessage(`Succes! ${result.uploadedCount} fișier(e) încărcat(e) pe Bunny! 🎉`);

    // Curăță preview-urile
    previews.forEach(URL.revokeObjectURL);
    setSelectedFiles([]);
    setPreviews([]);
  } catch (err) {
    setUploadMessage('Eroare upload. Verifică conexiunea.');
  } finally {
    setUploading(false);
  }
};

  return (
    <div className="qr-moments-page">
      {/* Header */}
      <header className="header">
        <h1 className="logo">QR Moments</h1>
        <p className="subtitle">Momente autentice, surprinse de voi</p>
        <h2 className="event-name">Nunta Ana & Matei • 11 Iulie 2026</h2>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <span className="tab-icon">📸</span>
          Poze
        </button>
        <button
          className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          <span className="tab-icon">🎥</span>
          Video
        </button>
        <button
          className={`tab ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          <span className="tab-icon">🎤</span>
          Mesaj
        </button>
      </div>

      {/* Content */}
      <main className="content">
        {(activeTab === 'photos' || activeTab === 'videos') && (
          <section className="content-section fade-in">
            <h2>
              {activeTab === 'photos' ? 'Momentele prin ochii voștri ✨' : 'Prinde magia în mișcare 🎬'}
            </h2>
            <p className="info-text">
              {activeTab === 'photos'
                ? 'Selectează pozele, verifică-le și trimite-le mirilor!'
                : 'Alege clipuri scurte – max 60 sec recomandat'}
            </p>

            <button
              className="upload-btn"
              onClick={() => openFilePicker(activeTab === 'photos' ? 'image/*' : 'video/*')}
              disabled={uploading}
            >
              Alege {activeTab === 'photos' ? 'Poze' : 'Video-uri'}
            </button>

            {/* Preview galerie */}
            {previews.length > 0 && (
              <div className="preview-gallery">
                <h3>Fișiere selectate ({previews.length})</h3>
                <div className="preview-grid">
                  {previews.map((previewUrl, index) => (
                    <div key={index} className="preview-item">
                      {selectedFiles[index]?.type.startsWith('image/') ? (
                        <img src={previewUrl} alt="preview" className="preview-img" />
                      ) : (
                        <video src={previewUrl} className="preview-img" controls muted />
                      )}
                      <button
                        className="remove-btn"
                        onClick={() => removeFile(index)}
                        aria-label="Elimină fișier"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  className="upload-all-btn"
                  onClick={handleUploadAll}
                  disabled={uploading || selectedFiles.length === 0}
                >
                  {uploading ? 'Se încarcă...' : `Trimite toate (${selectedFiles.length})`}
                </button>
              </div>
            )}

            {uploadMessage && (
              <p className={uploadMessage.includes('Succes') ? 'successMsg' : 'errorMsg'}>
                {uploadMessage}
              </p>
            )}
          </section>
        )}

        {activeTab === 'audio' && (
          <section className="content-section">
            <h2>Vorbește-le din suflet 💌</h2>
            <p className="info-text">Funcționalitate în dezvoltare – în curând!</p>
          </section>
        )}
      </main>

      <footer className="footer">
        Creat cu drag de <strong>Anca Visuals</strong>
      </footer>
    </div>
  );
};

export default QRMomentsPage;