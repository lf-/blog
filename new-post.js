const fs = require('fs')

const yargs = require('yargs')
const editor = require('external-editor')
const graymatter = require('gray-matter')
const toml = require('toml')

function ISO8601(epochtime) {
    const date = new Date(epochtime)
    // we need to add one to the month because JS is dumb and counts 0-11
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

const template = `\
+++
date = "${ISO8601(Date.now())}"
draft = false
path = "/blog/title"
tags = []
title = "TITLE"
featuredImage = ""
+++

`

function main() {

    const args =
        yargs.options({
            editor: {
                type: 'string',
                describe: 'editor to use for making the post',
            }
        }).parse()

    const ed = new editor.ExternalEditor(template, { postfix: '.md' })
    if (args.editor) {
        ed.editor.bin = args.editor
    }

    const postText = ed.run()
    const gm = graymatter(postText, {
        excerpt: true,
        excerpt_separator: '<!-- excerpt -->',
        engines: {
            'toml': toml.parse.bind(toml),
        },
        language: 'toml',
        delimiters: '+++',
    });
    const slug = /^\/blog\/(.+)$/.exec(gm.data.path)[1]

    // if the user doesn't change the post there is no value in saving it
    if (postText === template) {
        return;
    }
    const filename = `src/content/${slug}.md`

    fs.writeFileSync(filename, postText)
}

main()