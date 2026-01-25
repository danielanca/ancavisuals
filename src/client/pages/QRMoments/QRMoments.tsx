import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // ← Added this import
import './QRMoments.scss';

// Wizard component (embedded here for simplicity – you can move to separate file)
const QRWizard = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Bine ai venit la QR Moments!",
      content: "Aici poți încărca poze, clipuri și mesaje vocale pentru miri. Tot ce surprindeți voi devine parte din povestea nunții!",
      icon: "✨"
    },
    {
      title: "Cum funcționează?",
      content: "Alege tipul de conținut (Poze, Video sau Mesaj), apoi apasă butonul mare pentru a selecta fișierele de pe telefon sau cameră.",
      icon: "📱"
    },
    {
      title: "Pentru mesaje vocale",
      content: "Permite accesul la microfon, apasă „Începe înregistrarea”, vorbește din inimă (max 60 sec), apoi „Stop & Preview” și „Trimite mesajul”!",
      icon: "🎤"
    },
    {
      title: "Gata de trimis!",
      content: "După ce ai selectat tot, apasă „Trimite toate” — fișierele ajung instant la miri. Ei vor fi emoționați să vadă ce ați surprins!",
      icon: "❤️"
    }
  ];

  return (
    <div className="qr-wizard-overlay">
      <div className="qr-wizard-modal">
        <button className="wizard-close" onClick={onClose}>×</button>

        <div className="wizard-icon">{steps[step].icon}</div>
        <h2 className="wizard-title">{steps[step].title}</h2>
        <p className="wizard-text">{steps[step].content}</p>

        <div className="wizard-progress">
          {steps.map((_, i) => (
            <div key={i} className={`dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="wizard-buttons">
          <button className="wizard-skip" onClick={onClose}>
            Sari peste
          </button>
          <button className="wizard-next" onClick={() => {
            if (step < steps.length - 1) setStep(step + 1);
            else onClose();
          }}>
            {step === steps.length - 1 ? 'Începe acum' : 'Următorul'}
          </button>
        </div>
      </div>
    </div>
  );
};

const QRMomentsPage: React.FC = () => {
  const [eventInfo, setEventInfo] = useState<any | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const { eventDate } = useParams<{ eventDate: string }>(); // ← Get eventDate from URL
  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio'>('photos');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);

  // Audio-specific states
  const [audioPermission, setAudioPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
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
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null); // for recording waveform
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null); // for preview waveform
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);

  const navigate = useNavigate(); // ← This creates the navigate function
  //const apiKey = process.env.BUNNY_STORAGE_KEY!;

  // Wizard state
  const [showWizard, setShowWizard] = useState(() => {
    return localStorage.getItem('qr-moments-wizard-seen') !== 'true';
  });

// First check DB to see if this is first visit
useEffect(() => {
  const checkDBForFirstVisit = async () => {
    try {
      const response = await fetch(`/api/urlcheck/${eventDate}`, {
        method: "GET",
      });

      if (response.ok) {
        const data = await response.json();
        setFirstVisit(data.urlFound); 
        setEventInfo(data.data);
      }
    } catch (err) {
      console.error("Failed to check first visit:", err);
      setFirstVisit(false); // fallback
    }
  };

  checkDBForFirstVisit();
}, [eventDate]);

// Helper Functions
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Replace with real event ID later
  const eventId = eventDate;

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
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
      setAudioBlob(null);
      setCurrentTime(0);
      setDuration(0);
      audioChunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048; // larger for smoother wave
      source.connect(analyser);
      analyserRef.current = analyser;

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

        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTimeLeft(60);

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
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
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

// Start drawing waveform when canvas is ready (during recording or preview)
useEffect(() => {
  if ((isRecording && canvasRef.current) || (audioPreviewUrl && previewCanvasRef.current)) {
    drawWaveform();
  }
}, [isRecording, audioPreviewUrl]); // run when recording starts or preview appears

useEffect(() => {
  if (audioPreviewUrl && previewCanvasRef.current && isPlaying) {
    drawWaveform();
  }
}, [isPlaying]); // re-trigger on every play/pause
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

// Real-time waveform drawing (both during recording and preview)
const drawWaveform = () => {
  let canvas: HTMLCanvasElement | null = null;
  let analyser: AnalyserNode | null = analyserRef.current;
  let audioContext: AudioContext | null = null;

  if (isRecording) {
    canvas = canvasRef.current;
  } else if (audioPreviewUrl && previewCanvasRef.current && audioRef.current) {
    canvas = previewCanvasRef.current;

    // For preview: create analyser & source ONLY ONCE per new preview (fixes flat wave after delete/record again)
    if (!previewAnalyserRef.current) {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        previewAudioContextRef.current = audioContext;

        const source = audioContext.createMediaElementSource(audioRef.current);
        previewSourceRef.current = source;

        const newAnalyser = audioContext.createAnalyser();
        newAnalyser.fftSize = 2048;
        newAnalyser.smoothingTimeConstant = 0.85;
        source.connect(newAnalyser);
        source.connect(audioContext.destination); // ensure sound plays normally
        previewAnalyserRef.current = newAnalyser;

        analyser = newAnalyser;
      } catch (err) {
        console.error("Failed to create preview analyser:", err);
        return;
      }
    } else {
      analyser = previewAnalyserRef.current;
    }
  }

  if (!canvas || !analyser) {
    console.warn("Canvas or analyser not ready");
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn("Canvas context not available");
    return;
  }

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    if (!ctx || !analyser) return;

    animationFrameRef.current = requestAnimationFrame(draw);

    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = "#1a1a1c"; // soft dark cream background
    ctx.fillRect(0, 0, canvas!.width, canvas!.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#9b2d30"; // wine red line
    ctx.beginPath();

    const sliceWidth = canvas!.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas!.height) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }

    ctx.lineTo(canvas!.width, canvas!.height / 2);
    ctx.stroke();
  };

  draw();

  // Cleanup only when preview ends or component unmounts
  return () => {
    if (audioContext && !isRecording) {
      audioContext.close();
      previewAudioContextRef.current = null;
      previewAnalyserRef.current = null;
      previewSourceRef.current = null;
    }
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
  };
};


  const handleUploadAll = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadMessage(null);

    const formData = new FormData();
    formData.append('eventId', eventId!);
    formData.append('type', activeTab === 'photos' ? 'photo' : activeTab === 'videos' ? 'video' : 'audio');

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




  // Show loading while checking folder
  if (firstVisit === null) {
    return;
  }

// Show 404 if folder does not exist
if (!firstVisit) {
  return (
    <div className="not-found-container">
      <h1>404 - Event Not Found</h1>
      <p>The event with date <strong>"{eventDate}"</strong> does not exist.</p>
      <button className="go-home-btn" onClick={() => navigate('/')}>
        Go Home
      </button>
      <p className="subtle-accent">
        If you think this is an error, please contact the couple. {firstVisit}
      </p>
    </div>
  );
}



  return (
    <>
      {/* Wizard – shows only on first visit */}
      {showWizard && (
        <QRWizard
          onClose={() => {
            localStorage.setItem('qr-moments-wizard-seen', 'true');
            setShowWizard(false);
          }}
        />
      )}

      <div className="qr-moments-page">
        {/* Header */}
        <header className="header">
          <h1 className="logo">QR Moments</h1>
          <p className="subtitle">{eventInfo.message}</p>
          <h2 className="event-name">{eventInfo.bride} & {eventInfo.groom} • {eventInfo.eventDate}</h2>
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
          {/* Tab-specific content */}
          {activeTab === 'photos' || activeTab === 'videos' ? (
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
            </section>
          ) : activeTab === 'audio' ? (
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

              {(audioPermission === 'granted' || audioPermission === 'prompt') && !isRecording && !audioBlob && (
                <button className="upload-btn" onClick={startRecording}>
                  Start Recording
                </button>
              )}

              {isRecording && (
                <div className="recording-active">
                  <div className="waveform-canvas-wrapper">
                    <canvas ref={canvasRef} width="100%" height="150" className="waveform-canvas"></canvas>
                  </div>
                  <div className="recording-timer">
                    Recording... {recordingTimeLeft.toString().padStart(2, '0')} seconds left
                  </div>
                  <button className="stop-btn" onClick={stopRecording}>
                    Stop & Preview
                  </button>
                </div>
              )}

              {audioBlob && audioPreviewUrl && (
                <div className="audio-preview">
                  <h3>Voice Message Preview</h3>

                  <div className="waveform-canvas-wrapper">
                    <canvas ref={previewCanvasRef} width="100%" height="150" className="waveform-canvas"></canvas>
                  </div>

                  <div className="audio-controls">
                    <button className={`play-pause-btn ${isPlaying ? 'playing' : ''}`} onClick={togglePlayPause}>
                      {isPlaying ? '❚❚' : '▶'}
                    </button>
                    <span className="duration">
                      {formatDuration(currentTime)} / {formatDuration(duration)}
                    </span>
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
            </section>
          ) : null}

          {/* Shared Preview Gallery & Upload Button */}
          {previews.length > 0 && (
            <div className="preview-gallery">
              <h3>Selected Files ({previews.length})</h3>
              <div className="preview-grid">
                {previews.map((previewUrl, index) => (
                  <div key={index} className="preview-item">
                    {selectedFiles[index]?.type.startsWith('image/') ? (
                      <img src={previewUrl} alt="preview" className="preview-img" />
                    ) : selectedFiles[index]?.type.startsWith('video/') ? (
                      <video src={previewUrl} className="preview-img" controls muted />
                    ) : selectedFiles[index]?.type.startsWith('audio/') ? (
                      <audio controls src={previewUrl} className="preview-img" />
                    ) : null}
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
    </>
  );
};

export default QRMomentsPage;