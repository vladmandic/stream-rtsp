# Transcode & Play RTSP Video Streams in Browser

Real Time Streaming Protocol (RTSP) and Real Time Messaging Protocol (RTMP) are  
frequently used in security cameras and were originally supported in browsers  
via plugins such as *RealMedia* (for RTSP) or *Flash* (for RTMP)  

However, such binary plugins are nowadays considered a security risk  
and are disabled in all modern browsers  

*So what are the options to view RTSP video stream in modern browsers?*  

- First we need to encapsulate video stream from RTSP into  
  a known streaming format on the server side  
  (all solutions require a server component)  
  And if camera already provides video stream in a well-known format such as H264,  
  we only need to re-encapsulate it, we don't need to decode/encode it,  
  so operation is lightweight  

- Then we can access that new stream from the browser using standard `Video` element,  
either natively or using a JavaScript library that provides  
HTML5 Media Source Extensions to the Video element  

## Options

Best solution is to use latest web streaming standard **WebRTC** (*Web Real-Time Communication*)

This project also provides additional examples for:

- Using `FFMpeg` to encapsulate **RTSP** into a **HLS** (*HTTP Live Streaming*)  
  and using `hls.js` library to play stream in browser
- Using `FFMpeg` to encapsulate **RTSP** into a **DASH** (*Dynamic Adaptive Streaming over HTTP*)  
  and using `dash.js` library to play stream in browser
- Using `FFMpeg` to encapsulate **RTSP** into a **FLV** (*Adobe Flash Video*)  
  and using `flv.js` library to play stream in browser (TBD)

<br><hr>

## Using RTSP to WebRTC

### Stream Server

Example `config.json`

```js
{
  "server": {
    "httpPort": 8000,
    "httpsPort": 8001,
    "encoderPort": ":8002",
    "iceServers": [], // not needed for local network access
    "webrtcMinPort": 32768,
    "webrtcMaxPort": 65535,
    "retryConnectSec": 5,
    "startStreamServer": true // automatically start rtsp to webrtc stream server, disable for hls or dash
  },
  "streams": {
    "reowhite": {
      "VOD": false,
      "disableAudio": true,
      "debug": false,
      "url": "rtsp://user:passowd@url:port/stream"
    }
  },
  "client": {
    "debug": true,
    "defaultStream": "reowhite"
  }
}
```

To build stream server in `stream/stream`:

```shell
cd stream
go build -ldflags="-s -w" .
```

### Test using WebRTC Stream

- Start web server: `node server/serve.js`  
  Server automatically starts stream server `stream/stream` as a child process
- Navigate to: `https://localhost:8001/client/webrtc.hmtl`

*Note: Lowest real-world video latency is below 1sec*

Server output:

```log
2021-04-12 12:32:34 INFO:  stream-rtsp version 0.0.1
2021-04-12 12:32:34 INFO:  User: vlado Platform: linux Arch: x64 Node: v15.14.0
2021-04-12 12:32:34 STATE:  HTTP server listening: 8000
2021-04-12 12:32:34 STATE:  HTTP2 server listening: 8001
2021-04-12 12:32:34 DATA:  stream server: stream connect: reowhite
2021-04-12 12:32:34 DATA:  stream server: Start HTTP Server: :8002
2021-04-12 12:32:48 DATA:  GET/2.0 full 200 text/html; charset=utf-8 885 /client/webrtc.html ::1
2021-04-12 12:32:48 DATA:  GET/2.0 full 200 text/javascript; charset=utf-8 2760 /client/webrtc.js ::1
2021-04-12 12:32:48 DATA:  GET/2.0 full 200 application/json; charset=utf-8 487 /config.json ::1
2021-04-12 12:32:48 DATA:  GET/2.0 full 200 image/x-icon 5063 /favicon.ico ::1
2021-04-12 12:32:48 DATA:  stream server: video detected
2021-04-12 12:32:48 DATA:  stream server: | 200 | 146.4000µs | ::1 | GET "/stream/codec/reowhite"
2021-04-12 12:32:48 DATA:  GET/2.0 full 200 application/octet-stream 305 /client/manifest.webmanifest ::1
2021-04-12 12:32:48 DATA:  stream server: | 200 |  12.3512ms | ::1 | POST "/stream/receiver/reowhite"
...
2021-04-12 12:34:24 DATA:  stream server: Client Not Send ACK (probably the browser is minimized) or tab not active Close client
2021-04-12 12:34:25 DATA:  stream server: WritePacket WebRTC Client Offline
```

<br><hr>

## Using RTSP to HLS

`hls.js`: <https://github.com/video-dev/hls.js/>  
`ffmpeg`: <https://ffmpeg.org/ffmpeg-formats.html#hls-2>

### Transcode to HLS

- Read from RTSP source
- Just copy video stream without re-encoding it
- Set HLS low latency mode with total of 5 fragments each 1 sec and use MP4 encapsulation
- Which means theoretical mininum latency will be 1sec

```shell
ffmpeg -hide_banner -loglevel fatal \
  -rtsp_transport tcp -flags -global_header \
  -i "rtsp://user:passowd@url:port/stream" \
  -an -c:v copy -b:v 2048k \
  -f hls -lhls 1 -hls_time 1 -hls_wrap 5 -hls_segment_type fmp4 \
  "tmp/stream.m3u8"
```

### Test HLS Stream

- Start stream transoding using `ffmpeg ...`
- Start web server: `node server/serve.js`
- Navigate to: `https://localhost:8001/client/hls.hmtl`

*Note: Lowest real-world video latency is ~2.5sec*  
*Targeting lower latency causes (recoverable) buffering issues*

<br><hr>

## Using RTSP to Dash

- `dash.js`: <https://github.com/Dash-Industry-Forum/dash.js/>
- `ffmpeg`: <https://ffmpeg.org/ffmpeg-formats.html>

### Transcode

- Read from RTSP source
- Just copy video stream without re-encoding it
- Set DASH low latency mode with total of 3+1 fragments each 3 sec and use MP4 encapsulation
- Which means theoretical mininum latency will be 3sec

```shell
ffmpeg -hide_banner -loglevel fatal \
  -rtsp_transport tcp -flags -global_header \
  -i "rtsp://user:passowd@url:port/stream" \
  -an -c:v copy -b:v 2048k \
  -f dash -window_size 3 -extra_window_size 1 -ldash 1 -seg_duration 3 -frag_duration 1 -target_latency 5 -streaming 1 -remove_at_exit 1 \
  "tmp/stream.mpd"
```

### Test

- Start stream transoding using `ffmpeg ...`
- Start web server: `node server/serve.js`
- Navigate to: `http://localhost:8001/client/dash.hmtl`

*Note: Lowest real-world video latency is ~6.5sec*  
*Targeting lower latency does not work with DASH and causes both runtime errors in the library as well as (recoverable) buffering issues*

<br><hr>

## Future

- Add embedded `ffmpeg` execution to `serve.js`
- Investigate `ffmpeg` as `wasm`: <https://github.com/Kagami/ffmpeg.js>
- Investigate `rtmp` using `media-stream-library-js` or `video.js` or `hls.js`
