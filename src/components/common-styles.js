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
    top: 80%;
    left: -0.1px;
    right: -0.1px;
    bottom: 0;
    transition: top 0.1s ease-in-out;
    background-color: rgba(150, 203, 254, 0.8);
  }

  a:hover::after {
    top: 0;
  }
`

export const MarkdownContent = styled.div(MarkdownContentCSS)