import express from "express";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";

const app = express();
export default app; // Export for Vercel

console.log('DEBUG: Server starting up...');
app.use(express.json());
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

const PORT = 3000;

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

const SC_CLIENT_ID = process.env.SOUNDCLOUD_CLIENT_ID || 'sDXiigOeKFfLu96ZHei4ynd97vs28nj8';
const SC_CLIENT_SECRET = process.env.SOUNDCLOUD_CLIENT_SECRET || 'YFebqBqisWkOJVUs6QgBoFAFOnCc1Nrm';

const COMMON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': '*/*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://soundcloud.com/',
  'Origin': 'https://soundcloud.com'
};

async function fetchWithRetry(url: string, options: any = {}, retries = 3, backoff = 500) {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...COMMON_HEADERS,
          ...options.headers
        }
      });
      // If we get a 401/403, it might be an invalid client_id, but the connection itself worked
      return response;
    } catch (err: any) {
      lastError = err;
      if (err.message?.includes('ECONNRESET') || err.message?.includes('fetch failed')) {
        console.warn(`Network error (attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        backoff *= 2;
        continue;
      }
      throw err;
    }
  }
  throw lastError || new Error('Fetch failed after retries');
}

let scToken = '';

async function getSCToken() {
  if (scToken) return scToken;
  try {
    const res = await fetchWithRetry('https://api.soundcloud.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: SC_CLIENT_ID,
        client_secret: SC_CLIENT_SECRET
      })
    });
    const data = await res.json();
    if (data.access_token) {
      scToken = data.access_token;
      return scToken;
    }
    throw new Error('Failed to get SoundCloud token');
  } catch (err) {
    console.error('Error fetching token:', err);
    throw err;
  }
}

app.get('/api/soundcloud/search', async (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.json([]);
    const webId = await getWebClientId();
    const scSearchRes = await fetchWithRetry(`https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(q)}&client_id=${webId}&limit=10`);
    if (scSearchRes.ok) {
      const scData = await scSearchRes.json();
      const tracks = scData.collection?.filter((t: any) => t.streamable).map((t: any) => ({
        id: t.id.toString(),
        title: t.title,
        artist: t.user?.username || 'Unknown',
        previewUrl: `/api/stream/${t.id}`,
        artworkUrl: t.artwork_url?.replace('large', 't500x500') || 'https://picsum.photos/seed/sc/500/500',
        scUsername: t.user?.username || 'Unknown'
      })) || [];
      res.json(tracks);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

app.post('/api/songs/add', async (req, res) => {
  try {
    const { url, category } = req.body;
    if (!url || !category) return res.status(400).json({ error: 'Missing url or category' });
    
    const token = await getSCToken();
    
    // Resolve SC URL
    const resolveRes = await fetchWithRetry(`https://api.soundcloud.com/resolve?url=${encodeURIComponent(url)}`, {
      headers: { Authorization: `OAuth ${token}` }
    });
    
    if (!resolveRes.ok) {
      return res.status(400).json({ error: 'Invalid SoundCloud URL or track not found' });
    }
    
    const scTrack = await resolveRes.json();
    if (scTrack.kind !== 'track') {
      return res.status(400).json({ error: 'URL must point to a single track' });
    }
    
    // Try to get official metadata from iTunes
    let title = scTrack.title;
    let artist = scTrack.user?.username || 'Unknown';
    let artworkUrl = scTrack.artwork_url ? scTrack.artwork_url.replace('large', 't500x500') : 'https://picsum.photos/seed/music/300/300';
    let itunesPreviewUrl: string | undefined = undefined;
    
    // Clean up title if it contains artist name (e.g. "Artist - Title")
    let searchTitle = title;
    if (title.includes(' - ')) {
      const parts = title.split(' - ');
      artist = parts[0].trim();
      searchTitle = parts[1].trim();
      title = searchTitle;
    }
    
    try {
      const itunesRes = await fetchWithRetry(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTitle + ' ' + artist)}&entity=song&limit=1`);
      if (itunesRes.ok) {
        const itunesData = await itunesRes.json();
        if (itunesData.results && itunesData.results.length > 0) {
          const itunesTrack = itunesData.results[0];
          title = itunesTrack.trackName;
          artist = itunesTrack.artistName;
          if (itunesTrack.artworkUrl100) {
            artworkUrl = itunesTrack.artworkUrl100.replace('100x100', '300x300');
          }
          if (itunesTrack.previewUrl) {
            itunesPreviewUrl = itunesTrack.previewUrl;
          }
        }
      } else {
        console.error(`iTunes lookup failed with status: ${itunesRes.status}`);
      }
    } catch (e) {
      console.error('iTunes lookup failed for added song', e);
    }
    
    const newSong = {
      id: scTrack.id.toString(),
      title,
      artist,
      previewUrl: `/api/stream/${scTrack.id}`,
      artworkUrl,
      scUsername: scTrack.user?.username || 'Unknown',
      itunesPreviewUrl,
      category
    };
    
    res.json(newSong);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add song' });
  }
});

app.post('/api/songs/batch-add', async (req, res) => {
  try {
    const { urls, category } = req.body;
    if (!urls || !Array.isArray(urls) || !category) {
      return res.status(400).json({ error: 'Missing urls array or category' });
    }
    
    const token = await getSCToken();
    const addedSongs = [];
    let itunesRateLimited = false;
    
    for (const url of urls) {
      try {
        const cleanUrl = url.split('?')[0].trim();
        if (!cleanUrl) continue;
        
        const resolveRes = await fetchWithRetry(`https://api.soundcloud.com/resolve?url=${encodeURIComponent(cleanUrl)}`, {
          headers: { Authorization: `OAuth ${token}` }
        });
        
        if (!resolveRes.ok) continue;
        
        const scTrack = await resolveRes.json();
        if (scTrack.kind !== 'track') continue;
        
        let title = scTrack.title;
        let artist = scTrack.user?.username || 'Unknown';
        let artworkUrl = scTrack.artwork_url ? scTrack.artwork_url.replace('large', 't500x500') : 'https://picsum.photos/seed/music/300/300';
        let itunesPreviewUrl: string | undefined = undefined;
        
        let searchTitle = title;
        if (title.includes(' - ')) {
          const parts = title.split(' - ');
          artist = parts[0].trim();
          searchTitle = parts[1].trim();
          title = searchTitle;
        }
        
        if (!itunesRateLimited) {
          try {
            const itunesRes = await fetchWithRetry(`https://itunes.apple.com/search?term=${encodeURIComponent(searchTitle + ' ' + artist)}&entity=song&limit=1`);
            if (itunesRes.ok) {
              const itunesData = await itunesRes.json();
              if (itunesData.results && itunesData.results.length > 0) {
                const itunesTrack = itunesData.results[0];
                title = itunesTrack.trackName;
                artist = itunesTrack.artistName;
                if (itunesTrack.artworkUrl100) {
                  artworkUrl = itunesTrack.artworkUrl100.replace('100x100', '300x300');
                }
                if (itunesTrack.previewUrl) {
                  itunesPreviewUrl = itunesTrack.previewUrl;
                }
              }
            } else {
              console.error(`iTunes lookup failed with status: ${itunesRes.status}`);
              if (itunesRes.status === 429 || itunesRes.status === 403) {
                itunesRateLimited = true;
                console.warn('iTunes API rate limit reached. Falling back to SoundCloud metadata for remaining tracks.');
              }
            }
          } catch (e) {
            console.error('iTunes lookup failed for added song', e);
          }
          
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        
        const newSong = {
          id: scTrack.id.toString(),
          title,
          artist,
          previewUrl: `/api/stream/${scTrack.id}`,
          artworkUrl,
          scUsername: scTrack.user?.username || 'Unknown',
          itunesPreviewUrl,
          category
        };
        
        addedSongs.push(newSong);
      } catch (e) {
        console.error(`Failed to process URL ${url}:`, e);
      }
    }
    
    res.json({ added: addedSongs });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to batch add songs' });
  }
});

let webClientId = 'FqfkxJZWPZt411KWUg3pxbwm43M6UalQ';

async function getWebClientId() {
  try {
    console.log('Refreshing SoundCloud web client ID...');
    const res = await fetchWithRetry('https://soundcloud.com/discover');
    const html = await res.text();
    
    // Try multiple patterns to find asset scripts
    let scriptUrls = Array.from(html.matchAll(/<script[^>]+src="([^"]+sndcdn\.com\/assets\/[^"]+\.js)"/g)).map(m => m[1]);
    
    if (scriptUrls.length === 0) {
      scriptUrls = Array.from(html.matchAll(/src="([^"]+sndcdn\.com\/assets\/[^"]+\.js)"/g)).map(m => m[1]);
    }
    
    if (scriptUrls.length === 0) {
      // Look for any script that might contain the client_id
      const scriptRegex = /<script [^>]*src="([^"]+)"/g;
      let m;
      while ((m = scriptRegex.exec(html)) !== null) {
        if (m[1].includes('sndcdn.com') || m[1].includes('soundcloud.com')) {
          scriptUrls.push(m[1]);
        }
      }
    }
    
    console.log(`Found ${scriptUrls.length} potential SoundCloud asset scripts`);
    
    // Sort scripts to try the most likely ones first (usually the larger ones contain the logic)
    scriptUrls.sort((a, b) => b.length - a.length);

    for (const url of scriptUrls.slice(0, 20)) {
      try {
        const jsRes = await fetchWithRetry(url);
        if (!jsRes.ok) continue;
        const js = await jsRes.text();
        
        // Try different patterns for client_id
        const match = js.match(/client_id:"([^"]+)"/) || 
                      js.match(/client_id=([^&"]+)/) ||
                      js.match(/clientId:"([^"]+)"/) ||
                      js.match(/"client_id":"([^"]+)"/);
                      
        if (match) {
          webClientId = match[1];
          console.log('Successfully fetched new SoundCloud web client ID:', webClientId);
          return webClientId;
        }
      } catch (e) {
        // Continue to next script
      }
    }
  } catch (err) {
    console.error('Failed to fetch web client ID:', err);
  }
  console.log('Using fallback SoundCloud web client ID:', webClientId);
  return webClientId;
}

async function calculateStartOffset(track: any) {
  try {
    if (track.waveform_url) {
      const waveformUrl = track.waveform_url.replace('.png', '.json');
      const res = await fetchWithRetry(waveformUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.samples && data.samples.length > 0) {
          const firstNonZero = data.samples.findIndex((s: number) => s > 50); // Aggressive threshold to skip noise/quiet intros
          if (firstNonZero !== -1) {
            const offset = (firstNonZero / data.samples.length) * (track.duration / 1000);
            return Math.max(0, offset + 0.02); // Tighter buffer with aggressive threshold
          }
        }
      }
    }
  } catch (e) {
    console.error('Failed to calculate start offset:', e);
  }
  return 0;
}

app.get('/api/stream/:id', async (req, res) => {
  try {
    let clientId = webClientId;
    const trackId = req.params.id;
    
    console.log(`Streaming request for track ${trackId} with client ID ${clientId}`);
    
    const fetchTrackInfo = async (cid: string) => {
      let trackRes = await fetchWithRetry(`https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${cid}`);
      if (trackRes.status === 401 || trackRes.status === 403) {
        console.log('Client ID expired or invalid, refreshing...');
        const newCid = await getWebClientId();
        trackRes = await fetchWithRetry(`https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${newCid}`);
        return { res: trackRes, cid: newCid };
      }
      return { res: trackRes, cid };
    };

    let { res: trackRes, cid: currentCid } = await fetchTrackInfo(clientId);
    clientId = currentCid;

    let track;
    if (trackRes.ok) {
      track = await trackRes.json();
      console.log(`Successfully fetched track info for ${trackId}`);
    } else {
      console.warn(`Failed to fetch track info from api-v2 (status ${trackRes.status}) for ${trackId}. Retrying with fresh client ID...`);
      // Try one more time with a fresh client ID
      clientId = await getWebClientId();
      const retryRes = await fetchWithRetry(`https://api-v2.soundcloud.com/tracks/${trackId}?client_id=${clientId}`);
      if (retryRes.ok) {
        track = await retryRes.json();
        console.log(`Successfully fetched track info for ${trackId} after retry`);
      } else {
        console.error(`Retry failed for ${trackId} with status ${retryRes.status}`);
      }
    }
    
    if (track && track.media && track.media.transcodings) {
      console.log(`Track ${trackId} has ${track.media.transcodings.length} transcodings`);
      const startOffset = await calculateStartOffset(track);
      
      // Filter out encrypted HLS as we can't play them without DRM keys
      const availableTranscodings = track.media.transcodings.filter(
        (t: any) => !t.format.protocol.includes('encrypted')
      );
      
      console.log(`Track ${trackId} has ${availableTranscodings.length} available (non-encrypted) transcodings`);

      // Sort transcodings to prefer progressive, then hls mp3, then other hls
      const sortedTranscodings = availableTranscodings.sort((a: any, b: any) => {
        if (a.format.protocol === 'progressive' && b.format.protocol !== 'progressive') return -1;
        if (a.format.protocol !== 'progressive' && b.format.protocol === 'progressive') return 1;
        if (a.format.mime_type.includes('audio/mpeg') && !b.format.mime_type.includes('audio/mpeg')) return -1;
        if (!a.format.mime_type.includes('audio/mpeg') && b.format.mime_type.includes('audio/mpeg')) return 1;
        return 0;
      });

      for (const transcoding of sortedTranscodings) {
        if (!transcoding || !transcoding.url) continue;

        const fetchTranscoding = async (cid: string) => {
          let transUrl = transcoding.url + (transcoding.url.includes('?') ? '&' : '?') + `client_id=${cid}`;
          if (track.track_authorization) {
            transUrl += `&track_authorization=${track.track_authorization}`;
          }
          return await fetchWithRetry(transUrl);
        };

        let transRes = await fetchTranscoding(clientId);
        
        // Only retry on 401/403 (Unauthorized/Forbidden), not 404 (Not Found)
        if (transRes.status === 401 || transRes.status === 403) {
          console.log(`Transcoding fetch failed with ${transRes.status} for ${trackId}, retrying with fresh client ID...`);
          clientId = await getWebClientId();
          transRes = await fetchTranscoding(clientId);
        }

        if (transRes.ok) {
          const transData = await transRes.json();
          if (transData.url) {
            console.log(`Successfully resolved stream URL for track ${trackId} using protocol ${transcoding.format.protocol}`);
            return res.json({
              url: transData.url,
              protocol: transcoding.format.protocol,
              startOffset
            });
          }
        } else {
          console.warn(`Failed to fetch transcoding URL for track ${trackId} (protocol ${transcoding.format.protocol}): ${transRes.status}`);
        }
      }
      
      console.error(`All transcodings failed for track ${trackId}`);
      return res.status(404).json({ error: 'All transcodings failed', trackId });
    }
    
    console.error(`Stream not found for track ${trackId} (Track info ok: ${!!track})`);
    res.status(404).json({ error: 'Stream not found', trackId });
  } catch (err: any) {
    console.error('Stream error:', err);
    res.status(500).json({ error: err.message || 'Stream error' });
  }
});

async function startServer() {
  try {
    // Initialize SC client ID - don't let it crash the whole server
    await getWebClientId().catch(err => console.error('Initial Client ID fetch failed:', err));

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
      try {
        const { createServer: createViteServer } = await import("vite");
        const vite = await createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        });
        app.use(vite.middlewares);
      } catch (e) {
        console.error('Failed to initialize Vite middleware:', e);
      }
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      if (fs.existsSync(distPath)) {
        app.use(express.static(distPath));
        // SPA fallback for production
        app.get('*', (req, res) => {
          res.sendFile(path.join(distPath, 'index.html'));
        });
      } else {
        console.warn('Dist folder not found at:', distPath);
      }
    }

    // Only listen if we're not in a serverless environment (like Vercel)
    if (!process.env.VERCEL) {
      app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
      });
    }
  } catch (err) {
    console.error('CRITICAL: Server failed to start:', err);
  }
}

startServer();
