# Sources for `jade.fyi`

These are the source files for `jade.fyi`. I used to use the site
`lfcode.ca`, whose Gatsby based sources are available on the `old` branch of
this repository. Those ones are no longer maintained.

If you have any issues with using the site, especially relating to
accessibility, please file an issue on this repository. I consider it a
priority for this site to be usable to everyone.

## TODO

- [ ] Readd the "recipes" section from the old site

## Usage

This one is based on Zola. After installing the latest (preferably `next`
branch from git) version of Zola, you can build the site as follows:

```
# starts a server on 127.0.0.1:1111 serving the website
$ zola serve

# builds the website to public/
$ zola build

# deploys what's in public/ to some web server
$ ./deploy.sh
```