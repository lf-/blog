# pdf

## Pull a page range from a pdf

```bash
pdftk {filename.pdf} cat {page ranges} output {output.pdf}
```

## Get metadata of a pdf

```bash
pdfinfo {filename.pdf}
```

## Concatenate a bunch of pdfs

Note: I think this overwrites the last input file if you forget to specify an output!!

```bash
pdfunite {file.pdf...} {output.pdf}
```

