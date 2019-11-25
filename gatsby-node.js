/**
 * Implement Gatsby's Node APIs in this file.
 *
 * See: https://www.gatsbyjs.org/docs/node-apis/
 */

// You can delete this file if you're not using it

const path = require(`path`)
const { createFilePath } = require(`gatsby-source-filesystem`)

exports.onCreateNode = ({ node, getNode, actions }) => {
  const { createNodeField } = actions
  if (node.internal.type === `MarkdownRemark`) {
    const slug = createFilePath({ node, getNode, basePath: `pages` })
    createNodeField({
      node,
      name: `slug`,
      value: slug,
    })
  }
}

exports.createPages = ({ graphql, actions }) => {
  const { createPage } = actions
  const blogPostTemplate = path.resolve(`src/templates/blog-post.js`)
  // Yes, this escaping is cursed. Every backslash needs to be escaped once for JS
  // then once again for graphql. Result: for a \ in the regex we need \\\\.
  return graphql(`
    {
      allMarkdownRemark {
        edges {
          node {
            frontmatter {
              path
              draft
            }
            fields {
              slug
            }
          }
        }
      }
    }
  `).then(result => {
    if (result.errors) {
      return Promise.reject(result.errors)
    }
    result.data.allMarkdownRemark.edges
      .filter(({ node }) => !node.frontmatter.draft)
      .forEach(({ node }) => {
        const path = node.frontmatter.path || `/blog/${node.fields.slug.replace(/\//g, '')}`;
        createPage({
          path,
          component: blogPostTemplate,
          slug: node.fields.slug,
          context: {},
        })
      })
  })
}
