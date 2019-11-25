import React from "react"
import { graphql } from "gatsby"
import styled from "@emotion/styled"
import Layout from "../components/layout"
import SEO from "../components/seo"

import Img from "gatsby-image"
import { ImageFeature, MarkdownContent } from "../components/common-styles"

const Content = styled.div`
  margin: 0 auto;
  max-width: 860px;
  padding: 1.45rem 1.0875rem;
`

const MarkedHeader = styled.h1`
  display: inline;
  border-radius: 1em 0 1em 0;
`

const HeaderDate = styled.h3`
  margin-top: 10px;
  color: var(--textSubColor);
`

export default ({ data }) => {
  const post = data.markdownRemark
  const featuredImage = post.frontmatter.featuredImage
  return (
    <Layout>
      <SEO
        title={post.frontmatter.title}
        description={post.frontmatter.description || post.excerpt}
      />
      <Content>
        <MarkedHeader>{post.frontmatter.title}</MarkedHeader>
        {!post.frontmatter.isPage &&
          <HeaderDate>
            {post.frontmatter.date} - {post.fields.readingTime.text}
          </HeaderDate>
        }
        {featuredImage &&
          <Img css={ImageFeature} fluid={featuredImage.childImageSharp.fluid} />
        }

        <MarkdownContent dangerouslySetInnerHTML={{ __html: post.html }} />
      </Content>
    </Layout>
  )
}

export const pageQuery = graphql`
  query($path: String!) {
    markdownRemark(frontmatter: { path: { eq: $path } }) {
      html
      frontmatter {
        date(formatString: "MMMM D, YYYY")
        isPage
        path
        title
        featuredImage {
          childImageSharp {
            fluid(maxWidth: 800) {
              ...GatsbyImageSharpFluid
            }
          }
        }
      }
      fields {
        readingTime {
          text
        }
      }
    }
  }
`
