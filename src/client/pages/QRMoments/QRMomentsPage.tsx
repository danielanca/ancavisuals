/*
 * Purpose: renders the public QR Moments page where guests can upload photos,
 * videos and voice messages for an event, including onboarding, recording and
 * upload state management in the browser.
 */
import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import parse from 'html-react-parser';
import './QRMomentsPage.scss';

type LegacyAudioWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

type QRMomentsEventInfo = {
  bride?: string;
  groom?: string;
  eventDate?: string;
  message?: string;
};

const QR_MOMENTS_FALLBACK_PHONE = '0745-469-907';
const QR_MOMENTS_FALLBACK_WHATSAPP = 'https://wa.me/40745469907';

const QRWizard = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Bine ai venit la QR Moments!',
      content: 'Aici poți încărca poze, clipuri și mesaje vocale pentru miri. Tot ce surprindeți voi devine parte din povestea nunții!',
      icon: '✨'
    },
    {
      title: 'Cum funcționează?',
      content: 'Alege tipul de conținut (Poze, Video sau Mesaj), apoi apasă butonul mare pentru a selecta fișierele de pe telefon sau cameră.',
      icon: '📱'
    },
    {
      title: 'Pentru mesaje vocale',
      content: 'Permite accesul la microfon, apasă „Începe înregistrarea", vorbește din inimă (max 60 sec), apoi „Stop & Previzualizare" și „Trimite mesajul"!',
      icon: '🎤'
    },
    {
      title: 'Gata de trimis!',
      content: 'După ce ai selectat tot, apasă „Trimite toate" — fișierele ajung instant la miri. Ei vor fi emoționați să vadă ce ați surprins!',
      icon: '❤️'
    }
  ];

  return (
    <div className="qr-wizard-overlay">
      <div className="qr-wizard-modal">
        <button className="wizard-close" onClick={onClose}>×</button>

        <div className="wizard-icon">{parse(steps[step].icon)}</div>
        <h2 className="wizard-title">{parse(steps[step].title)}</h2>
        <p className="wizard-text">{parse(steps[step].content)}</p>

        <div className="wizard-progress">
          {steps.map((_, i) => (
            <div key={i} className={`dot ${i === step ? 'active' : ''}`} />
          ))}
        </div>

        <div className="wizard-buttons">
          <button className="wizard-skip" onClick={onClose}>
            {parse('Sari peste')}
          </button>
          <button className="wizard-next" onClick={() => {
            if (step < steps.length - 1) setStep(step + 1);
            else onClose();
          }}>
            {step === steps.length - 1 ? parse('Începe acum') : parse('Următorul')}
          </button>
        </div>
      </div>
    </div>
  );
};

const QRMomentsPage: React.FC = () => {
  const [eventInfo, setEventInfo] = useState<QRMomentsEventInfo | null>(null);
  const [firstVisit, setFirstVisit] = useState<boolean | null>(null);
  const { eventDate } = useParams<{ eventDate: string }>();
  const [activeTab, setActiveTab] = useState<'photos' | 'videos' | 'audio'>('photos');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [comment, setComment] = useState('');

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);

  const navigate = useNavigate();

  const [showWizard, setShowWizard] = useState(() => {
    return localStorage.getItem('qr-moments-wizard-seen') !== 'true';
  });

  const [clickTime, setClickTime] = useState(0);

  useEffect(() => {
    const checkDBForFirstVisit = async () => {
      try {
        const response = await fetch(`/api/urlcheck/${eventDate}`, {
          method: 'GET',
        });

        if (response.ok) {
          const data = await response.json();
          setFirstVisit(data.urlFound);
          setEventInfo(data.data);
        }
      } catch (err) {
        console.error('Failed to check first visit:', err);
        setFirstVisit(false);
      }
    };

    checkDBForFirstVisit();
  }, [eventDate]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

  const requestMicPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setAudioPermission('granted');
    } catch (err) {
      console.error('Microphone permission denied:', err);
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

      const AudioContextClass = window.AudioContext || (window as LegacyAudioWindow).webkitAudioContext;
      const audioContext = new AudioContextClass();

      // FIX #4 — Safari requires resume() after creation
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      source.connect(analyser);
      analyserRef.current = analyser;

      // FIX #2 — correct mimeType detection for Safari vs Chrome
      const mimeType = MediaRecorder.isTypeSupported('audio/mp4')
        ? 'audio/mp4'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';

      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const recordedMimeType = mediaRecorder.mimeType || 'audio/mp4';
        const blob = new Blob(audioChunksRef.current, { type: recordedMimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioPreviewUrl(url);
        const extension = recordedMimeType.includes('mp4') ? 'm4a' : 'webm';

        const audioFile = new File(
          [blob],
          `voice-${Date.now()}.${extension}`,
          { type: recordedMimeType }
        );

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
      console.error('Failed to start recording:', err);
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
        audioRef.current.play().catch(e => console.error('Playback error:', e));
      }
      setIsPlaying(!isPlaying);
    }
  };

  useEffect(() => {
    if ((isRecording && canvasRef.current) || (audioPreviewUrl && previewCanvasRef.current)) {
      drawWaveform();
    }
  }, [isRecording, audioPreviewUrl]);

  useEffect(() => {
    if (audioPreviewUrl && previewCanvasRef.current && isPlaying) {
      drawWaveform();
    }
  }, [isPlaying]);

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

  // FIX #3 — Safari doesn't support permissions.query for microphone
  useEffect(() => {
    if (activeTab !== 'audio') return;

    if (!navigator.permissions || typeof navigator.permissions.query !== 'function') {
      setAudioPermission('unknown');
      return;
    }

    navigator.permissions
      .query({ name: 'microphone' as PermissionName })
      .then(status => {
        setAudioPermission(status.state);
        status.onchange = () => setAudioPermission(status.state);
      })
      .catch(() => setAudioPermission('unknown'));
  }, [activeTab]);

  const drawWaveform = () => {
    let canvas: HTMLCanvasElement | null = null;
    let analyser: AnalyserNode | null = analyserRef.current;

    if (isRecording) {
      canvas = canvasRef.current;
    } else if (audioPreviewUrl && previewCanvasRef.current && audioRef.current) {
      canvas = previewCanvasRef.current;

      if (!previewAnalyserRef.current) {
        try {
          const AudioContextClass = window.AudioContext || (window as LegacyAudioWindow).webkitAudioContext;
          const audioContext = new AudioContextClass();

          // FIX #4 — Safari resume
          if (audioContext.state === 'suspended') {
            audioContext.resume();
          }

          previewAudioContextRef.current = audioContext;

          const source = audioContext.createMediaElementSource(audioRef.current);
          previewSourceRef.current = source;

          const newAnalyser = audioContext.createAnalyser();
          newAnalyser.fftSize = 2048;
          newAnalyser.smoothingTimeConstant = 0.85;
          source.connect(newAnalyser);
          source.connect(audioContext.destination);
          previewAnalyserRef.current = newAnalyser;

          analyser = newAnalyser;
        } catch (err) {
          console.error('Failed to create preview analyser:', err);
          return;
        }
      } else {
        analyser = previewAnalyserRef.current;
      }
    }

    if (!canvas || !analyser) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // FIX #6 — canvas width must be a number, not "100%"
    canvas.width = canvas.offsetWidth || 300;
    canvas.height = canvas.offsetHeight || 150;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!ctx || !analyser) return;

      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.fillStyle = '#1a1a1c';
      ctx.fillRect(0, 0, canvas!.width, canvas!.height);

      ctx.lineWidth = 2;
      ctx.strokeStyle = '#9b2d30';
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

    return () => {
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
    formData.append('comment', comment.trim());

    selectedFiles.forEach(file => formData.append('files', file));

    try {
      const response = await fetch('/api/upload-qr-moment', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const result = await response.json();
      setUploadMessage(`Succes! ${result.uploadedCount} fișier(e) încărcate! 🎉`);

      previews.forEach(URL.revokeObjectURL);
      setSelectedFiles([]);
      setPreviews([]);
      setComment('');
      setAudioBlob(null);
      setAudioPreviewUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
    } catch (err) {
      setUploadMessage(
        `Eroare la încărcare. Dacă problema persistă, trimite pozele pe <a href="${QR_MOMENTS_FALLBACK_WHATSAPP}" target="_blank" rel="noopener noreferrer">WhatsApp la ${QR_MOMENTS_FALLBACK_PHONE}</a>.`,
      );
    } finally {
      setUploading(false);
    }
  };

  const clearCookie = () => {
    const newCount = clickTime + 1;

    if (newCount >= 10) {
      setClickTime(0);
      localStorage.removeItem('qr-moments-wizard-seen');
      setShowWizard(true);
    } else {
      setClickTime(newCount);
    }
  };

  if (firstVisit === null) {
    return null;
  }

  if (!firstVisit) {
    return (
      <div className="not-found-container">
        <h1>{parse('404 - Eveniment negăsit')}</h1>
        <p>{parse(`Evenimentul cu data <strong>„${eventDate}"</strong> nu există.`)}</p>
        <button className="go-home-btn" onClick={() => navigate('/')}>
          {parse('Înapoi acasă')}
        </button>
        <p className="subtle-accent">
          {parse('Dacă crezi că este o eroare, te rugăm contactează cuplul.')}
        </p>
      </div>
    );
  }

  return (
    <>
      {showWizard && (
        <QRWizard
          onClose={() => {
            localStorage.setItem('qr-moments-wizard-seen', 'true');
            setShowWizard(false);
          }}
        />
      )}

      <div className="qr-moments-page">
        <header className="header">
          <h1 className="logo" onClick={clearCookie}>{parse('QR Moments')}</h1>
          <p className="subtitle">{parse(eventInfo?.message ?? '')}</p>
          <h2 className="event-name">
            {parse(`${eventInfo?.bride ?? ''} & ${eventInfo?.groom ?? ''} • ${eventInfo?.eventDate ?? ''}`)}
          </h2>
        </header>

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'photos' ? 'active' : ''}`}
            onClick={() => setActiveTab('photos')}
          >
            <span className="tab-icon">{parse('📸')}</span>
            {parse('Poze')}
          </button>
          <button
            className={`tab ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => setActiveTab('videos')}
          >
            <span className="tab-icon">{parse('🎥')}</span>
            {parse('Video')}
          </button>
          <button
            className={`tab ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            <span className="tab-icon">{parse('🎤')}</span>
            {parse('Mesaj')}
          </button>
        </div>

        <main className="content">
          {activeTab === 'photos' || activeTab === 'videos' ? (
            <section className="content-section fade-in">
              <h2>
                {activeTab === 'photos'
                  ? parse('Momente prin ochii tăi ✨')
                  : parse('Surprinde magia în mișcare 🎬')}
              </h2>
              <p className="info-text">
                {activeTab === 'photos'
                  ? parse('Selectează pozele tale, previzualizează-le și trimite-le cuplului!')
                  : parse('Alege clipuri scurte – maxim 60 de secunde recomandat')}
              </p>

              <button
                className="upload-btn"
                onClick={() => openFilePicker(activeTab === 'photos' ? 'image/*' : 'video/*')}
                disabled={uploading}
              >
                {activeTab === 'photos' ? parse('Alege Poze') : parse('Alege Clipuri')}
              </button>

              <textarea
                className="comment-input"
                placeholder="Adaugă un mesaj pentru cuplu (opțional)..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={300}
                rows={3}
              />
            </section>
          ) : activeTab === 'audio' ? (
            <section className="content-section fade-in">
              <h2>{parse('Vorbește din suflet 💌')}</h2>
              <p className="info-text">
                {parse('Înregistrează un mesaj vocal frumos pentru cuplu (maxim 60 de secunde)')}
              </p>

              {audioPermission === 'unknown' && (
                <div className="permission-check">
                  <p>{parse('Avem nevoie de acces la microfon pentru a înregistra mesajul tău.')}</p>
                  <button className="permission-btn" onClick={requestMicPermission}>
                    {parse('Permite accesul la microfon')}
                  </button>
                </div>
              )}

              {audioPermission === 'denied' && (
                <div className="permission-denied">
                  <p>{parse('Accesul la microfon este blocat.')}</p>
                  <p>{parse('Te rugăm să îl activezi din setările browserului.')}</p>
                  <button className="permission-btn retry" onClick={requestMicPermission}>
                    {parse('Încearcă din nou')}
                  </button>
                </div>
              )}

              {(audioPermission === 'granted' || audioPermission === 'prompt') && !isRecording && !audioBlob && (
                <button className="upload-btn" onClick={startRecording}>
                  {parse('Începe înregistrarea')}
                </button>
              )}

              {isRecording && (
                <div className="recording-active">
                  <div className="waveform-canvas-wrapper">
                    {/* FIX #6 — width/height ca style, nu atribute */}
                    <canvas
                      ref={canvasRef}
                      className="waveform-canvas"
                      style={{ width: '100%', height: '150px' }}
                    />
                  </div>
                  <div className="recording-timer">
                    {parse(`Se înregistrează... ${recordingTimeLeft.toString().padStart(2, '0')} secunde rămase`)}
                  </div>
                  <button className="stop-btn" onClick={stopRecording}>
                    {parse('Stop & Previzualizare')}
                  </button>
                </div>
              )}

              {audioBlob && audioPreviewUrl && (
                <div className="audio-preview">
                  <h3>{parse('Previzualizare mesaj vocal')}</h3>

                  <div className="waveform-canvas-wrapper">
                    {/* FIX #6 — width/height ca style, nu atribute */}
                    <canvas
                      ref={previewCanvasRef}
                      className="waveform-canvas"
                      style={{ width: '100%', height: '150px' }}
                    />
                  </div>

                  <div className="audio-controls">
                    <button
                      className={`play-pause-btn ${isPlaying ? 'playing' : ''}`}
                      onClick={togglePlayPause}
                    >
                      {isPlaying ? '❚❚' : '▶'}
                    </button>
                    <span className="duration">
                      {parse(`${formatDuration(currentTime)} / ${formatDuration(duration)}`)}
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
                      setComment('');
                      setIsPlaying(false);
                      setCurrentTime(0);
                      setDuration(0);
                    }}
                  >
                    {parse('Șterge și înregistrează din nou')}
                  </button>

                  <textarea
                    className="comment-input"
                    placeholder="Adaugă un mesaj pentru cuplu (opțional)..."
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    maxLength={300}
                    rows={3}
                  />
                </div>
              )}
            </section>
          ) : null}

          {previews.length > 0 && (
            <div className="preview-gallery">
              <h3>{parse(`Fișiere selectate (${previews.length})`)}</h3>
              <div className="preview-grid">
                {previews.map((previewUrl, index) => (
                  <div key={index} className="preview-item">
                    {selectedFiles[index]?.type.startsWith('image/') ? (
                      <img src={previewUrl} alt="previzualizare" className="preview-img" />
                    ) : selectedFiles[index]?.type.startsWith('video/') ? (
                      <video src={previewUrl} className="preview-img" muted />
                    ) : selectedFiles[index]?.type.startsWith('audio/') ? (
                      <audio src={previewUrl} className="preview-img" />
                    ) : null}
                    <button
                      className="remove-btn"
                      onClick={() => removeFile(index)}
                      aria-label="Elimină fișierul"
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
                {uploading
                  ? parse('Se trimite...')
                  : parse(`Trimite toate (${selectedFiles.length})`)}
              </button>
            </div>
          )}

          {uploadMessage && (
            <p className={uploadMessage.includes('Succes') ? 'successMsg' : 'errorMsg'}>
              {parse(uploadMessage)}
            </p>
          )}
        </main>

        <footer className="footer">
          {parse('Creat cu drag de <strong>Anca Visuals</strong>')}
        </footer>

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
