/**
 * Video Processing Service
 * Client for the Python backend that handles video encoding
 */

const API_BASE = 'http://localhost:8000';

export interface ProcessingJob {
  job_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
}

export interface CursorStyleOption {
  id: string;
  name: string;
  description: string;
}

export interface ProcessOptions {
  cursorStyle: string;
  cursorSize: number;
  cursorColor: string;
  smooth: boolean;
  quality: 'high' | 'balanced' | 'fast';
}

/**
 * Check if the backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/health`, { 
      method: 'GET',
      signal: AbortSignal.timeout(2000)
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get available cursor styles from backend
 */
export async function getCursorStyles(): Promise<CursorStyleOption[]> {
  try {
    const response = await fetch(`${API_BASE}/api/cursor-styles`);
    if (!response.ok) throw new Error('Failed to fetch cursor styles');
    const data = await response.json();
    return data.styles;
  } catch (error) {
    console.error('Failed to get cursor styles:', error);
    // Return defaults if backend unavailable
    return [
      { id: 'fancy', name: 'Modern Arrow', description: 'Clean arrow with shadow' },
      { id: 'macos', name: 'macOS', description: 'macOS-style pointer' },
      { id: 'circle', name: 'Circle', description: 'Filled circle' },
    ];
  }
}

/**
 * Submit video for processing
 */
export async function processVideo(
  videoBlob: Blob,
  cursorData: {x: number, y: number, time: number}[],
  options: ProcessOptions
): Promise<string> {
  const formData = new FormData();
  formData.append('video', videoBlob, 'recording.webm');
  formData.append('cursor_data', JSON.stringify(cursorData));
  formData.append('cursor_style', options.cursorStyle);
  formData.append('cursor_size', options.cursorSize.toString());
  formData.append('cursor_color', options.cursorColor);
  formData.append('smooth', options.smooth.toString());
  formData.append('quality', options.quality);

  const response = await fetch(`${API_BASE}/api/process`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start processing');
  }

  const data = await response.json();
  return data.job_id;
}

/**
 * Poll job status
 */
export async function getJobStatus(jobId: string): Promise<ProcessingJob> {
  const response = await fetch(`${API_BASE}/api/status/${jobId}`);
  
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Job not found');
    }
    throw new Error('Failed to get job status');
  }

  return response.json();
}

/**
 * Download processed video
 */
export async function downloadProcessedVideo(jobId: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/download/${jobId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to download video');
  }

  return response.blob();
}

/**
 * Cleanup job files after download
 */
export async function cleanupJob(jobId: string): Promise<void> {
  await fetch(`${API_BASE}/api/cleanup/${jobId}`, { method: 'DELETE' });
}

/**
 * Process video and wait for completion with progress updates
 */
export async function processVideoWithProgress(
  videoBlob: Blob,
  cursorData: {x: number, y: number, time: number}[],
  options: ProcessOptions,
  onProgress: (progress: number, status: string) => void
): Promise<Blob> {
  // Start processing
  onProgress(0, 'Uploading video...');
  const jobId = await processVideo(videoBlob, cursorData, options);
  
  // Poll for completion
  onProgress(5, 'Processing started...');
  
  while (true) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const status = await getJobStatus(jobId);
    
    if (status.status === 'completed') {
      onProgress(95, 'Downloading result...');
      const result = await downloadProcessedVideo(jobId);
      
      // Cleanup
      await cleanupJob(jobId);
      
      onProgress(100, 'Complete!');
      return result;
    }
    
    if (status.status === 'failed') {
      throw new Error(status.error || 'Processing failed');
    }
    
    // Update progress (scale backend progress to 10-90 range)
    const scaledProgress = 10 + (status.progress * 0.85);
    onProgress(scaledProgress, `Processing: ${status.progress}%`);
  }
}
