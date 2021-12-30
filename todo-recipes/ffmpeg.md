# ffmpeg

Everyone's favourite impossible-to-use tool

Coordinates are counted from the top left corner like so:

```
0- +x
|
+y
```

## Add text

This puts the text in a transparent box with opacity 0.25.

```
ffmpeg -i input.mp4 -vf drawtext="fontfile=/usr/share/fonts/adobe-source-sans-pro/SourceSansPro-Regular.otf: text='THE TEXT': fontcolor=white: fontsize=250: box=1: boxcolor=black@0.25: boxborderw=5: x=(w-text_w)/2: y=(h-550)" -codec:a copy output.mp4
```

## Download a m3u8 playlist

```
ffmpeg -protocol_whitelist file,http,https,tcp,tls,crypto -i 'https://host/playlist.m3u8' -c copy video.mp4
```

## Add a black screen to some audio

```
ffmpeg -i string.mp3 -f lavfi -i color=black:s=640x480 -c:v libx264 -c:a aac -shortest output.mp4
```
