const http = require('http');

// Map to store active channels
// Key: channelId (string)
// Value: { clients: Set<http.ServerResponse>, feedReq: http.IncomingMessage || null, buffer: Buffer[] }
const channels = new Map();

// Configuration
const PORT = process.env.PORT || 8000;
const BUFFER_SIZE_LIMIT = 50 * 1024 * 1024; // 50MB limit to prevent memory bloating

// Helper to log with timestamp
function log(message, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`, ...args);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Status Dashboard
  if (pathname === '/' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    const status = {
      activeChannels: Array.from(channels.entries()).map(([id, ch]) => ({
        channelId: id,
        clientCount: ch.clients.size,
        hasFeed: !!ch.feedReq,
        bufferedBytes: ch.buffer ? ch.buffer.reduce((acc, b) => acc + b.length, 0) : 0
      }))
    };
    res.end(JSON.stringify(status, null, 2));
    return;
  }

  // 2. Feed Source (FFmpeg pushes stream here)
  // Format: POST /feed/:channelId
  if (pathname.startsWith('/feed/') && req.method === 'POST') {
    const channelId = pathname.substring(6); // get channelId after '/feed/'
    if (!channelId) {
      res.writeHead(400);
      res.end('Missing channel ID');
      return;
    }

    log(`Feed source connecting for channel: [${channelId}]`);

    // Initialize channel if not exists
    let channel = channels.get(channelId);
    if (!channel) {
      channel = { clients: new Set(), feedReq: null, buffer: [] };
      channels.set(channelId, channel);
    } else {
      // If there's an existing feed, close it
      if (channel.feedReq) {
        log(`Replacing existing feed for channel: [${channelId}]`);
        channel.feedReq.destroy();
      }
    }

    channel.feedReq = req;

    // Set connection timeout higher or disable for live feed
    req.socket.setKeepAlive(true, 10000);

    req.on('data', (chunk) => {
      // Broadcast to all connected clients
      for (const client of channel.clients) {
        try {
          client.write(chunk);
        } catch (err) {
          log(`Error writing to client on channel [${channelId}]:`, err.message);
          channel.clients.delete(client);
        }
      }

      // Buffer the most recent chunks (approx. 2MB) for instant playback startup
      channel.buffer.push(chunk);
      let currentBufferSize = channel.buffer.reduce((acc, b) => acc + b.length, 0);
      while (currentBufferSize > 2 * 1024 * 1024 && channel.buffer.length > 0) {
        const removed = channel.buffer.shift();
        currentBufferSize -= removed.length;
      }
    });

    req.on('end', () => {
      log(`Feed source ended for channel: [${channelId}]`);
      cleanupChannelFeed(channelId);
      res.writeHead(200);
      res.end('Feed ended');
    });

    req.on('close', () => {
      if (channel.feedReq === req) {
        log(`Feed source connection closed for channel: [${channelId}]`);
        cleanupChannelFeed(channelId);
      }
    });

    req.on('error', (err) => {
      log(`Feed source error for channel [${channelId}]:`, err.message);
      cleanupChannelFeed(channelId);
    });

    return;
  }

  // 3. Client View (TV or VLC plays stream from here)
  // Format: GET /live/:channelId
  if (pathname.startsWith('/live/') && req.method === 'GET') {
    const channelId = pathname.substring(6); // get channelId after '/live/'
    if (!channelId) {
      res.writeHead(400);
      res.end('Missing channel ID');
      return;
    }

    log(`Client connecting to channel: [${channelId}]`);

    let channel = channels.get(channelId);
    if (!channel) {
      channel = { clients: new Set(), feedReq: null, buffer: [] };
      channels.set(channelId, channel);
    }

    // Write appropriate headers for MPEG-TS stream
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    // Write the buffer cache if present so client starts playing instantly
    if (channel.buffer && channel.buffer.length > 0) {
      for (const cachedChunk of channel.buffer) {
        res.write(cachedChunk);
      }
    }

    channel.clients.add(res);
    log(`Client added to channel [${channelId}]. Total clients: ${channel.clients.size}`);

    req.on('close', () => {
      if (channel) {
        channel.clients.delete(res);
        log(`Client disconnected from channel [${channelId}]. Remaining clients: ${channel.clients.size}`);
        
        // Clean up empty channel if there is no feed and no clients
        if (channel.clients.size === 0 && !channel.feedReq) {
          channels.delete(channelId);
          log(`Deleted empty channel: [${channelId}]`);
        }
      }
    });

    return;
  }

  // 4. Fallback 404
  res.writeHead(404);
  res.end('Not Found');
});

function cleanupChannelFeed(channelId) {
  const channel = channels.get(channelId);
  if (channel) {
    channel.feedReq = null;
    channel.buffer = [];
    log(`Closing all client connections for channel [${channelId}] due to feed end`);
    for (const client of channel.clients) {
      try {
        client.end();
      } catch (e) {}
    }
    channel.clients.clear();
    channels.delete(channelId);
  }
}

server.listen(PORT, () => {
  log(`MPEG-TS Relay Server running on port ${PORT}`);
});
