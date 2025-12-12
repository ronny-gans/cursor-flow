import { GoogleGenAI, Type } from "@google/genai";
import { PhysicsConfig, ZoomEvent } from "../types";

const apiKey = process.env.API_KEY || '';

// We only initialize if we have a key, effectively handled in the hook or component
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({ apiKey });
}

export const explainPhysicsSettings = async (config: PhysicsConfig): Promise<string> => {
  if (!ai) return "Gemini API Key not found. Please set process.env.API_KEY to use the AI assistant.";

  try {
    const prompt = `
      You are an expert in motion graphics and physics engines for UI (User Interfaces).
      
      Analyze these spring physics parameters:
      - Tension (Stiffness): ${config.stiffness}
      - Friction (Damping): ${config.damping}
      - Mass: ${config.mass}

      Explain in 2 short sentences how this specific combination will make the cursor movement feel to the user (e.g., "bouncy", "sluggish", "snappy", "robotic"). 
      Focus on the "feel".
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Could not generate explanation.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI is currently offline. Adjust knobs to feel the difference.";
  }
};

export const generateSectionTitles = async (context: string): Promise<string[]> => {
  if (!ai) return ["Intro", "Key Concepts", "Live Demo", "Summary", "Next Steps"];

  try {
    const prompt = `
      Generate 5 creative, short, punchy section titles for a video presentation about: "${context}".
      Keep them professional but engaging (Cursor Flow style).
      Return ONLY a JSON array of strings, e.g., ["The Problem", "Our Solution"].
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) return ["Section 1", "Section 2"];
    
    return JSON.parse(text) as string[];
  } catch (error) {
    console.error("Gemini Title Gen Error:", error);
    return ["Intro", "Deep Dive", "Features", "Conclusion", "Outro"];
  }
};

export const generateVeoIntro = async (
  imageBase64: string, 
  prompt: string,
  aspectRatio: '16:9' | '9:16'
): Promise<string> => {
  // Always get the latest key from env to handle dynamic key selection
  const currentKey = process.env.API_KEY;
  if (!currentKey) throw new Error("API Key is missing. Please select a paid API key.");

  // Create a fresh instance to ensure the key is used
  const genAI = new GoogleGenAI({ apiKey: currentKey });

  // Extract mime type and data from base64 string
  // Format: data:image/png;base64,.....
  const matches = imageBase64.match(/^data:(.+);base64,(.+)$/);
  if (!matches) throw new Error("Invalid image format");
  
  const mimeType = matches[1];
  const imageBytes = matches[2];

  let operation = await genAI.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt || "Cinematic camera movement, high quality, professional lighting",
    image: {
      imageBytes: imageBytes,
      mimeType: mimeType,
    },
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });

  // Poll for completion
  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5s
    operation = await genAI.operations.getVideosOperation({ operation: operation });
  }

  const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!videoUri) throw new Error("Video generation failed or returned no URI.");

  // The response.body contains the MP4 bytes. You must append an API key when fetching from the download link.
  return `${videoUri}&key=${currentKey}`;
};

// --- Vision / Smart Zoom Utilities ---

const extractFramesFromVideo = async (videoSrc: string, duration: number, interval: number = 2.5): Promise<{time: number, base64: string}[]> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        video.crossOrigin = "anonymous";
        video.src = videoSrc;
        video.muted = true;
        
        const frames: {time: number, base64: string}[] = [];
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        video.onloadedmetadata = async () => {
            canvas.width = video.videoWidth / 4; // Downscale for API performance
            canvas.height = video.videoHeight / 4;
            
            let currentTime = 0;
            
            const captureFrame = async () => {
                if (currentTime >= duration) {
                    resolve(frames);
                    return;
                }
                
                // Seek
                video.currentTime = currentTime;
                await new Promise(r => { video.onseeked = r; });
                
                // Draw
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    frames.push({ time: currentTime, base64 });
                }
                
                currentTime += interval;
                captureFrame();
            };
            
            captureFrame();
        };
        
        video.onerror = (e) => reject(e);
    });
};

export const analyzeVideoForZooms = async (videoSrc: string, duration: number): Promise<ZoomEvent[]> => {
    // 1. Check Key
    const currentKey = process.env.API_KEY;
    if (!currentKey) {
        console.warn("No API Key available for analysis, returning empty.");
        return [];
    }
    const genAI = new GoogleGenAI({ apiKey: currentKey });

    try {
        // 2. Extract Frames
        // Limit duration to avoid token limits on demo
        const analyzeDuration = Math.min(duration, 30); 
        const frames = await extractFramesFromVideo(videoSrc, analyzeDuration, 3.0);
        
        if (frames.length === 0) return [];

        // 3. Prepare Prompt
        const prompt = `
            You are an expert video editor using "Cursor Flow". 
            Analyze this sequence of screen recording frames (taken every 3 seconds).
            Identify key moments where the viewer's attention should be focused (e.g. typing, a modal opening, a mouse click).
            
            Return a JSON array of zoom events with this exact structure:
            {
                "startTime": number (in seconds),
                "duration": number (usually 2-4 seconds),
                "x": number (percentage 0-100 from left),
                "y": number (percentage 0-100 from top),
                "scale": number (between 1.5 and 2.5)
            }
            
            Rules:
            - Create 2-4 distinct zoom events.
            - Ensure they do not overlap perfectly.
            - Focus on interesting UI elements.
        `;

        const parts: any[] = [{ text: prompt }];
        frames.forEach(f => {
             parts.push({ text: `Frame at ${f.time.toFixed(1)}s:` });
             parts.push({
                 inlineData: {
                     mimeType: 'image/jpeg',
                     data: f.base64.split(',')[1]
                 }
             });
        });

        // 4. Call API
        const response = await genAI.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: {
                responseMimeType: 'application/json'
            }
        });

        const text = response.text;
        if (!text) return [];

        const rawZooms = JSON.parse(text) as any[];
        
        // 5. Map to Domain Objects
        return rawZooms.map(z => ({
            id: crypto.randomUUID(),
            startTime: typeof z.startTime === 'number' ? z.startTime : 0,
            duration: typeof z.duration === 'number' ? z.duration : 2.5,
            x: typeof z.x === 'number' ? z.x : 50,
            y: typeof z.y === 'number' ? z.y : 50,
            scale: typeof z.scale === 'number' ? z.scale : 1.5
        }));

    } catch (e) {
        console.error("Smart Zoom Analysis Failed:", e);
        return [];
    }
};