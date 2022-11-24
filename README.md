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

This option is by far the fastest and uses least amount of resources as it does not require actual transcoding of the video stream and instead simply re-encapsulates available video stream found in `rtsp` into `webrtc` format  

However, it requires that video stream presented by camera via `rtsp` is a supported codec: **H264**, **PCM_ALAW**, **PCM_MULAW** or **OPUS**.  
If video codec is not supported, then only option is to use actual transcoding - see options using `ffmpeg` instead.


### 1. Configure

Create configuration `config.json`  

```js
{
  "server": {
    "httpPort": 8000, // port for local http server
    "httpsPort": 8001, // port for local https server
    "encoderPort": ":8002", // http port for that will serve media stream
    "iceServers": [], // not needed for local network access
    "webrtcMinPort": 32768, // port range, no need to change
    "webrtcMaxPort": 65535, // port range, no need to change
    "retryConnectSec": 5, // if webcam is slow to respond you may need to increase value
    "startStreamServer": true // automatically start rtsp to webrtc stream server, disable for hls or dash
  },
  "streams": { // define any number of streams, but has to be at least one
    "reowhite": { // logical name of a stream
      "VOD": false, // always false
      "disableAudio": true, // you can stream audio as well although its not well supported
      "debug": false, // enable protocol debugging
      "url": "rtsp://user:password@url:port/stream" // actual uri of the stream you want to transcode
    }
  },
  "client": {
    "debug": true, // enable client side debug logs
    "defaultStream": "reowhite" // must match a valid stream name configured above
  }
}
```

### 2. Start Server

`npm start`

> stream-rtsp@0.0.1 start /home/vlado/dev/stream-rtsp  
> node server/serve

```js
INFO:  stream-rtsp version 0.0.1
INFO:  User: vlado Platform: linux Arch: x64 Node: v19.1.0
STATE: http server listening: 8000
STATE: http2 server listening: 8001
DATA:  stream: http server  :8002
DATA:  stream: connect: reowhite
DATA:  GET/2.0 full 200 text/html; charset=utf-8 885 /client/webrtc.html ::1
DATA:  GET/2.0 full 200 text/javascript; charset=utf-8 3251 /client/webrtc.js ::1
DATA:  GET/2.0 full 200 application/json; charset=utf-8 487 /config.json ::1
DATA:  stream: video detected
DATA:  stream: [GIN] 2022/11/24 - 09:41:45 | 200 |    41.581µs | ::1 | GET "/stream/codec/reowhite"
DATA:  GET/2.0 full 200 image/x-icon 5063 /favicon.ico ::1
DATA:  GET/2.0 full 200 application/octet-stream 305 /client/manifest.webmanifest ::1
DATA:  stream: video detectedSet UDP ports to 32768 .. 65535
DATA:  stream: [GIN] 2022/11/24 - 09:41:45 | 200 | 82.300765ms | ::1 | POST "/stream/receiver/reowhite"
```

### 3. Connect Client

Navigate to: <https://localhost:8001/client/webrtc.html>  
It should display the webrtc stream from camera  
*Note: Lowest real-world video latency is below 1sec*

For details, check browser inspector console log:

```js
webrtc client starting
webrtc server: http://localhost:8002 stream: reowhite
webrtc received streams: [{ "Type": "video" }]
webrtc negotiation start: RTCSessionDescription {
  type: 'offer',
  sdp: 'v=0\r\no=- 4399680908628474473 2 IN IP4 127.0.0.1\r\ns…:1\r\na=sctp-port:5000\r\na=max-message-size:262144\r\n'
}
webrtc connection checking
webrtc received track: MediaStreamTrack {
  kind: 'video', id: '8a13f611-eb50-4aa8-a8fd-3884139fe2cd', enabled: true, readyState: 'live',
}
webrtc connection connected
webrtc channel open
webrtc resolution: 2560 1920
```

### 4. Rebuild & Troubleshoot

#### Rebuild

To build stream server in `stream/stream`

> npm run build

#### Disconnect Loop

if you see a loop of:
```js
DATA:  stream server: connect: reowhite
DATA:  stream server: error: rtsp disconnected
```

it could be that:
- camera is busy  
  cameras have limited number of available connections and if youre using camera in some other software, it may not allow additional connections. even after you disconnect, it may take up to 30sec for camera to release connection handle and become available for new connections  
- the url specified in `config.json` is not valid  
- the video stream is corrupt or simply not recognized  

#### Advanced Troubleshooting

To futher troubleshoot, enable debug in `config.json` streams configuration  
This is enables full protocol logging and results in binary output, so capture the log and look for following ascii snippets:

```log
[OPTIONS rtsp://reolink-white:554/h264Preview_01_main RTSP/1.0CSeq: 1User-Agent: Lavf58.76.100]

[DESCRIBE rtsp://reolink-white:554/h264Preview_01_main RTSP/1.0CSeq: 3Authorization: Digest username="admin", realm="LIVE555 Streaming Media", nonce="6f861c23467c7282b1464f2f386f9c3c", uri="rtsp://reolink-white:554/h264Preview_01_main", response="a9f1d8debd46cc3b336d70492faccc3a"Accept: application/sdpUs
er-Agent: Lavf58.76A2]

[RTSP/1.0 200 OKCSeq: 3Date: Thu, Nov 24 2022 15:10:19 GMTContent-Base: rtsp://192.168.0.203/h264Preview_01_main/Content-Type: application/sdpContent-Length: 718v=0o=- 1669289695611647 1 IN IP4 192.168.0.203s=Session streamed by "preview"i=h264Preview_01_maint=0 0a=tool:LIVE555 Streaming Media v2013.04.08a=type:broadcasta=control:*a=range:npt=0-a=x-qt-text-nam:Session streamed by "preview"a=x-qt-text-inf:h264Preview_01_mainm=video 0 RTP/AVP 96c=IN IP4 0.0.0.0b=AS:500a=rtpmap:96 H264/90000a=fmtp:96 packetization-mode=1;profile-level-id=640033;sprop-parameter-sets=Z2QAM6zoAoAPGQ==,aO48sA==a=control:trackID=1m=audio 0 RTP/AVP 97c=IN IP4 0.0.0.0b=AS:256a=rtpmap:97 MPEG4-GENERIC/16000a=fmtp:97 streamtype=5;profile-level-id=15;mode=AAC-hbr;sizelength=13;indexlength=3;indexdeltalength=3;config=1408; profile=1;a=control:trackID=2]

[SETUP rtsp://192.168.0.203/h264Preview_01_main/trackID=1 RTSP/1.0CSeq: 4Authorization: Digest username="admin", realm="LIVE555 Streaming Media", nonce="6f861c23467c7282b1464f2f386f9c3c", uri="rtsp://192.168.0.203/h264Preview_01_main/trackID=1", response="17c7a56100c6680e6db34ef891bfc832"Transport: RTP/AVP/TCP;unicast;interleaved=0-1User-Agent: Lavf58.76.100]

[RTSP/1.0 200 OKCSeq: 4Date: Thu, Nov 24 2022 15:10:19 GMTTransport: RTP/AVP/TCP;unicast;destination=192.168.0.201;source=192.168.0.203;interleaved=0-1Session: D90CE24F]

[PLAY rtsp://192.168.0.203/h264Preview_01_main/ RTSP/1.0CSeq: 5Authorization: Digest username="admin", realm="LIVE555 Streaming Media", nonce="6f861c23467c7282b1464f2f386f9c3c", uri="rtsp://192.168.0.203/h264Preview_01_main/", response="4d63a07805fa5089ee38935004fcdc8e"User-Agent: Lavf58.76.100Session: D90CE24F]

[RTSP/1.0 200 OKServer: Rtsp Server/2.0CSeq: 5Date: Thu, Nov 24 2022 15:10:19 GMTRange: npt=0.000-Session: D90CE24FRTP-Info: url=trackID=1;seq=23202;rtptime=3253684886;ssrc=204c95ce,url=trackID=2;seq=0;rtptime=0;ssrc=00000000]

[GIN] 2022/11/24 - 10:29:04 | 200 |      38.338µs |             ::1 | GET      "/stream/codec/reowhite"

[GIN] 2022/11/24 - 10:29:04 | 200 |  195.316064ms |             ::1 | POST     "/stream/receiver/reowhite"

[OPTIONS rtsp://192.168.0.203/h264Preview_01_main/ RTSP/1.0CSeq: 6Authorization: Digest username="admin", realm="LIVE555 Streaming Media", nonce="82060d0e8391fdf8b0b34cf6ecd66ea7", uri="rtsp://192.168.0.203/h264Preview_01_main/", response="f01cd82bf3b52fc4090179eaa51d69dc"Require: implicit-playUser-Agent: Lavf58.76.100Session: 4F156EE5]

[OPTIONS rtsp://192.168.0.203/h264Preview_01_main/ RTSP/1.0CSeq: 7Authorization: Digest username="admin", realm="LIVE555 Streaming Media", nonce="82060d0e8391fdf8b0b34cf6ecd66ea7", uri="rtsp://192.168.0.203/h264Preview_01_main/", response="f01cd82bf3b52fc4090179eaa51d69dc"Require: implicit-playUser-Agent: Lavf58.76.100Session: 4F156EE5]
```



*Note: Do not post full binary logs in a GitHub issue!*

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
