import React, { useState, useRef, useEffect } from 'react';
import './QRMoments.scss';

const QRMomentsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio'>('photos');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Audio-specific states
  const [audioPermission, setAudioPermission] = useState<'unknown' | 'granted' | 'denied'>('unknown');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordingTimeLeft, setRecordingTimeLeft] = useState(60);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Helper Functions

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  

  // Replace with real event ID later
  const eventId = "wedding-ana-matei-11072026";

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

    setSelectedFiles(prev => [...prev, ...validFiles]);
    const newPreviews = validFiles.map(file => URL.createObjectURL(file));
    setPreviews(prev => [...prev, ...newPreviews]);
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));

    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  // ── Audio Recording & Playback ──────────────────────────────────────────────
  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setAudioPermission('granted');
    } catch (err) {
      console.error("Microphone permission denied:", err);
      setAudioPermission('denied');
    }
  };

  const startRecording = async () => {
    try {
      // Clean up previous audio
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
      setAudioBlob(null);
      setCurrentTime(0);
      setDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);

        const audioFile = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setSelectedFiles(prev => [...prev, audioFile]);
        setPreviews(prev => [...prev, url]);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTimeLeft(60);

      // Auto-stop after 60s
      const timer = setInterval(() => {
        setRecordingTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            stopRecording();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Failed to start recording:", err);
      setAudioPermission('denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(e => console.error("Playback error:", e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Update time & duration
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoaded = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoaded);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoaded);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [audioPreviewUrl]);

  // Permission check on tab switch
  useEffect(() => {
    if (activeTab !== 'audio') return;

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(status => {
        setAudioPermission(status.state as any);
        status.onchange = () => setAudioPermission(status.state as any);
      })
      .catch(() => setAudioPermission('unknown'));
  }, [activeTab]);

  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('eventId', eventId);
    formData.append('type', activeTab === 'photos' ? 'photo' : activeTab === 'videos' ? 'video' : 'audio');
+
    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/upload-qr-moment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setUploadMessage(`Success! ${result.uploadedCount} file(s) uploaded! 🎉`);

      previews.forEach(URL.revokeObjectURL);
      setSelectedFiles([]);
      setPreviews([]);
      setAudioBlob(null);
      setAudioPreviewUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (err) {
      setUploadMessage('Upload error. Please check your connection.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="qr-moments-page">
      {/* Header */}
      <header className="header">
        <h1 className="logo">QR Moments</h1>
        <p className="subtitle">Authentic moments captured by you</p>
        <h2 className="event-name">Ana & Matei Wedding • July 11, 2026</h2>
      </header>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
          onClick={() => setActiveTab('photos')}
        >
          <span className="tab-icon">📸</span>
          Photos
        </button>
        <button
          className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
          onClick={() => setActiveTab('videos')}
        >
          <span className="tab-icon">🎥</span>
          Videos
        </button>
        <button
          className={`tab ${activeTab === 'audio' ? 'active' : ''}`}
          onClick={() => setActiveTab('audio')}
        >
          <span className="tab-icon">🎤</span>
          Voice Message
        </button>
      </div>

      {/* Content */}
      <main className="content">
        {(activeTab === 'photos' || activeTab === 'videos') && (
          <section className="content-section fade-in">
            <h2>
              {activeTab === 'photos' ? 'Moments through your eyes ✨' : 'Capture the magic in motion 🎬'}
            </h2>
            <p className="info-text">
              {activeTab === 'photos'
                ? 'Select your photos, review them, and send to the couple!'
                : 'Choose short clips – max 60 seconds recommended'}
            </p>

            <button
              className="upload-btn"
              onClick={() => openFilePicker(activeTab === 'photos' ? 'image/*' : 'video/*')}
              disabled={uploading}
            >
              Choose {activeTab === 'photos' ? 'Photos' : 'Videos'}
            </button>

            {/* Preview gallery */}
            {previews.length > 0 && (
              <div className="preview-gallery">
                <h3>Selected Files ({previews.length})</h3>
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
                        aria-label="Remove file"
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
                  {uploading ? 'Uploading...' : `Send All (${selectedFiles.length})`}
                </button>
              </div>
            )}

            {uploadMessage && (
              <p className={uploadMessage.includes('Success') ? 'successMsg' : 'errorMsg'}>
                {uploadMessage}
              </p>
            )}
          </section>
        )}

        {activeTab === 'audio' && (
          <section className="content-section fade-in">
            <h2>Speak from the heart 💌</h2>
            <p className="info-text">
              Record a beautiful voice message for the couple (max 60 seconds)
            </p>

            {audioPermission === 'unknown' && (
              <div className="permission-check">
                <p>We need microphone access to record your message.</p>
                <button className="permission-btn" onClick={requestMicPermission}>
                  Allow Microphone Access
                </button>
              </div>
            )}

            {audioPermission === 'denied' && (
              <div className="permission-denied">
                <p>Microphone access is blocked.</p>
                <p>Please enable it in your browser settings.</p>
                <button className="permission-btn retry" onClick={requestMicPermission}>
                  Try Again
                </button>
              </div>
            )}

            {audioPermission === 'granted' && !isRecording && !audioBlob && (
              <button className="record-btn" onClick={startRecording}>
                Start Recording
              </button>
            )}

            {isRecording && (
              <div className="recording-active">
                <div className="waveform-wrapper">
                  <div className="waveform"></div>
                </div>
                <div className="recording-timer">
                  {recordingTimeLeft.toString().padStart(2, '0')} seconds left
                </div>
                <button className="stop-btn" onClick={stopRecording}>
                  Stop & Preview
                </button>
              </div>
            )}

            {audioBlob && audioPreviewUrl && (
              <div className="audio-preview">
                <h3>Voice Message Preview</h3>

                {/* WhatsApp-style waveform container */}
                <div className="waveform-container">
                  <div className="waveform-wrapper">
                    <div className="waveform"></div>
                    <div
                      className="waveform-progress"
                      style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                    ></div>
                  </div>

                  <div className="audio-controls">
                    <button className={`play-pause-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlayPause}>
                      {isPlaying ? '❚❚' : '▶'}
                    </button>
                    <span className="duration">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>
                  </div>
                </div>

                <button
                  className="clear-audio-btn"
                  onClick={() => {
                    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
                    setAudioBlob(null);
                    setAudioPreviewUrl(null);
                    setSelectedFiles([]);
                    setPreviews([]);
                    setIsPlaying(false);
                    setCurrentTime(0);
                    setDuration(0);
                  }}
                >
                  Delete and Record Again
                </button>
              </div>
            )}

            {selectedFiles.length > 0 && (
              <button
                className="upload-all-btn"
                onClick={handleUploadAll}
                disabled={uploading}
              >
                {uploading ? 'Sending...' : 'Send Voice Message'}
              </button>
            )}

            {uploadMessage && (
              <p className={uploadMessage.includes('Success') ? 'successMsg' : 'errorMsg'}>
                {uploadMessage}
              </p>
            )}
          </section>
        )}
      </main>

      <footer className="footer">
        Created with love by <strong>Anca Visuals</strong>
      </footer>

      {/* Hidden audio element for playback */}
      {audioPreviewUrl && (
        <audio
          ref={audioRef}
          src={audioPreviewUrl}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onEnded={() => setIsPlaying(false)}
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
};

export default QRMomentsPage;