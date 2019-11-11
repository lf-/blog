import React from "react"
import { Link, graphql } from "gatsby"
import { css } from "@emotion/core"
import styled from "@emotion/styled"

import Layout from "../components/layout"
import SEO from "../components/seo"

import Img from "gatsby-image"
import { ImageFeature } from "../components/common-styles"

const Content = styled.div`
  margin: 0 auto;
  max-width: 860px;
  padding: 1.45rem 1.0875rem;
`

const ArticleDate = styled.h5`
  display: inline;
  color: #606060;
`

const MarkerHeader = styled.h3`
  display: inline;
  border-radius: 1em 0 1em 0;
`

const ReadingTime = styled.h5`
  display: inline;
  color: var(--textSubColor);
`

const IndexPage = ({ data }) => {
  return (
    <Layout>
      <SEO title="Blog" />
      <Content>
        <h1>Blog</h1>
        {data.allMarkdownRemark.edges.map(({ node }) => {

          const featuredImage = node.frontmatter.featuredImage
          return (
            <div key={node.id}>
              <Link
                to={node.frontmatter.path}
                css={css`
                text-decoration: none;
                color: inherit;
              `}
              >
                <MarkerHeader>{node.frontmatter.title} </MarkerHeader>
                <div>
                  <ArticleDate>{node.frontmatter.date}</ArticleDate>
                  <ReadingTime> - {node.fields.readingTime.text}</ReadingTime>
                </div>
                {featuredImage &&
                  <Img css={ImageFeature} fluid={featuredImage.childImageSharp.fluid} />}
                <p>{node.excerpt}</p>
              </Link>
            </div>
          )
        })}
      </Content>
    </Layout>
  )
}

export default IndexPage

export const query = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allMarkdownRemark(
      sort: { fields: [frontmatter___date], order: DESC }
      filter: { frontmatter: { draft: { eq: false }, isPage: { ne: true } } }
    ) {
      totalCount
      edges {
        node {
          id
          frontmatter {
            title
            date(formatString: "MMMM D, YYYY")
            path
            featuredImage {
              childImageSharp {
                fluid(maxWidth: 800) {
                  ...GatsbyImageSharpFluid
                }
              }
            }
          }
          fields {
            slug
            readingTime {
              text
            }
          }
          excerpt(pruneLength: 1000)
        }
      }
    }
  }
`
