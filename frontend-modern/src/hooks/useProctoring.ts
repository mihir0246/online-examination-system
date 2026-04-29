import { useEffect, useRef, useState } from 'react';
import apiClient from '@/services/apiClient';

interface UseProctoringOptions {
  onTabSwitch?: (count: number) => void;
}

export const useProctoring = (
  testId: string,
  traineeId: string,
  options: UseProctoringOptions = {}
) => {
  const [tabSwitches, setTabSwitches] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastLoggedRef = useRef<number>(0);
  const onTabSwitchRef = useRef(options.onTabSwitch);
  useEffect(() => { onTabSwitchRef.current = options.onTabSwitch; });

  // Tab Switch Detection — stable deps: only testId and traineeId
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const now = Date.now();
        if (now - lastLoggedRef.current < 1000) return;
        lastLoggedRef.current = now;

        setTabSwitches(prev => {
          const newCount = prev + 1;

          apiClient.post('/api/v1/trainee/log-event', {
            testid: testId,
            traineeid: traineeId,
            event: 'TAB_SWITCH',
            count: newCount,
            timestamp: new Date().toISOString()
          });

          setTimeout(() => {
            onTabSwitchRef.current?.(newCount);
          }, 0);

          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [testId, traineeId]);

  const [webcamActive, setWebcamActive] = useState(false);

  // Webcam Management
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      streamRef.current = stream;
      setWebcamActive(true);
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        console.warn('Webcam access denied by user.');
      } else {
        console.error('Error accessing webcam:', err);
      }
      setWebcamActive(false);
    }
  };

  const stopWebcam = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      setWebcamActive(false);
    }
  };

  const takeSnapshot = async () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      const imageData = canvas.toDataURL('image/jpeg', 0.5);
      try {
        await apiClient.post('/api/v1/trainee/save-snapshot', {
          testid: testId,
          traineeid: traineeId,
          image: imageData,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error saving snapshot:', err);
      }
    }
  };

  // Periodic Snapshot
  useEffect(() => {
    const interval = setInterval(takeSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  return { videoRef, tabSwitches, startWebcam, stopWebcam, takeSnapshot, webcamActive };
};
