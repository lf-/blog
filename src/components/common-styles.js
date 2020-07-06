import { css } from '@emotion/core'
import styled from "@emotion/styled"

export const ImageFeature = css`
  margin-bottom: 1.5em;
`
export const Content = css`
  margin: 0 auto;
  max-width: 860px;
  padding: 1.45rem 1.0875rem;
`
export const MarkdownContentCSS = css`
  a {
    text-decoration: none;
    position: relative;
  }

  a:not(.gatsby-resp-image-link)::after {
    content: "";
    position: absolute;
    /* I don't know why we need this z-index modification */
    /* z-index: -1; */
    top: 85%;
    left: -0.1px;
    right: -0.1px;
    bottom: 0;
    transition: top 0.1s ease-in-out;
    background-color: rgba(187, 57, 228, 0.30);
    border-radius: 0.3em;
  }

  a:hover::after {
    top: 15%;
  }
`

export const MarkdownContent = styled.div(MarkdownContentCSS)
