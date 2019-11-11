# lfcode.ca

Hi! This is the repository for my blog.

## Deployment

This site is deployed with rsync. Make sure it is installed on your server and on your computer.

First, configure your `.deploy_config`:

```
DEPLOY_HOST=[the host you rsync to]
DEPLOY_DIR=[the directory you rsync to]
# optional
EXTRA_OPTS=[extra rsync options you want to use]
```

Then run `npm run deploy`.

**WARNING**: this script uses `--delete-after` and thus deletes everything in the directory it is pointed at. Consider using `-n` in `EXTRA_OPTS` initially to make sure you aren't accidentally erasing anything. If you want to serve anything else on the server, you will need to make your web server serve out of multiple paths. I have a blog post on [how to do this with nginx](https://lfcode.ca/blog/nginx-try_files-troubles).

## Making a new post

`npm run new-post` will make a new post with a frontmatter template including the current date then open it in `$VISUAL`.

## License

The content on this blog is licensed CC-BY-SA 4.0. The website code is MIT licensed.