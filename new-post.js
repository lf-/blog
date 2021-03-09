#!/usr/bin/env node
const fs = require('fs')

const yargs = require('yargs')
const editor = require('external-editor')
const graymatter = require('gray-matter')
const toml = require('toml')

function ISO8601(epochtime) {
    const date = new Date(epochtime)
    // we need to add one to the month because JS is dumb and counts 0-11
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${(date.getDate()).toString().padStart(2, '0')}`
}

const template = `\
+++
date = "${ISO8601(Date.now())}"
draft = false
path = "/blog/title"
tags = []
title = "TITLE"
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
    const filename = `content/posts/${slug}.md`

    fs.writeFileSync(filename, postText)
}

main()
