## tar with zstd

```
# zstdmt: multithread
ZSTD_CLEVEL=19 tar -I zstdmt -cvpf mytar.tar.zst myfiles
```
