# GIFs

## MP4 to GIF

```bash
ffmpeg -i input.mp4 -vf "fps=10,scale=320:-1:flags=lanczos" -c:v pam -f image2pipe - | convert -delay 10 - -loop 0 -layers optimize output.gif
```

## GIF to MP4

```bash
ffmpeg -f gif -i infile.gif outfile.mp4
```
